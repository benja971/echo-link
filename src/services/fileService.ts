import { query } from '../db/pool';

interface CreateFileRecordParams {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  userId?: string;
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
  user_id: string | null;
  created_at: Date;
  title: string | null;
  thumbnail_s3_key: string | null;
  expires_at: Date | null;
  width: number | null;
  height: number | null;
}

export async function createFileRecord(params: CreateFileRecordParams): Promise<void> {
  const { id, key, mimeType, sizeBytes, userId, title, thumbnailKey, expiresAt, width, height } = params;

  await query(
    `INSERT INTO files (id, s3_key, mime_type, size_bytes, user_id, title, thumbnail_s3_key, expires_at, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, key, mimeType, sizeBytes, userId || null, title || null, thumbnailKey || null, expiresAt || null, width || null, height || null]
  );
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, user_id, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getRecentFilesByUser(userId: string, limit: number = 10): Promise<FileRecord[]> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, user_id, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

export async function getRecentFilesGlobal(limit: number = 10): Promise<FileRecord[]> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, user_id, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
