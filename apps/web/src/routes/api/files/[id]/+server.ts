import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getFileById, deleteFile, getFileBySlug, updateFileMetadata } from '$server/files';
import { s3DeleteObject } from '$server/s3';
import { validateSlug } from '$server/slug';

const TITLE_MAX = 200;

async function loadOwned(id: string, accountId: string) {
  const file = await getFileById(id);
  if (!file) throw error(404, 'not_found');
  if (!file.accountId || file.accountId !== accountId) throw error(403, 'forbidden');
  return file;
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.session) throw error(401, 'unauthorized');

  const file = await loadOwned(params.id, locals.session.accountId);

  // Best-effort S3 deletion — if it fails the DB row is still removed so
  // the file disappears from the UI; orphaned S3 keys are GC'd by the
  // nightly cleanup of expired files (eventually) or via mc lifecycle.
  try {
    await s3DeleteObject(file.s3Key);
    if (file.thumbnailS3Key) await s3DeleteObject(file.thumbnailS3Key);
  } catch (err) {
    console.warn('[delete] s3 delete failed:', file.s3Key, err);
  }

  await deleteFile(file.id);
  return json({ ok: true });
};

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  if (!locals.session) throw error(401, 'unauthorized');

  const file = await loadOwned(params.id, locals.session.accountId);

  let body: { title?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid_json');
  }

  const patch: { title?: string | null; slug?: string | null } = {};

  if ('title' in body) {
    if (body.title === null || body.title === '') {
      patch.title = null;
    } else if (typeof body.title === 'string') {
      const trimmed = body.title.trim();
      if (trimmed.length > TITLE_MAX) throw error(400, 'title_too_long');
      patch.title = trimmed;
    } else {
      throw error(400, 'invalid_title');
    }
  }

  if ('slug' in body) {
    if (body.slug === null || body.slug === '') {
      patch.slug = null;
    } else if (typeof body.slug === 'string') {
      const candidate = body.slug.trim().toLowerCase();
      const reason = validateSlug(candidate);
      if (reason) throw error(400, `slug_${reason}`);
      // No-op when unchanged; otherwise check uniqueness ourselves to give
      // a clean error code instead of leaking a unique-constraint failure.
      if (candidate !== file.slug) {
        const taken = await getFileBySlug(candidate);
        if (taken && taken.id !== file.id) throw error(409, 'slug_taken');
      }
      patch.slug = candidate;
    } else {
      throw error(400, 'invalid_slug');
    }
  }

  if (Object.keys(patch).length === 0) {
    return json({ file });
  }

  const updated = await updateFileMetadata(file.id, patch);
  if (!updated) throw error(500, 'update_failed');
  return json({ file: updated });
};
