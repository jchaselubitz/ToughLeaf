import { GoogleGenAI, Type } from '@google/genai';
import { eq } from 'drizzle-orm';
import { reviewResultSchema, type ReviewResult } from '@tl/shared';
import { db, documentVersions, requirements } from './db';
import { getDocumentBytes } from './storage';

/** Gemini's schema keeps dynamic requirement labels in array values, not keys. */
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          requirement_id: { type: Type.STRING },
          requirement: { type: Type.STRING },
          pass: { type: Type.BOOLEAN },
          reason: { type: Type.STRING, description: 'Required for failed requirements; cite what was seen or missing.' },
        },
        required: ['requirement_id', 'requirement', 'pass'],
      },
    },
    extracted: {
      type: Type.OBJECT,
      properties: { expiry_date: { type: Type.STRING, description: 'ISO date, insurance certificates only.' } },
    },
    summary: { type: Type.STRING },
  },
  required: ['results'],
};

const documentTypeGuidance: Record<string, string> = {
  insurance_certificate: 'This is a certificate of insurance (COI). Check named insured, coverage, endorsements, and expiration information.',
  w9: 'This is an IRS Form W-9. Check the taxpayer identity, TIN, classification, revision, signature, and date.',
  certified_payroll: 'This is a certified payroll report (WH-347). Check project, contractor, payroll period, worker classifications and rates, and statement of compliance.',
  workforce_report: 'This is a monthly workforce report. Check the reporting month, workforce counts, and whether stated totals reconcile.',
  diversity_certification: 'This is a business diversity certification. Check the issuing agency, certification type, business identity, and expiration.',
};

function buildPrompt(input: {
  documentTypeName: string;
  documentTypeId: string;
  requirements: Array<{ id: string; text: string }>;
  additionalInstructions: string;
}) {
  return [
    'You are an advisory compliance-document reviewer. A human makes every final decision.',
    `Review this ${input.documentTypeName} (${input.documentTypeId}). Evaluate each requirement independently.`,
    documentTypeGuidance[input.documentTypeId] ?? 'Determine whether the uploaded document satisfies the listed compliance requirements.',
    'Use only evidence visible in the uploaded file. If evidence is absent, illegible, or uncertain, fail that requirement and say exactly what is missing or observed. Return each supplied requirement_id once and do not invent requirements.',
    'For insurance certificates, extract a legible expiration date as YYYY-MM-DD; otherwise omit expiry_date. Never infer a date.',
    `Requirements:\n${JSON.stringify(input.requirements)}`,
    `Additional compliance-team instructions:\n${input.additionalInstructions.trim() || '(none)'}`,
  ].join('\n\n');
}

function unavailableMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('AI document review failed', error);
  return detail.includes('GEMINI_API_KEY')
    ? 'AI review is unavailable because Gemini is not configured. Retry after configuration.'
    : 'AI review was unavailable. Please retry.';
}

/** Clear prior output and launch a detached review: uploads remain successful without Gemini. */
export async function queueAiReview(versionId: string) {
  await db.update(documentVersions)
    .set({ aiReview: null, aiReviewedAt: null, aiReviewError: null, extracted: null })
    .where(eq(documentVersions.id, versionId));
  void runAiReview(versionId);
}

async function runAiReview(versionId: string) {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    const version = await db.query.documentVersions.findFirst({
      where: eq(documentVersions.id, versionId),
      with: { request: { with: { documentType: true } } },
    });
    if (!version) throw new Error('Document version no longer exists');

    const [requirementRows, setting, bytes] = await Promise.all([
      db.select({ id: requirements.id, text: requirements.text }).from(requirements)
        .where(eq(requirements.documentTypeId, version.request.documentTypeId)),
      db.query.settings.findFirst({
        where: (table, { eq: isEqual }) => isEqual(table.documentTypeId, version.request.documentTypeId),
      }),
      getDocumentBytes(version.storagePath),
    ]);
    if (!requirementRows.length) throw new Error('No requirements are configured for this document type');

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [
        { text: buildPrompt({ documentTypeName: version.request.documentType.name, documentTypeId: version.request.documentTypeId, requirements: requirementRows, additionalInstructions: setting?.additionalInstructions ?? '' }) },
        { inlineData: { mimeType: version.mimeType, data: Buffer.from(bytes).toString('base64') } },
      ] }],
      config: { responseMimeType: 'application/json', responseSchema, temperature: 0.1 },
    });
    const parsed = reviewResultSchema.safeParse(JSON.parse(response.text || ''));
    if (!parsed.success) throw new Error('Gemini returned an invalid review payload');

    const returned = new Map(parsed.data.results.map((result) => [result.requirement_id, result]));
    const review: ReviewResult = {
      results: requirementRows.map((requirement) => {
        const result = returned.get(requirement.id);
        return result
          ? { ...result, requirement_id: requirement.id, requirement: requirement.text }
          : { requirement_id: requirement.id, requirement: requirement.text, pass: false, reason: 'AI did not return a verdict for this requirement.' };
      }),
      extracted: parsed.data.extracted,
      summary: parsed.data.summary,
    };
    await db.update(documentVersions)
      .set({ aiReview: review, extracted: review.extracted, aiReviewedAt: new Date(), aiReviewError: null })
      .where(eq(documentVersions.id, versionId));
  } catch (error) {
    await db.update(documentVersions)
      .set({ aiReview: null, aiReviewedAt: null, extracted: null, aiReviewError: unavailableMessage(error) })
      .where(eq(documentVersions.id, versionId));
  }
}
