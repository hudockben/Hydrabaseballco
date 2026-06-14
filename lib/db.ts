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
