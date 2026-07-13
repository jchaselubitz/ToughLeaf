import { Resend } from 'resend';
import { and, eq, ne } from 'drizzle-orm';
import { db, documentRequests, emailLog, type emailKindEnum } from './db';

type EmailKind = (typeof emailKindEnum.enumValues)[number];

type EmailRequest = {
  id: string;
  dueDate: string | null;
  status: string;
  documentType: { name: string; sortOrder: number };
};

type EmailSubcontractor = {
  id: string;
  name: string;
  email: string;
  portalToken: string;
};

export type EmailLogEntry = typeof emailLog.$inferSelect;

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function portalUrl(token: string) {
  const baseUrl = process.env.APP_BASE_URL?.trim() || 'http://localhost:5173';
  return new URL(`/portal/${encodeURIComponent(token)}`, baseUrl).toString();
}

function formatDueDate(value: string | null) {
  if (!value) return 'No due date set';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

function renderEmail({ kind, subcontractor, requests }: { kind: EmailKind; subcontractor: EmailSubcontractor; requests: EmailRequest[] }) {
  const link = portalUrl(subcontractor.portalToken);
  const initial = kind === 'request';
  const subject = initial ? 'Action required: submit your compliance documents' : 'Reminder: outstanding compliance documents';
  const lead = initial
    ? 'Please use the secure portal below to submit the requested compliance documents.'
    : 'This is a reminder that the following compliance documents are still outstanding.';
  const rows = requests
    .sort((a, b) => a.documentType.sortOrder - b.documentType.sortOrder)
    .map((request) => `<li><strong>${escapeHtml(request.documentType.name)}</strong> — due ${escapeHtml(formatDueDate(request.dueDate))}</li>`)
    .join('');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#172033"><p>Hello ${escapeHtml(subcontractor.name)},</p><p>${lead}</p><ul>${rows}</ul><p><a href="${escapeHtml(link)}">Open your document portal</a></p><p>Thank you,<br>Tough Leaf Compliance</p></body></html>`;
  const text = `Hello ${subcontractor.name},\n\n${lead}\n\n${requests.map((request) => `- ${request.documentType.name} — due ${formatDueDate(request.dueDate)}`).join('\n')}\n\nOpen your document portal: ${link}\n\nThank you,\nTough Leaf Compliance`;
  return { subject, html, text };
}

/** Sends a request or reminder, falling back to a logged preview when no Resend key is configured. */
export async function sendDocumentEmail(subcontractor: EmailSubcontractor, kind: EmailKind): Promise<EmailLogEntry> {
  const outstandingOnly = kind === 'follow_up';
  const requests = await db.query.documentRequests.findMany({
    where: outstandingOnly
      ? and(eq(documentRequests.subcontractorId, subcontractor.id), ne(documentRequests.status, 'accepted'))
      : eq(documentRequests.subcontractorId, subcontractor.id),
    with: { documentType: true },
    orderBy: (table, { asc: orderAsc }) => [orderAsc(table.dueDate)],
  });
  if (requests.length === 0) throw new Error('There are no outstanding document requests to include in a follow-up.');

  const message = renderEmail({ kind, subcontractor, requests });
  return deliverEmail(subcontractor, kind, message);
}

/** A single failing requirement plus the (Gemini-drafted, human-confirmed) message shown to the sub. */
export type FailingRequirement = { requirement: string; reason: string };

function renderIncompleteEmail({ subcontractor, documentTypeName, failing, message }: {
  subcontractor: EmailSubcontractor;
  documentTypeName: string;
  failing: FailingRequirement[];
  message?: string;
}) {
  const link = portalUrl(subcontractor.portalToken);
  const subject = `Action required: ${documentTypeName} needs corrections`;
  const lead = `We reviewed your ${documentTypeName} and it cannot be accepted yet. Please address the following before re-submitting through your portal.`;
  const items = failing
    .map((item) => `<li><strong>${escapeHtml(item.requirement)}</strong>${item.reason ? ` — ${escapeHtml(item.reason)}` : ''}</li>`)
    .join('');
  const overall = message?.trim()
    ? `<p>${escapeHtml(message.trim())}</p>`
    : '';
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#172033"><p>Hello ${escapeHtml(subcontractor.name)},</p><p>${lead}</p>${items ? `<ul>${items}</ul>` : ''}${overall}<p><a href="${escapeHtml(link)}">Open your document portal</a></p><p>Thank you,<br>Tough Leaf Compliance</p></body></html>`;
  const textItems = failing.map((item) => `- ${item.requirement}${item.reason ? `: ${item.reason}` : ''}`).join('\n');
  const text = `Hello ${subcontractor.name},\n\n${lead}\n\n${textItems}${message?.trim() ? `\n\n${message.trim()}` : ''}\n\nOpen your document portal: ${link}\n\nThank you,\nTough Leaf Compliance`;
  return { subject, html, text };
}

async function deliverEmail(subcontractor: EmailSubcontractor, kind: EmailKind, message: { subject: string; html: string; text: string }): Promise<EmailLogEntry> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  let resendId: string | null = null;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM?.trim() || 'Tough Leaf <onboarding@resend.dev>',
      to: subcontractor.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error || !data?.id) throw new Error(error?.message || 'Resend did not return a delivery ID.');
    resendId = data.id;
  }

  const [entry] = await db.insert(emailLog).values({
    subcontractorId: subcontractor.id,
    kind,
    toEmail: subcontractor.email,
    subject: message.subject,
    resendId,
    previewHtml: message.html,
  }).returning();
  return entry;
}

/**
 * Notify the subcontractor that a document was marked incomplete, listing each
 * failing requirement with its message and a link back to their portal page.
 */
export async function sendIncompleteEmail(
  subcontractor: EmailSubcontractor,
  input: { documentTypeName: string; failing: FailingRequirement[]; message?: string },
): Promise<EmailLogEntry> {
  const message = renderIncompleteEmail({ subcontractor, documentTypeName: input.documentTypeName, failing: input.failing, message: input.message });
  return deliverEmail(subcontractor, 'incomplete', message);
}

export function isPreviewEmail(entry: EmailLogEntry) {
  return entry.resendId === null;
}
