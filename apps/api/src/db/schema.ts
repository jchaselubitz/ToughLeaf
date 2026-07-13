import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  DECIDED_STATUSES,
  DOCUMENT_STATUSES,
  EMAIL_KINDS,
  type ReviewExtracted,
  type ReviewResult,
} from '@tl/shared';

/**
 * Drizzle schema for the compliance data model (see planning/data-model.md).
 *
 * Three-layer document model: type -> request -> version. Status and due date
 * live on the *request*; files, AI output, and human review live on immutable
 * *versions*. Postgres enum names reuse the `@tl/shared` string arrays so the
 * DB, API, and client all agree on the allowed values.
 */

// --- Enums (values sourced from @tl/shared) ---
export const documentStatusEnum = pgEnum('document_status', DOCUMENT_STATUSES);
export const decidedStatusEnum = pgEnum('decided_status', DECIDED_STATUSES);
export const emailKindEnum = pgEnum('email_kind', EMAIL_KINDS);

// --- subcontractors ---
export const subcontractors = pgTable('subcontractors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  /** Long random token; identifies the sub portal URL (/portal/:token). */
  portalToken: text('portal_token').notNull().unique(),
  /** Internal note, never shown to the sub. */
  note: text('note').notNull().default(''),
  /** e.g. DBE/MBE/WBE/SBE — future dashboard rollup. */
  certificationType: text('certification_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- document_types (seeded; text slug pk) ---
export const documentTypes = pgTable('document_types', {
  /** Slug pk, e.g. `insurance_certificate` (see DOCUMENT_TYPE_SLUGS). */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  /** Informational for now; no period UI in the demo. */
  recurring: boolean('recurring').notNull().default(false),
  sortOrder: integer('sort_order').notNull(),
});

// --- document_requests (one row per subcontractor x document type) ---
export const documentRequests = pgTable(
  'document_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subcontractorId: uuid('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'cascade' }),
    documentTypeId: text('document_type_id')
      .notNull()
      .references(() => documentTypes.id, { onDelete: 'restrict' }),
    status: documentStatusEnum('status').notNull().default('requested'),
    /** Initialized from the add-subcontractor modal; overdue is derived, not stored. */
    dueDate: date('due_date'),
    /** Unused in the demo; reserved for recurring docs. */
    period: text('period'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One request per (subcontractor, document type, period). NULLS NOT
    // DISTINCT so the demo's null period still enforces one row per sub x type.
    unique('document_requests_sub_type_period_uq')
      .on(table.subcontractorId, table.documentTypeId, table.period)
      .nullsNotDistinct(),
  ],
);

// --- document_versions (immutable; a new upload = a new row) ---
export const documentVersions = pgTable('document_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => documentRequests.id, { onDelete: 'cascade' }),
  /** Private bucket key; downloads via short-lived signed URL. */
  storagePath: text('storage_path').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  /** Full AI result tied to THIS version (see planning/ai-review.md). */
  aiReview: jsonb('ai_review').$type<ReviewResult>(),
  aiReviewedAt: timestamp('ai_reviewed_at', { withTimezone: true }),
  /** Error from the most recent advisory AI attempt; does not block human review. */
  aiReviewError: text('ai_review_error'),
  /** AI-extracted metadata, e.g. `{ "expiry_date": "2026-09-01" }` for COIs. */
  extracted: jsonb('extracted').$type<ReviewExtracted>(),
  /** Parallel per-requirement human decisions (mirrors ai_review's shape). */
  humanReview: jsonb('human_review').$type<ReviewResult>(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedStatus: decidedStatusEnum('decided_status'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- requirements (settings +/- table; one requirement per row) ---
export const requirements = pgTable('requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentTypeId: text('document_type_id')
    .notNull()
    .references(() => documentTypes.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  /** Shipped default; user can edit/delete. */
  seeded: boolean('seeded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- settings (per-doc-type additional instructions appended to the AI prompt) ---
export const settings = pgTable('settings', {
  /** One row per doc type; pk is the document_type slug. */
  documentTypeId: text('document_type_id')
    .primaryKey()
    .references(() => documentTypes.id, { onDelete: 'cascade' }),
  additionalInstructions: text('additional_instructions').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- email_log (also the good-faith-efforts paper trail) ---
export const emailLog = pgTable('email_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  subcontractorId: uuid('subcontractor_id')
    .notNull()
    .references(() => subcontractors.id, { onDelete: 'cascade' }),
  kind: emailKindEnum('kind').notNull(),
  toEmail: text('to_email').notNull(),
  subject: text('subject').notNull(),
  /** Null when running without a Resend key (preview mode). */
  resendId: text('resend_id'),
  /** Rendered body retained for preview-mode sends and the internal audit trail. */
  previewHtml: text('preview_html').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Relations (power Drizzle's nested relational reads) ---
export const subcontractorsRelations = relations(subcontractors, ({ many }) => ({
  documentRequests: many(documentRequests),
  emailLog: many(emailLog),
}));

export const documentTypesRelations = relations(documentTypes, ({ many, one }) => ({
  documentRequests: many(documentRequests),
  requirements: many(requirements),
  settings: one(settings),
}));

export const documentRequestsRelations = relations(documentRequests, ({ one, many }) => ({
  subcontractor: one(subcontractors, {
    fields: [documentRequests.subcontractorId],
    references: [subcontractors.id],
  }),
  documentType: one(documentTypes, {
    fields: [documentRequests.documentTypeId],
    references: [documentTypes.id],
  }),
  versions: many(documentVersions),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  request: one(documentRequests, {
    fields: [documentVersions.requestId],
    references: [documentRequests.id],
  }),
}));

export const requirementsRelations = relations(requirements, ({ one }) => ({
  documentType: one(documentTypes, {
    fields: [requirements.documentTypeId],
    references: [documentTypes.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  documentType: one(documentTypes, {
    fields: [settings.documentTypeId],
    references: [documentTypes.id],
  }),
}));

export const emailLogRelations = relations(emailLog, ({ one }) => ({
  subcontractor: one(subcontractors, {
    fields: [emailLog.subcontractorId],
    references: [subcontractors.id],
  }),
}));

// --- Inferred row types for use across the API ---
export type Subcontractor = typeof subcontractors.$inferSelect;
export type NewSubcontractor = typeof subcontractors.$inferInsert;
export type DocumentType = typeof documentTypes.$inferSelect;
export type DocumentRequest = typeof documentRequests.$inferSelect;
export type NewDocumentRequest = typeof documentRequests.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type Requirement = typeof requirements.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type EmailLogEntry = typeof emailLog.$inferSelect;
