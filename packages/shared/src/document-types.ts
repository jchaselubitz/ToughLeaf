import { z } from 'zod';

/**
 * The five required document types, keyed by slug (the `document_types.id` pk).
 * Each subcontractor gets one document_request per slug when created.
 */
export const DOCUMENT_TYPE_SLUGS = [
  'insurance_certificate',
  'w9',
  'certified_payroll',
  'workforce_report',
  'diversity_certification',
] as const;
export type DocumentTypeSlug = (typeof DOCUMENT_TYPE_SLUGS)[number];
export const documentTypeSlugSchema = z.enum(DOCUMENT_TYPE_SLUGS);

/**
 * Display metadata for each document type. The database `document_types` table is
 * the source of truth once seeded (Phase 1); this constant mirrors those defaults
 * so the UI and seed script share one definition.
 */
export interface DocumentTypeMeta {
  slug: DocumentTypeSlug;
  name: string;
  description: string;
  recurring: boolean;
  sortOrder: number;
}

export const DOCUMENT_TYPE_META: readonly DocumentTypeMeta[] = [
  {
    slug: 'insurance_certificate',
    name: 'Insurance Certificate (COI)',
    description: 'Certificate of insurance naming the subcontractor, with general liability limits and additional insured endorsement.',
    recurring: false,
    sortOrder: 1,
  },
  {
    slug: 'w9',
    name: 'W-9',
    description: 'Current IRS W-9 with legal name, TIN, tax classification, signed and dated.',
    recurring: false,
    sortOrder: 2,
  },
  {
    slug: 'certified_payroll',
    name: 'Certified Payroll (WH-347)',
    description: 'Weekly certified payroll report with employee classifications, rates, and a signed statement of compliance.',
    recurring: true,
    sortOrder: 3,
  },
  {
    slug: 'workforce_report',
    name: 'Monthly Workforce Report',
    description: 'Monthly workforce counts by classification with internally consistent totals.',
    recurring: true,
    sortOrder: 4,
  },
  {
    slug: 'diversity_certification',
    name: 'Diversity Certification (DBE/MBE/WBE/SBE)',
    description: 'Certification from the issuing agency stating the certification type and business name; must not be expired.',
    recurring: false,
    sortOrder: 5,
  },
] as const;
