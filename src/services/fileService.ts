import { query } from '../db/pool';

interface CreateFileRecordParams {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  title?: string;
  thumbnailKey?: string;
  expiresAt?: Date;
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
}

export async function createFileRecord(params: CreateFileRecordParams): Promise<void> {
  const { id, key, mimeType, sizeBytes, title, thumbnailKey, expiresAt } = params;
  
  await query(
    `INSERT INTO files (id, s3_key, mime_type, size_bytes, title, thumbnail_s3_key, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, key, mimeType, sizeBytes, title || null, thumbnailKey || null, expiresAt || null]
  );
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, created_at, title, thumbnail_s3_key, expires_at
     FROM files
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
