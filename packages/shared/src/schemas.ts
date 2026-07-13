import { z } from 'zod';
import { decidedStatusSchema } from './statuses';
import { reviewResultSchema } from './review';

/**
 * API input schemas (Zod v4). Shared across the API (validation) and the web app
 * (form typing). Table-derived schemas via `drizzle-zod` live with the DB layer.
 */

/** Add-subcontractor modal: name, email, and a single due date applied to all 5 requests. */
export const createSubcontractorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.email('A valid email is required'),
  /** ISO date (YYYY-MM-DD); written onto each created document_request. */
  dueDate: z.iso.date(),
  certificationType: z.string().trim().min(1).optional(),
});
export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>;

/** Editable fields on the subcontractor detail page. */
export const updateSubcontractorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.email().optional(),
  dueDate: z.iso.date().optional(),
  certificationType: z.string().trim().min(1).nullable().optional(),
});
export type UpdateSubcontractorInput = z.infer<typeof updateSubcontractorSchema>;

/** Internal, never-shown-to-the-sub note. */
export const updateNoteSchema = z.object({
  note: z.string(),
});
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

/** A human decision attached to the current immutable document version. */
export const documentReviewDecisionSchema = z
  .object({
    status: decidedStatusSchema,
    humanReview: reviewResultSchema,
  })
  .superRefine(({ status, humanReview }, context) => {
    if (status !== 'incomplete') return;
    const hasReason = [humanReview.reason, ...humanReview.results.map((result) => result.reason)]
      .some((reason) => !!reason?.trim());
    if (!hasReason) {
      context.addIssue({
        code: 'custom',
        path: ['humanReview', 'reason'],
        message: 'An incomplete document requires a reason.',
      });
    }
  });
export type DocumentReviewDecisionInput = z.infer<typeof documentReviewDecisionSchema>;
