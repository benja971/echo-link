import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getFileById } from '$server/files';
import { env } from '$server/env';

export const load: PageServerLoad = async ({ params }) => {
  const file = await getFileById(params.id);
  if (!file) throw error(404, 'not found');
  if (file.expiresAt && file.expiresAt.getTime() < Date.now()) throw error(410, 'expired');

  const fileUrl = `${env().CDN_PUBLIC_BASE_URL}/files/${file.s3Key}`;
  const thumbUrl = file.thumbnailS3Key
    ? `${env().CDN_PUBLIC_BASE_URL}/files/${file.thumbnailS3Key}`
    : null;
  const shareUrl = `${env().PUBLIC_BASE_URL}/v/${file.id}`;

  return { file, fileUrl, thumbUrl, shareUrl };
};
