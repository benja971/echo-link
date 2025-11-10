import { query } from '../db/pool';

interface CreateFileRecordParams {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  title?: string;
  thumbnailKey?: string;
  expiresAt?: Date;
  width?: number;
  height?: number;
}

interface FileRecord {
  id: string;
  s3_key: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
  title: string | null;
  thumbnail_s3_key: string | null;
  expires_at: Date | null;
  width: number | null;
  height: number | null;
}

export async function createFileRecord(params: CreateFileRecordParams): Promise<void> {
  const { id, key, mimeType, sizeBytes, title, thumbnailKey, expiresAt, width, height } = params;

  await query(
    `INSERT INTO files (id, s3_key, mime_type, size_bytes, title, thumbnail_s3_key, expires_at, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, key, mimeType, sizeBytes, title || null, thumbnailKey || null, expiresAt || null, width || null, height || null]
  );
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
