import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';

// Upload Identity Types
export type UploadIdentityKind = 'web_user' | 'discord_user';

export interface UploadIdentity {
  id: string;
  kind: UploadIdentityKind;
  external_id: string;
  display_name: string | null;
  extra_metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface DiscordIdentityMetadata {
  guild_id?: string;
  avatar?: string;
  discriminator?: string;
}

// Get or create an upload identity
export async function getOrCreateUploadIdentity(
  kind: UploadIdentityKind,
  externalId: string,
  displayName?: string,
  extraMetadata?: Record<string, any>
): Promise<UploadIdentity> {
  // Try to find existing identity
  const existing = await getUploadIdentityByKindAndExternalId(kind, externalId);
  
  if (existing) {
    // Update display_name and extra_metadata if provided
    if (displayName || extraMetadata) {
      return updateUploadIdentity(existing.id, displayName, extraMetadata);
    }
    return existing;
  }

  // Create new identity
  return createUploadIdentity(kind, externalId, displayName, extraMetadata);
}

export async function createUploadIdentity(
  kind: UploadIdentityKind,
  externalId: string,
  displayName?: string,
  extraMetadata?: Record<string, any>
): Promise<UploadIdentity> {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO upload_identities (id, kind, external_id, display_name, extra_metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, kind, external_id, display_name, extra_metadata, created_at, updated_at`,
    [id, kind, externalId, displayName || null, extraMetadata ? JSON.stringify(extraMetadata) : null]
  );

  console.log(`Upload identity created: ${kind}/${externalId} (${id})`);
  return result.rows[0];
}

export async function getUploadIdentityById(id: string): Promise<UploadIdentity | null> {
  const result = await query(
    `SELECT id, kind, external_id, display_name, extra_metadata, created_at, updated_at
     FROM upload_identities
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getUploadIdentityByKindAndExternalId(
  kind: UploadIdentityKind,
  externalId: string
): Promise<UploadIdentity | null> {
  const result = await query(
    `SELECT id, kind, external_id, display_name, extra_metadata, created_at, updated_at
     FROM upload_identities
     WHERE kind = $1 AND external_id = $2`,
    [kind, externalId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function updateUploadIdentity(
  id: string,
  displayName?: string,
  extraMetadata?: Record<string, any>
): Promise<UploadIdentity> {
  const updates: string[] = ['updated_at = NOW()'];
  const params: any[] = [id];
  let paramIndex = 2;

  if (displayName !== undefined) {
    updates.push(`display_name = $${paramIndex}`);
    params.push(displayName);
    paramIndex++;
  }

  if (extraMetadata !== undefined) {
    updates.push(`extra_metadata = $${paramIndex}`);
    params.push(JSON.stringify(extraMetadata));
    paramIndex++;
  }

  const result = await query(
    `UPDATE upload_identities
     SET ${updates.join(', ')}
     WHERE id = $1
     RETURNING id, kind, external_id, display_name, extra_metadata, created_at, updated_at`,
    params
  );

  return result.rows[0];
}

// Get upload identity statistics
export interface UploadIdentityStats {
  identity_id: string;
  total_files: number;
  total_bytes: number;
  files_last_24h: number;
  bytes_last_24h: number;
}

export async function getUploadIdentityStats(identityId: string): Promise<UploadIdentityStats> {
  const result = await query(
    `SELECT
      $1::uuid as identity_id,
      COALESCE(COUNT(f.id), 0)::int as total_files,
      COALESCE(SUM(f.size_bytes), 0)::bigint as total_bytes,
      COALESCE(COUNT(f.id) FILTER (WHERE f.created_at >= NOW() - INTERVAL '24 hours'), 0)::int as files_last_24h,
      COALESCE(SUM(f.size_bytes) FILTER (WHERE f.created_at >= NOW() - INTERVAL '24 hours'), 0)::bigint as bytes_last_24h
     FROM files f
     WHERE f.upload_identity_id = $1`,
    [identityId]
  );

  const row = result.rows[0];
  return {
    identity_id: identityId,
    total_files: row.total_files,
    total_bytes: Number(row.total_bytes),
    files_last_24h: row.files_last_24h,
    bytes_last_24h: Number(row.bytes_last_24h),
  };
}
