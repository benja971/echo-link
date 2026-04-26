import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getFileById, deleteFile } from '$server/files';
import { s3DeleteObject } from '$server/s3';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.session) throw error(401, 'unauthorized');

  const file = await getFileById(params.id);
  if (!file) throw error(404, 'not_found');

  // Ownership check — only the account owner can delete. Anonymous uploads
  // (account_id === null) cannot be deleted via the authenticated endpoint.
  if (!file.accountId || file.accountId !== locals.session.accountId) {
    throw error(403, 'forbidden');
  }

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
