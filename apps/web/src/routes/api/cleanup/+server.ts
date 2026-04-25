import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { deleteExpiredFiles } from '$server/files';
import { s3DeleteObject } from '$server/s3';

export const POST: RequestHandler = async ({ request }) => {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw error(401, 'unauthorized');
  const expected = process.env.CLEANUP_TOKEN;
  if (!expected || auth.slice(7) !== expected) throw error(401, 'unauthorized');

  const expired = await deleteExpiredFiles();
  for (const f of expired) {
    try {
      await s3DeleteObject(f.s3Key);
      if (f.thumbnailS3Key) await s3DeleteObject(f.thumbnailS3Key);
    } catch (err) {
      console.warn('[cleanup] s3 delete failed:', f.s3Key, err);
    }
  }
  return json({ deleted: expired.length });
};
