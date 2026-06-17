import { neon } from '@neondatabase/serverless';

let cached: ReturnType<typeof neon> | null = null;

/**
 * Lazily create the Neon SQL client.
 * Done lazily so `next build` doesn't require DATABASE_URL to be present.
 */
export function getSql(): ReturnType<typeof neon> {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Add it in your Vercel project environment variables.');
    }
    cached = neon(url);
  }
  return cached;
}

let schemaReady: Promise<void> | null = null;

/**
 * Bring an existing `prospects` table up to date before writing to it.
 *
 * The schema in `db/schema.sql` is run by hand, so a database created before
 * High Schools / the Coach column were added is missing the `contact_name`
 * column and the `highschool` type — which made every save of those rows fail
 * (and looked like "saved but not in the CRM"). These statements mirror
 * `db/migrations/*.sql`, are idempotent, and run once per server instance.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`alter table prospects add column if not exists contact_name text`;
      await sql`alter table prospects drop constraint if exists prospects_type_check`;
      await sql`alter table prospects add constraint prospects_type_check
        check (type in ('college', 'facility', 'league', 'highschool', 'other'))`;
    })().catch((err) => {
      // Let a transient failure be retried on the next request.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
