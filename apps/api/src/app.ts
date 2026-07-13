import { randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import {
  createSubcontractorSchema,
  documentReviewDecisionSchema,
  type ReviewResult,
  updateNoteSchema,
  updateSubcontractorSchema,
} from '@tl/shared';
import { db, documentRequests, documentVersions, requirements, settings, subcontractors } from './db';
import { queueAiReview } from './ai-review';
import { isPreviewEmail, sendDocumentEmail } from './email';
import { getDocumentDownloadUrl, storeDocument } from './storage';

const app = new Hono();

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", 'data:'],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    frameSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
  permissionsPolicy: {
    camera: [],
    geolocation: [],
    microphone: [],
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  xFrameOptions: 'DENY',
}));

app.use('/portal/*', async (c, next) => {
  await next();
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
});

app.get('/api/health', (c) =>
  c.json({ status: 'ok' as const, service: 'tl-api', time: new Date().toISOString() }),
);

const requestWithType = {
  documentRequests: {
    with: {
      documentType: {
        with: {
          requirements: true,
        },
      },
      versions: true,
    },
  },
  emailLog: true,
} as const;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const settingsSchema = z.object({ additionalInstructions: z.string().max(5_000) });
const requirementSchema = z.object({ text: z.string().trim().min(1).max(1_000) });

type UploadedFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function isUploadedFile(value: unknown): value is UploadedFile {
  return !!value && typeof value === 'object' && 'arrayBuffer' in value && 'size' in value;
}

/** Do not disclose private storage keys to either the portal or the client UI. */
function serializeSubcontractor<T extends { documentRequests: Array<{ versions: Array<{ storagePath: string; uploadedAt: Date }> }>; emailLog: Array<{ sentAt: Date }> }>(subcontractor: T) {
  return {
    ...subcontractor,
    documentRequests: subcontractor.documentRequests.map(({ versions, ...request }) => ({
      ...request,
      versions: versions
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .map(({ storagePath: _storagePath, ...version }) => version),
    })),
    emailLog: [...subcontractor.emailLog].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()),
  };
}

function currentVersion<T extends { uploadedAt: Date }>(versions: T[]) {
  return [...versions].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
}

function incompleteReason(version?: { humanReview: ReviewResult | null }) {
  if (!version?.humanReview) return undefined;
  return version.humanReview.reason?.trim()
    || version.humanReview.results.find((result) => !result.pass && result.reason?.trim())?.reason?.trim()
    || version.humanReview.summary?.trim();
}

/** The public portal only receives the derived decision message, never internal review details. */
function serializePortalSubcontractor<T extends {
  documentRequests: Array<{
    status: string;
    versions: Array<{
      storagePath: string;
      uploadedAt: Date;
      humanReview: ReviewResult | null;
      aiReview: unknown;
      aiReviewedAt: Date | null;
      extracted: unknown;
      decidedAt: Date | null;
      decidedStatus: string | null;
    }>;
  }>;
}>(subcontractor: T) {
  return {
    ...subcontractor,
    documentRequests: subcontractor.documentRequests.map(({ versions, ...request }) => {
      const current = currentVersion(versions);
      return {
        ...request,
        incompleteReason: request.status === 'incomplete' ? incompleteReason(current) : undefined,
        versions: [...versions]
          .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
          .map(({ storagePath: _storagePath, humanReview: _humanReview, aiReview: _aiReview, aiReviewedAt: _aiReviewedAt, extracted: _extracted, decidedAt: _decidedAt, decidedStatus: _decidedStatus, ...version }) => version),
      };
    }),
  };
}

function validationError(c: Context, error: unknown) {
  return c.json({ error: 'Invalid request', details: error }, 400);
}

app.get('/api/subcontractors', async (c) => {
  const rows = await db.query.subcontractors.findMany({
    with: requestWithType,
    orderBy: (subcontractor, { desc }) => [desc(subcontractor.createdAt)],
  });
  return c.json({ subcontractors: rows.map(serializeSubcontractor) });
});

app.post('/api/subcontractors', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSubcontractorSchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.flatten());

  const { name, email, dueDate, certificationType } = parsed.data;
  const sendInitialEmail = (body as { sendInitialEmail?: unknown } | null)?.sendInitialEmail === true;
  const subcontractor = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(subcontractors)
      .values({ name, email, certificationType, portalToken: randomBytes(32).toString('base64url') })
      .returning();
    const types = await tx.query.documentTypes.findMany({ orderBy: (type, { asc: orderAsc }) => [orderAsc(type.sortOrder)] });
    await tx.insert(documentRequests).values(
      types.map((type) => ({ subcontractorId: created.id, documentTypeId: type.id, dueDate })),
    );
    return tx.query.subcontractors.findFirst({ where: eq(subcontractors.id, created.id), with: requestWithType });
  });
  if (!subcontractor) return c.json({ error: 'Unable to create subcontractor' }, 500);

  let emailLog;
  let emailError: string | undefined;
  if (sendInitialEmail) {
    try {
      emailLog = await sendDocumentEmail(subcontractor, 'request');
    } catch (error) {
      console.error('Initial document request email failed', error);
      emailError = error instanceof Error ? error.message : 'Unable to send the initial email.';
    }
  }
  return c.json({
    subcontractor: serializeSubcontractor(subcontractor),
    email: emailLog && { log: emailLog, preview: isPreviewEmail(emailLog) },
    emailError,
  }, 201);
});

app.get('/api/subcontractors/:id', async (c) => {
  const subcontractor = await db.query.subcontractors.findFirst({
    where: eq(subcontractors.id, c.req.param('id')),
    with: requestWithType,
  });
  if (!subcontractor) return c.json({ error: 'Subcontractor not found' }, 404);
  return c.json({ subcontractor: serializeSubcontractor(subcontractor) });
});

app.patch('/api/subcontractors/:id', async (c) => {
  const parsed = updateSubcontractorSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.flatten());
  const { dueDate, ...fields } = parsed.data;
  const id = c.req.param('id');
  const subcontractor = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(subcontractors)
      .set(fields)
      .where(eq(subcontractors.id, id))
      .returning();
    if (!updated) return undefined;
    if (dueDate) {
      await tx
        .update(documentRequests)
        .set({ dueDate, updatedAt: new Date() })
        .where(and(eq(documentRequests.subcontractorId, id), ne(documentRequests.status, 'accepted')));
    }
    return tx.query.subcontractors.findFirst({ where: eq(subcontractors.id, id), with: requestWithType });
  });
  if (!subcontractor) return c.json({ error: 'Subcontractor not found' }, 404);
  return c.json({ subcontractor: serializeSubcontractor(subcontractor) });
});

app.patch('/api/subcontractors/:id/note', async (c) => {
  const parsed = updateNoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.flatten());
  const [subcontractor] = await db
    .update(subcontractors)
    .set({ note: parsed.data.note })
    .where(eq(subcontractors.id, c.req.param('id')))
    .returning();
  if (!subcontractor) return c.json({ error: 'Subcontractor not found' }, 404);
  return c.json({ subcontractor });
});

app.post('/api/subcontractors/:id/email/follow-up', async (c) => {
  const subcontractor = await db.query.subcontractors.findFirst({
    where: eq(subcontractors.id, c.req.param('id')),
  });
  if (!subcontractor) return c.json({ error: 'Subcontractor not found' }, 404);
  try {
    const log = await sendDocumentEmail(subcontractor, 'follow_up');
    return c.json({ email: { log, preview: isPreviewEmail(log) } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send the follow-up email.';
    const noOutstanding = message.startsWith('There are no outstanding');
    console.error('Follow-up email failed', error);
    return c.json({ error: message }, noOutstanding ? 409 : 502);
  }
});

/** The requirements and extra instructions that form the AI-review prompt. */
app.get('/api/settings', async (c) => {
  const documentTypes = await db.query.documentTypes.findMany({
    with: { requirements: true, settings: true },
    orderBy: (type, { asc }) => [asc(type.sortOrder)],
  });
  return c.json({ documentTypes });
});

app.put('/api/settings/:documentTypeId', async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.flatten());
  const documentTypeId = c.req.param('documentTypeId');
  const documentType = await db.query.documentTypes.findFirst({
    where: (table, { eq: isEqual }) => isEqual(table.id, documentTypeId),
  });
  if (!documentType) return c.json({ error: 'Document type not found' }, 404);
  const [setting] = await db.insert(settings)
    .values({ documentTypeId, additionalInstructions: parsed.data.additionalInstructions, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.documentTypeId,
      set: { additionalInstructions: parsed.data.additionalInstructions, updatedAt: new Date() },
    })
    .returning();
  return c.json({ setting });
});

app.post('/api/settings/:documentTypeId/requirements', async (c) => {
  const parsed = requirementSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.flatten());
  const documentTypeId = c.req.param('documentTypeId');
  const documentType = await db.query.documentTypes.findFirst({
    where: (table, { eq: isEqual }) => isEqual(table.id, documentTypeId),
  });
  if (!documentType) return c.json({ error: 'Document type not found' }, 404);
  const [requirement] = await db.insert(requirements).values({ documentTypeId, text: parsed.data.text }).returning();
  return c.json({ requirement }, 201);
});

app.patch('/api/settings/:documentTypeId/requirements/:requirementId', async (c) => {
  const parsed = requirementSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.flatten());
  const [requirement] = await db.update(requirements).set({ text: parsed.data.text })
    .where(and(eq(requirements.id, c.req.param('requirementId')), eq(requirements.documentTypeId, c.req.param('documentTypeId'))))
    .returning();
  if (!requirement) return c.json({ error: 'Requirement not found' }, 404);
  return c.json({ requirement });
});

app.delete('/api/settings/:documentTypeId/requirements/:requirementId', async (c) => {
  const [requirement] = await db.delete(requirements)
    .where(and(eq(requirements.id, c.req.param('requirementId')), eq(requirements.documentTypeId, c.req.param('documentTypeId'))))
    .returning();
  if (!requirement) return c.json({ error: 'Requirement not found' }, 404);
  return c.body(null, 204);
});

app.get('/api/portal/:token', async (c) => {
  const subcontractor = await db.query.subcontractors.findFirst({
    where: eq(subcontractors.portalToken, c.req.param('token')),
    with: requestWithType,
  });
  if (!subcontractor) return c.json({ error: 'Portal not found' }, 404);
  return c.json({ subcontractor: serializePortalSubcontractor(subcontractor) });
});

app.post(
  '/api/portal/:token/requests/:id/upload',
  bodyLimit({
    maxSize: MAX_UPLOAD_REQUEST_BYTES,
    onError: (c) => c.json({ error: 'Files must be 10 MB or smaller' }, 413),
  }),
  async (c) => {
    const request = await db.query.documentRequests.findFirst({
      where: eq(documentRequests.id, c.req.param('id')),
      with: { subcontractor: true },
    });
    if (!request || request.subcontractor.portalToken !== c.req.param('token')) {
      return c.json({ error: 'Document request not found' }, 404);
    }

    const form = await c.req.parseBody();
    const candidate = Array.isArray(form.file) ? form.file[0] : form.file;
    if (!isUploadedFile(candidate)) return c.json({ error: 'A file is required' }, 400);
    if (candidate.size === 0) return c.json({ error: 'The selected file is empty' }, 400);
    if (candidate.size > MAX_UPLOAD_BYTES) {
      return c.json({ error: 'Files must be 10 MB or smaller' }, 413);
    }
    if (candidate.type !== 'application/pdf' && !candidate.type.startsWith('image/')) {
      return c.json({ error: 'Only PDF and image files are accepted' }, 415);
    }

    const filename = candidate.name.replaceAll(/[\\/]/g, '_').slice(0, 200) || 'document';
    const storagePath = `requests/${request.id}/${randomUUID()}-${filename}`;
    try {
      await storeDocument({
        path: storagePath,
        body: new Uint8Array(await candidate.arrayBuffer()),
        contentType: candidate.type,
      });
    } catch (error) {
      console.error('Document upload failed', error);
      return c.json({ error: 'Unable to store the document. Please try again.' }, 503);
    }

    const [version] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(documentVersions)
        .values({
          requestId: request.id,
          storagePath,
          filename,
          mimeType: candidate.type,
          sizeBytes: candidate.size,
        })
        .returning();
      await tx
        .update(documentRequests)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(eq(documentRequests.id, request.id));
      return created;
    });

    // This remains detached so Gemini never blocks a successful file upload.
    void queueAiReview(version.id);
    return c.json({ version: { ...version, storagePath: undefined } }, 201);
  },
);

app.get('/api/subcontractors/:subcontractorId/requests/:requestId/versions/:versionId/download', async (c) => {
  const version = await db.query.documentVersions.findFirst({
    where: and(eq(documentVersions.id, c.req.param('versionId')), eq(documentVersions.requestId, c.req.param('requestId'))),
    with: { request: true },
  });
  if (!version || version.request.subcontractorId !== c.req.param('subcontractorId')) {
    return c.json({ error: 'Document version not found' }, 404);
  }

  try {
    const url = await getDocumentDownloadUrl({ path: version.storagePath, filename: version.filename });
    return c.json({ url });
  } catch (error) {
    console.error('Document download URL failed', error);
    return c.json({ error: 'Unable to prepare the download. Please try again.' }, 503);
  }
});

app.post('/api/subcontractors/:subcontractorId/requests/:requestId/versions/:versionId/ai-review', async (c) => {
  const version = await db.query.documentVersions.findFirst({
    where: and(eq(documentVersions.id, c.req.param('versionId')), eq(documentVersions.requestId, c.req.param('requestId'))),
    with: { request: true },
  });
  if (!version || version.request.subcontractorId !== c.req.param('subcontractorId')) {
    return c.json({ error: 'Document version not found' }, 404);
  }
  await queueAiReview(version.id);
  return c.json({ queued: true }, 202);
});

app.patch('/api/subcontractors/:subcontractorId/requests/:requestId/review', async (c) => {
  const parsed = documentReviewDecisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.flatten());

  const request = await db.query.documentRequests.findFirst({
    where: eq(documentRequests.id, c.req.param('requestId')),
  });
  if (!request || request.subcontractorId !== c.req.param('subcontractorId')) {
    return c.json({ error: 'Document request not found' }, 404);
  }

  const version = await db.query.documentVersions.findFirst({
    where: eq(documentVersions.requestId, request.id),
    orderBy: [desc(documentVersions.uploadedAt)],
  });
  if (!version) return c.json({ error: 'Upload a document before reviewing it' }, 409);

  const now = new Date();
  const [updatedVersion] = await db.transaction(async (tx) => {
    const updated = await tx
      .update(documentVersions)
      .set({
        humanReview: parsed.data.humanReview,
        decidedStatus: parsed.data.status,
        decidedAt: now,
      })
      .where(eq(documentVersions.id, version.id))
      .returning();
    await tx
      .update(documentRequests)
      .set({ status: parsed.data.status, updatedAt: now })
      .where(eq(documentRequests.id, request.id));
    return updated;
  });

  return c.json({ version: { ...updatedVersion, storagePath: undefined } });
});

export type AppType = typeof app;
export { app };
