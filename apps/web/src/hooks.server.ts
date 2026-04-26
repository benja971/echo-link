import type { Handle } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { decodeSession } from '$server/auth';
import { deleteExpiredFiles } from '$server/files';
import { s3DeleteObject } from '$server/s3';

// Hydrate process.env from SvelteKit's env so code reading process.env
// directly (e.g. @echo-link/db, our zod env schema) gets the right values
// in dev. Vite/SvelteKit loads .env into its own env modules, not process.env.
for (const source of [privateEnv, publicEnv]) {
  for (const [key, value] of Object.entries(source)) {
    if (process.env[key] === undefined && typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

let _scheduled = false;
function ensureScheduler() {
  if (_scheduled) return;
  _scheduled = true;
  const runOnce = async () => {
    try {
      const expired = await deleteExpiredFiles();
      for (const f of expired) {
        try {
          await s3DeleteObject(f.s3Key);
          if (f.thumbnailS3Key) await s3DeleteObject(f.thumbnailS3Key);
        } catch (err) {
          console.warn('[scheduled-cleanup] s3 fail:', f.s3Key, err);
        }
      }
      if (expired.length > 0) console.log(`[scheduled-cleanup] removed ${expired.length}`);
    } catch (err) {
      console.error('[scheduled-cleanup] error:', err);
    }
  };
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const ms = nextMidnight.getTime() - now.getTime();
  setTimeout(() => {
    runOnce();
    setInterval(runOnce, 24 * 60 * 60 * 1000);
  }, ms);
}

export const handle: Handle = async ({ event, resolve }) => {
  ensureScheduler();
  const cookie = event.cookies.get('session');
  event.locals.session = decodeSession(cookie);
  return resolve(event);
};
