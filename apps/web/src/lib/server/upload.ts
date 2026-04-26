import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { s3PutBuffer } from './s3';
import { insertFile, getAccountUploadStats } from './files';
import { generateAndUploadVideoThumbnail } from './thumbnails';
import { hashIp, anonymousUploadCount } from './anonymous';
import { env } from './env';
import type { File } from '@echo-link/db';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
  'application/zip', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip',
  'application/pdf'
]);

export type ValidatedFile = {
  buffer: Buffer;
  mime: string;
  ext: string;
};

// declaredMime from the client is intentionally ignored — we trust magic bytes only.
export async function validateMagicBytes(buf: Buffer): Promise<ValidatedFile> {
  const detected = await fileTypeFromBuffer(buf);
  if (!detected) throw new UploadError('unrecognized_file_type', 415);
  if (!ALLOWED_MIME.has(detected.mime)) throw new UploadError(`mime_not_allowed:${detected.mime}`, 415);
  return { buffer: buf, mime: detected.mime, ext: detected.ext };
}

export class UploadError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

export async function extractImageDimensions(buf: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(buf).metadata();
    if (meta.width && meta.height) return { width: meta.width, height: meta.height };
    return null;
  } catch {
    return null;
  }
}

/** Generate a 256×256 webp thumbnail (cover-fit) and upload it to S3.
 *  Returns the s3 key, or null if anything fails (we never break the
 *  upload because of a thumbnail issue). */
export async function generateAndUploadImageThumbnail(
  imageBuffer: Buffer,
  fileId: string
): Promise<string | null> {
  try {
    const thumb = await sharp(imageBuffer)
      .rotate() // honor EXIF orientation
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 70 })
      .toBuffer();
    const key = `thumbnails/${fileId}.webp`;
    const { s3PutBuffer } = await import('./s3');
    await s3PutBuffer(key, thumb, 'image/webp');
    return key;
  } catch (err) {
    console.warn('[image-thumbnail] failed:', err);
    return null;
  }
}

export type UploadInput = {
  filename: string;
  contentType: string;
  buffer: Buffer;
} & (
  | { kind: 'authenticated'; accountId: string; userId: string; uploadIdentityId?: string }
  | { kind: 'anonymous'; ip: string }
);

export async function processAndStoreUpload(input: UploadInput): Promise<File> {
  const validated = await validateMagicBytes(input.buffer);
  const sizeMB = input.buffer.byteLength / (1024 * 1024);

  const e = env();
  if (input.kind === 'anonymous') {
    if (!e.ANON_ENABLED) throw new UploadError('anonymous_disabled', 403);
    if (sizeMB > e.ANON_MAX_SIZE_MB) throw new UploadError('file_too_large_anon', 413);
    const ipHash = hashIp(input.ip);
    const used = await anonymousUploadCount(ipHash);
    if (used >= e.ANON_MAX_PER_IP_PER_DAY) throw new UploadError('anon_rate_limited', 429);
  } else {
    // No per-file size limit for authenticated users — only the total
    // per-account quota matters. So one big 500mb video is fine if
    // your account isn't using anything else.
    const stats = await getAccountUploadStats(input.accountId);
    if (stats.fileCount >= e.MAX_PER_USER) throw new UploadError('file_count_quota', 413);
    if (stats.totalBytes / (1024 * 1024) + sizeMB > e.MAX_SIZE_MB_PER_USER)
      throw new UploadError('storage_quota', 413);
  }

  const id = randomUUID();
  const ext = validated.ext;
  const folder =
    validated.mime.startsWith('video/') ? 'videos' :
    validated.mime.startsWith('image/') ? 'images' :
    validated.mime.startsWith('audio/') ? 'audio' : 'files';
  const s3Key = `${folder}/${id}.${ext}`;

  await s3PutBuffer(s3Key, validated.buffer, validated.mime);

  let dimensions: { width: number; height: number } | null = null;
  if (validated.mime.startsWith('image/')) {
    dimensions = await extractImageDimensions(validated.buffer);
  }

  const expiryDays =
    input.kind === 'anonymous'
      ? e.ANON_EXPIRATION_HOURS / 24
      : e.FILE_EXPIRATION_DAYS;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const file = await insertFile({
    id,
    s3Key,
    mimeType: validated.mime,
    sizeBytes: input.buffer.byteLength,
    title: input.filename.replace(/\.[^.]+$/, ''),
    width: dimensions?.width,
    height: dimensions?.height,
    expiresAt,
    isAnonymous: input.kind === 'anonymous',
    anonymousIpHash: input.kind === 'anonymous' ? hashIp(input.ip) : null,
    accountId: input.kind === 'authenticated' ? input.accountId : null,
    userId: input.kind === 'authenticated' ? input.userId : null,
    uploadIdentityId: input.kind === 'authenticated' ? input.uploadIdentityId ?? null : null
  });

  if (validated.mime.startsWith('video/')) {
    void generateAndUploadVideoThumbnail(validated.buffer, file.id).then(async (thumbKey) => {
      if (!thumbKey) return;
      const { getDb, files } = await import('@echo-link/db');
      const { eq } = await import('drizzle-orm');
      await getDb().update(files).set({ thumbnailS3Key: thumbKey }).where(eq(files.id, file.id));
    });
  } else if (validated.mime.startsWith('image/')) {
    // Sync for images — sharp resize is fast (<100ms for typical
    // screenshots) and doing it inline lets the response carry the
    // thumbnail key, so the workspace grid loads the small webp
    // immediately on the next /app navigation.
    const thumbKey = await generateAndUploadImageThumbnail(validated.buffer, file.id);
    if (thumbKey) {
      const { getDb, files } = await import('@echo-link/db');
      const { eq } = await import('drizzle-orm');
      await getDb().update(files).set({ thumbnailS3Key: thumbKey }).where(eq(files.id, file.id));
      file.thumbnailS3Key = thumbKey;
    }
  }

  return file;
}
