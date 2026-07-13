import type { DocumentTypeSlug } from '@tl/shared';

/**
 * Seeded default requirements per document type (see planning/ai-review.md,
 * "Seeded default requirements"). One requirement = one row; each is sent to
 * Gemini with its id so results map back deterministically. Users can edit or
 * delete these in settings, so they ship with `seeded = true`.
 */
export const SEED_REQUIREMENTS: Record<DocumentTypeSlug, readonly string[]> = {
  insurance_certificate: [
    'Names the subcontractor as insured.',
    'General liability coverage present with limits shown.',
    'Additional insured endorsement present.',
    'Not expired / expiration date legible.',
  ],
  w9: [
    'Current IRS revision.',
    'Legal name and TIN present.',
    'Tax classification checked.',
    'Signed and dated.',
  ],
  certified_payroll: [
    'Project and contractor identified.',
    'Payroll number and week ending date present.',
    'Employee classifications and rates listed.',
    'Statement of compliance signed.',
  ],
  workforce_report: [
    'Reporting month identified.',
    'Workforce counts present.',
    'Totals internally consistent.',
  ],
  diversity_certification: [
    'Issuing agency identified.',
    'Certification type (DBE/MBE/WBE/SBE) stated.',
    'Business name matches.',
    'Not expired.',
  ],
};
