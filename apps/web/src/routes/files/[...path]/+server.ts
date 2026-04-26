import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { getDb, files } from '@echo-link/db';
import { s3GetObjectStream } from '$server/s3';

const MEDIA_PREFIXES = ['image/', 'video/', 'audio/'];

export const GET: RequestHandler = async ({ params }) => {
  const path = params.path;
  if (!path) throw error(404, 'not found');

  const db = getDb();
  const file = (await db.select().from(files).where(eq(files.s3Key, path)).limit(1))[0];

  const { stream, contentType, contentLength } = await s3GetObjectStream(path);

  const isMedia = file && MEDIA_PREFIXES.some((p) => file.mimeType.startsWith(p));
  const headers = new Headers();
  headers.set('content-type', file?.mimeType ?? contentType ?? 'application/octet-stream');
  if (contentLength) headers.set('content-length', String(contentLength));
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  if (!isMedia && file) {
    headers.set(
      'content-disposition',
      `attachment; filename="${(file.title ?? 'file').replace(/"/g, '')}"`
    );
  }

  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new Response(webStream, { headers });
};
