import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query } from '../db/pool';

// Types
export interface User {
  id: string;
  email: string;
  created_at: Date;
  last_login_at: Date | null;
}

export interface MagicLink {
  id: string;
  user_id: string;
  token: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

export interface UploadToken {
  id: string;
  user_id: string;
  token: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
  device_info: string | null;
}

export interface UserQuotaUsage {
  user_id: string;
  total_files: number;
  total_bytes: number;
  quota_max_files: number;
  quota_max_bytes: number;
  quota_files_percentage: number;
  quota_bytes_percentage: number;
}

// User operations
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query(
    'SELECT id, email, created_at, last_login_at FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await query(
    'SELECT id, email, created_at, last_login_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function createUser(email: string): Promise<User> {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO users (id, email, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id, email, created_at, last_login_at`,
    [id, email]
  );

  console.log(`User created: ${email} (${id})`);
  return result.rows[0];
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [userId]
  );
}

// Magic Link operations
export async function createMagicLink(userId: string): Promise<MagicLink> {
  const id = uuidv4();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.magicLink.expirationMinutes * 60 * 1000);

  const result = await query(
    `INSERT INTO magic_links (id, user_id, token, created_at, expires_at)
     VALUES ($1, $2, $3, NOW(), $4)
     RETURNING id, user_id, token, created_at, expires_at, used_at`,
    [id, userId, token, expiresAt]
  );

  console.log(`Magic link created for user ${userId}, expires at ${expiresAt}`);
  return result.rows[0];
}

export async function getMagicLinkByToken(token: string): Promise<MagicLink | null> {
  const result = await query(
    `SELECT id, user_id, token, created_at, expires_at, used_at
     FROM magic_links
     WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function markMagicLinkAsUsed(magicLinkId: string): Promise<void> {
  await query(
    'UPDATE magic_links SET used_at = NOW() WHERE id = $1',
    [magicLinkId]
  );
}

export async function isMagicLinkValid(magicLink: MagicLink): Promise<boolean> {
  // Check if already used
  if (magicLink.used_at) {
    return false;
  }

  // Check if expired
  if (new Date() > magicLink.expires_at) {
    return false;
  }

  return true;
}

// Upload Token operations
export async function createUploadToken(userId: string, deviceInfo?: string): Promise<UploadToken> {
  const id = uuidv4();
  const token = randomBytes(48).toString('hex'); // Longer token for long-lived authentication

  const result = await query(
    `INSERT INTO upload_tokens (id, user_id, token, created_at, device_info)
     VALUES ($1, $2, $3, NOW(), $4)
     RETURNING id, user_id, token, created_at, last_used_at, expires_at, device_info`,
    [id, userId, token, deviceInfo || null]
  );

  console.log(`Upload token created for user ${userId}`);
  return result.rows[0];
}

export async function getUploadTokenByToken(token: string): Promise<UploadToken | null> {
  const result = await query(
    `SELECT id, user_id, token, created_at, last_used_at, expires_at, device_info
     FROM upload_tokens
     WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function updateUploadTokenLastUsed(tokenId: string): Promise<void> {
  await query(
    'UPDATE upload_tokens SET last_used_at = NOW() WHERE id = $1',
    [tokenId]
  );
}

export async function isUploadTokenValid(uploadToken: UploadToken): Promise<boolean> {
  // Check if expired (if expires_at is set)
  if (uploadToken.expires_at && new Date() > uploadToken.expires_at) {
    return false;
  }

  return true;
}

export async function getUserByUploadToken(token: string): Promise<User | null> {
  const uploadToken = await getUploadTokenByToken(token);

  if (!uploadToken) {
    return null;
  }

  if (!(await isUploadTokenValid(uploadToken))) {
    return null;
  }

  // Update last used timestamp
  await updateUploadTokenLastUsed(uploadToken.id);

  return getUserById(uploadToken.user_id);
}

// Quota operations
export async function getUserQuotaUsage(userId: string): Promise<UserQuotaUsage> {
  const result = await query(
    `SELECT
      u.id as user_id,
      COALESCE(COUNT(f.id), 0)::int as total_files,
      COALESCE(SUM(f.size_bytes), 0)::bigint as total_bytes
     FROM users u
     LEFT JOIN files f ON f.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const row = result.rows[0];
  const maxFiles = config.files.maxPerUser;
  const maxBytes = config.files.maxSizeBytesPerUser;

  // PostgreSQL bigint is returned as string, convert to number
  const totalBytes = Number(row.total_bytes);

  return {
    user_id: row.user_id,
    total_files: row.total_files,
    total_bytes: totalBytes,
    quota_max_files: maxFiles,
    quota_max_bytes: maxBytes,
    quota_files_percentage: maxFiles > 0
      ? Math.round((row.total_files / maxFiles) * 100)
      : 0,
    quota_bytes_percentage: maxBytes > 0
      ? Math.round((row.total_bytes / maxBytes) * 100)
      : 0,
  };
}

export async function checkUserQuota(userId: string, fileSizeBytes: number): Promise<{ allowed: boolean; reason?: string }> {
  const usage = await getUserQuotaUsage(userId);
  const maxFiles = config.files.maxPerUser;
  const maxBytes = config.files.maxSizeBytesPerUser;

  // Check file count quota
  if (usage.total_files >= maxFiles) {
    return {
      allowed: false,
      reason: `File count quota exceeded. Maximum ${maxFiles} files allowed.`,
    };
  }

  // Check storage size quota
  if (usage.total_bytes + fileSizeBytes > maxBytes) {
    return {
      allowed: false,
      reason: `Storage quota exceeded. Maximum ${formatBytes(maxBytes)} allowed.`,
    };
  }

  return { allowed: true };
}

// Global statistics
export interface GlobalStats {
  total_users: number;
  total_files: number;
  total_bytes: number;
  files_today: number;
  bytes_today: number;
  files_this_week: number;
  bytes_this_week: number;
  files_this_month: number;
  bytes_this_month: number;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM users)::int as total_users,
      (SELECT COUNT(*) FROM files)::int as total_files,
      (SELECT COALESCE(SUM(size_bytes), 0) FROM files)::bigint as total_bytes,
      (SELECT COUNT(*) FROM files WHERE created_at >= CURRENT_DATE)::int as files_today,
      (SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE created_at >= CURRENT_DATE)::bigint as bytes_today,
      (SELECT COUNT(*) FROM files WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int as files_this_week,
      (SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::bigint as bytes_this_week,
      (SELECT COUNT(*) FROM files WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::int as files_this_month,
      (SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::bigint as bytes_this_month`
  );

  return result.rows[0];
}

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
