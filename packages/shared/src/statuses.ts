import { z } from 'zod';

/**
 * Lifecycle status stored on a document_request.
 * `requested -> submitted -> (accepted | incomplete)`; `incomplete -> submitted`
 * on re-upload. **Overdue is derived** (`requested && now > due_date`), never stored.
 */
export const DOCUMENT_STATUSES = ['requested', 'submitted', 'incomplete', 'accepted'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

/** Human review outcome recorded on a specific version. */
export const DECIDED_STATUSES = ['accepted', 'incomplete'] as const;
export type DecidedStatus = (typeof DECIDED_STATUSES)[number];
export const decidedStatusSchema = z.enum(DECIDED_STATUSES);

/** Kinds of email tracked in email_log (doubles as the good-faith-efforts trail). */
export const EMAIL_KINDS = ['request', 'follow_up'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];
export const emailKindSchema = z.enum(EMAIL_KINDS);
