import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DOCUMENT_TYPE_META } from '@tl/shared';
import { getDatabaseUrl } from './env';
import * as schema from './schema';
import { DEMO_SUBCONTRACTORS, SEED_REQUIREMENTS } from './seed-data';

/**
 * Reset-and-seed script for the demo. It clears all application data, then
 * loads the 5 document types, their default requirements/settings, and four
 * believable subcontractors. Run with `yarn db:seed` (after `yarn db:migrate`).
 */
async function main() {
  const client = postgres(getDatabaseUrl(), { max: 1 });
  const db = drizzle(client, { schema });

  try {
    // All application tables are reset together so re-seeding produces a
    // known demo state with no stale documents, emails, or subcontractors.
    await db.execute(sql`
      TRUNCATE TABLE
        email_log,
        document_versions,
        document_requests,
        requirements,
        settings,
        subcontractors,
        document_types
      RESTART IDENTITY CASCADE
    `);

    let insertedRequirements = 0;

    for (const meta of DOCUMENT_TYPE_META) {
      // Upsert the document type from the shared display metadata.
      await db
        .insert(schema.documentTypes)
        .values({
          id: meta.slug,
          name: meta.name,
          description: meta.description,
          recurring: meta.recurring,
          sortOrder: meta.sortOrder,
        })
        .onConflictDoUpdate({
          target: schema.documentTypes.id,
          set: {
            name: meta.name,
            description: meta.description,
            recurring: meta.recurring,
            sortOrder: meta.sortOrder,
          },
        });

      // One empty additional-instructions settings row per doc type.
      await db
        .insert(schema.settings)
        .values({ documentTypeId: meta.slug })
        .onConflictDoNothing({ target: schema.settings.documentTypeId });

      // Seeded requirements: insert each default only if that exact text is not
      // already present for this doc type, so re-running never duplicates and
      // never clobbers user edits.
      for (const text of SEED_REQUIREMENTS[meta.slug]) {
        const existing = await db
          .select({ id: schema.requirements.id })
          .from(schema.requirements)
          .where(
            and(
              eq(schema.requirements.documentTypeId, meta.slug),
              eq(schema.requirements.text, text),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(schema.requirements).values({
            documentTypeId: meta.slug,
            text,
            seeded: true,
          });
          insertedRequirements += 1;
        }
      }
    }

    for (const demo of DEMO_SUBCONTRACTORS) {
      const [subcontractor] = await db
        .insert(schema.subcontractors)
        .values({
          name: demo.name,
          email: demo.email,
          certificationType: demo.certificationType,
          note: demo.note,
          portalToken: randomBytes(32).toString('base64url'),
        })
        .returning();

      const dueDate = new Date(Date.now() + demo.dueInDays * 86_400_000)
        .toISOString()
        .slice(0, 10);
      await db.insert(schema.documentRequests).values(
        DOCUMENT_TYPE_META.map((meta) => ({
          subcontractorId: subcontractor.id,
          documentTypeId: meta.slug,
          dueDate,
        })),
      );
    }

    console.log(
      `[db] seed complete: ${DOCUMENT_TYPE_META.length} document types, ` +
        `${insertedRequirements} requirement(s) inserted, ${DEMO_SUBCONTRACTORS.length} demo subcontractors ready`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db] seed failed:', err);
  process.exit(1);
});
