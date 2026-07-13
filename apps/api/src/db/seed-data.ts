import type { DocumentTypeSlug } from '@tl/shared';

export const DEMO_SUBCONTRACTORS = [
  {
    name: 'Harbor Point Electric LLC',
    email: 'compliance@harborpointelectric.example',
    certificationType: 'WBE',
    note: 'Commercial electrician serving tenant-improvement and multifamily projects.',
    dueInDays: -7,
  },
  {
    name: 'Summit Ridge Electrical Contractors, Inc.',
    email: 'documents@summitridgeelectric.example',
    certificationType: 'MBE',
    note: 'Electrical contractor focused on lighting controls, low-voltage, and service upgrades.',
    dueInDays: 3,
  },
  {
    name: 'Keystone Plumbing & Mechanical LLC',
    email: 'compliance@keystoneplumbing.example',
    certificationType: 'SBE',
    note: 'Licensed plumbing subcontractor for commercial build-outs and renovation work.',
    dueInDays: 14,
  },
  {
    name: 'Alder & Ash Interiors LLC',
    email: 'studio@alderashinteriors.example',
    certificationType: 'WBE',
    note: 'Interior decorator providing finish selection, furnishing, and installation coordination.',
    dueInDays: 21,
  },
] as const;

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
