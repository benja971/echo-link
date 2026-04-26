import { query } from '../db/pool';
import { deleteS3Object } from './s3Service';

interface CreateFileRecordParams {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  userId?: string;
  uploadIdentityId?: string;
  accountId?: string;
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
  upload_identity_id: string | null;
  account_id: string | null;
  created_at: Date;
  title: string | null;
  thumbnail_s3_key: string | null;
  expires_at: Date | null;
  width: number | null;
  height: number | null;
}

export async function createFileRecord(params: CreateFileRecordParams): Promise<void> {
  const { id, key, mimeType, sizeBytes, userId, uploadIdentityId, accountId, title, thumbnailKey, expiresAt, width, height } = params;

  await query(
    `INSERT INTO files (id, s3_key, mime_type, size_bytes, user_id, upload_identity_id, account_id, title, thumbnail_s3_key, expires_at, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [id, key, mimeType, sizeBytes, userId || null, uploadIdentityId || null, accountId || null, title || null, thumbnailKey || null, expiresAt || null, width || null, height || null]
  );
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, user_id, upload_identity_id, account_id, created_at, title, thumbnail_s3_key, expires_at, width, height
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
    `SELECT id, s3_key, mime_type, size_bytes, user_id, upload_identity_id, account_id, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

export async function getRecentFilesByAccount(accountId: string, limit: number = 10): Promise<FileRecord[]> {
  const result = await query(
    `SELECT f.id, f.s3_key, f.mime_type, f.size_bytes, f.user_id, f.upload_identity_id, f.account_id, 
            f.created_at, f.title, f.thumbnail_s3_key, f.expires_at, f.width, f.height,
            ui.kind as source_kind, ui.display_name as source_display_name
     FROM files f
     LEFT JOIN upload_identities ui ON f.upload_identity_id = ui.id
     WHERE f.account_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2`,
    [accountId, limit]
  );

  return result.rows;
}

export async function getRecentFilesGlobal(limit: number = 10): Promise<FileRecord[]> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, user_id, upload_identity_id, account_id, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

export async function updateThumbnail(fileId: string, thumbnailKey: string): Promise<void> {
  await query(
    `UPDATE files SET thumbnail_s3_key = $2 WHERE id = $1`,
    [fileId, thumbnailKey]
  );
}

// Get all expired files
export async function getExpiredFiles(): Promise<FileRecord[]> {
  const result = await query(
    `SELECT id, s3_key, mime_type, size_bytes, user_id, upload_identity_id, account_id, created_at, title, thumbnail_s3_key, expires_at, width, height
     FROM files
     WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
    []
  );

  return result.rows;
}

// Delete a file record and its S3 objects
export async function deleteFile(fileId: string): Promise<void> {
  const file = await getFileById(fileId);
  
  if (!file) {
    return;
  }

  // Delete from S3
  try {
    await deleteS3Object(file.s3_key);
    console.log(`Deleted S3 object: ${file.s3_key}`);
  } catch (error) {
    console.error(`Failed to delete S3 object ${file.s3_key}:`, error);
  }

  // Delete thumbnail from S3 if exists
  if (file.thumbnail_s3_key) {
    try {
      await deleteS3Object(file.thumbnail_s3_key);
      console.log(`Deleted thumbnail: ${file.thumbnail_s3_key}`);
    } catch (error) {
      console.error(`Failed to delete thumbnail ${file.thumbnail_s3_key}:`, error);
    }
  }

  // Delete from database
  await query('DELETE FROM files WHERE id = $1', [fileId]);
  console.log(`Deleted file record: ${fileId}`);
}

// Cleanup all expired files
export async function cleanupExpiredFiles(): Promise<{ deleted: number; errors: number }> {
  const expiredFiles = await getExpiredFiles();
  let deleted = 0;
  let errors = 0;

  console.log(`Found ${expiredFiles.length} expired files to cleanup`);

  for (const file of expiredFiles) {
    try {
      await deleteFile(file.id);
      deleted++;
    } catch (error) {
      console.error(`Failed to delete file ${file.id}:`, error);
      errors++;
    }
  }

  console.log(`Cleanup complete: ${deleted} deleted, ${errors} errors`);
  return { deleted, errors };
}
