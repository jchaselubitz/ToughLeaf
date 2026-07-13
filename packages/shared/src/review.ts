import { z } from 'zod';

/**
 * One requirement verdict from the AI (or its human-corrected mirror).
 * `requirement_id` maps back to a `requirements` row (or a built-in slug) so the
 * verdict is deterministic even though requirement names are dynamic.
 */
export const reviewRequirementResultSchema = z.object({
  requirement_id: z.string(),
  requirement: z.string(),
  pass: z.boolean(),
  /** Required (by convention) when `pass` is false: cite what was seen or missing. */
  reason: z.string().optional(),
});
export type ReviewRequirementResult = z.infer<typeof reviewRequirementResultSchema>;

/** AI-extracted metadata, e.g. COI expiry. Kept loose; expiry_date is the known key. */
export const reviewExtractedSchema = z
  .object({
    expiry_date: z.string().optional(),
  })
  .loose();
export type ReviewExtracted = z.infer<typeof reviewExtractedSchema>;

/**
 * Full review payload stored verbatim on a document_version. `ai_review` and
 * `human_review` share this shape (parallel keys) so we always retain what the
 * AI said vs. what the human decided. See planning/ai-review.md.
 */
export const reviewResultSchema = z.object({
  results: z.array(reviewRequirementResultSchema),
  extracted: reviewExtractedSchema.optional(),
  summary: z.string().optional(),
  /** Human-entered explanation shown to the subcontractor for an incomplete document. */
  reason: z.string().optional(),
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;
