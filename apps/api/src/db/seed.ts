import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DOCUMENT_TYPE_META } from '@tl/shared';
import { getDatabaseUrl } from './env';
import * as schema from './schema';
import { SEED_REQUIREMENTS } from './seed-data';

/**
 * Idempotent seed: loads the 5 document types, their default seeded
 * requirements, and one empty settings row per type. Run with `yarn db:seed`
 * (after `yarn db:migrate`). Safe to re-run — doc types/settings upsert and
 * seeded requirements are only inserted when missing.
 */
async function main() {
  const client = postgres(getDatabaseUrl(), { max: 1 });
  const db = drizzle(client, { schema });

  try {
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

    console.log(
      `[db] seed complete: ${DOCUMENT_TYPE_META.length} document types, ` +
        `${insertedRequirements} new requirement(s) inserted`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db] seed failed:', err);
  process.exit(1);
});
