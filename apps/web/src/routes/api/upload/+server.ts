import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { processAndStoreUpload, UploadError } from '$server/upload';
import { clientIp } from '$server/anonymous';
import { env } from '$server/env';

export const POST: RequestHandler = async ({ request, locals }) => {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) throw error(400, 'no file');

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let result;
    if (locals.session) {
      result = await processAndStoreUpload({
        kind: 'authenticated',
        accountId: locals.session.accountId,
        userId: locals.session.userId,
        filename: file.name,
        contentType: file.type,
        buffer
      });
    } else {
      const ip = clientIp(request, request.headers);
      result = await processAndStoreUpload({
        kind: 'anonymous',
        ip,
        filename: file.name,
        contentType: file.type,
        buffer
      });
    }

    return json({
      id: result.id,
      shareUrl: `${env().PUBLIC_BASE_URL}/v/${result.id}`,
      directUrl: `${env().CDN_PUBLIC_BASE_URL}/files/${result.s3Key}`,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      title: result.title,
      expiresAt: result.expiresAt
    });
  } catch (err) {
    if (err instanceof UploadError) throw error(err.status, err.code);
    throw err;
  }
};
