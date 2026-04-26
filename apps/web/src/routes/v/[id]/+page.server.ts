import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getFileById, getFileBySlug } from '$server/files';
import { isUuid, validateSlug } from '$server/slug';
import { env } from '$server/env';

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;

  // Dispatch by shape: UUID hits the primary key, anything else is treated
  // as a slug. Validating the slug shape up-front rejects junk requests
  // (random strings with weird chars) before they hit the index.
  let file = null;
  if (isUuid(id)) {
    file = await getFileById(id);
  } else if (validateSlug(id) === null) {
    file = await getFileBySlug(id);
  }

  if (!file) throw error(404, 'not found');
  if (file.expiresAt && file.expiresAt.getTime() < Date.now()) throw error(410, 'expired');

  const fileUrl = `${env().CDN_PUBLIC_BASE_URL}/files/${file.s3Key}`;
  const thumbUrl = file.thumbnailS3Key
    ? `${env().CDN_PUBLIC_BASE_URL}/files/${file.thumbnailS3Key}`
    : null;
  // Canonical share URL prefers the slug when set — so copy-link from the
  // share page always yields the prettier form even if the visitor arrived
  // via the UUID.
  const shareUrl = `${env().PUBLIC_BASE_URL}/v/${file.slug ?? file.id}`;

  return { file, fileUrl, thumbUrl, shareUrl };
};
