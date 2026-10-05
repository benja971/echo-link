import { eq } from 'drizzle-orm';
import { getDb, files } from '@echo-link/db';

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESERVED = new Set([
  'app',
  'api',
  'login',
  'logout',
  'v',
  'files',
  'discord',
  'privacy',
  'auth',
  'share-target',
  'static',
  'sw',
  'sw.js',
  'manifest',
  'manifest.webmanifest',
  'favicon',
  'robots',
  'admin'
]);

export type SlugValidationError =
  | 'too_short'
  | 'too_long'
  | 'invalid_chars'
  | 'reserved'
  | 'looks_like_uuid';

export function validateSlug(slug: string): SlugValidationError | null {
  if (slug.length < SLUG_MIN) return 'too_short';
  if (slug.length > SLUG_MAX) return 'too_long';
  if (UUID_RE.test(slug)) return 'looks_like_uuid';
  if (!SLUG_RE.test(slug)) return 'invalid_chars';
  if (RESERVED.has(slug)) return 'reserved';
  return null;
}

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Lowercase, strip diacritics, collapse non-alphanumerics into single
 *  hyphens, trim hyphens at the edges. Returns the empty string if the
 *  input has no usable characters. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, SLUG_MAX);
}

/** Build a slug candidate from a title (filename minus extension by then),
 *  fall back to the file id when the title yields nothing usable. The
 *  returned value is guaranteed to pass validateSlug() OR be `null`. */
export function deriveSlugFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const base = slugify(title);
  if (base.length < SLUG_MIN) return null;
  if (validateSlug(base) !== null) return null;
  return base;
}

/** Find an unused slug by appending `-2`, `-3`, … to the candidate.
 *  Trims the base if needed to keep the suffix within SLUG_MAX. */
export async function findAvailableSlug(base: string): Promise<string> {
  const db = getDb();
  let candidate = base;
  let n = 2;
  while (true) {
    const existing = await db
      .select({ id: files.id })
      .from(files)
      .where(eq(files.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    const suffix = `-${n}`;
    const trimmed = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '');
    candidate = trimmed + suffix;
    n += 1;
    if (n > 1000) throw new Error('slug_exhausted');
  }
}
