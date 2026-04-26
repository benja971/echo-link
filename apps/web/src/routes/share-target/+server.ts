import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processAndStoreUpload, UploadError } from '$server/upload';

/** PWA Web Share Target endpoint. Declared in static/manifest.webmanifest:
 *  the OS POSTs a multipart/form-data with the shared `file` (and possibly
 *  `title`/`text`/`url` for non-file shares, which we currently ignore).
 *
 *  Behavior:
 *  - No session  → redirect to /login?from=share (per spec §3 design C).
 *                  The shared file is dropped on the floor; the user has
 *                  to re-share from the OS share sheet after authenticating.
 *  - With session → run the standard authenticated upload pipeline, then
 *                  redirect to the public share page so the user can copy
 *                  the link in one tap. */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session) {
    throw redirect(303, '/login?from=share');
  }

  const formData = await request.formData();
  const file = formData.get('file');
  // Some OSes send share-target invocations with no file (text/url-only
  // shares). Echo-link is file-centric — bounce those back to /app.
  if (!(file instanceof File)) {
    throw redirect(303, '/app');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await processAndStoreUpload({
      kind: 'authenticated',
      accountId: locals.session.accountId,
      userId: locals.session.userId,
      filename: file.name,
      contentType: file.type,
      buffer
    });
  } catch (err) {
    if (err instanceof UploadError) throw error(err.status, err.code);
    throw err;
  }

  throw redirect(303, `/v/${result.slug ?? result.id}`);
};
