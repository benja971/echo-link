import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { getOrCreateUploadIdentity, UploadIdentity } from './uploadIdentityService';

// Session expiration time (15 minutes)
const SESSION_EXPIRATION_MINUTES = 15;

export interface DiscordUploadSession {
  id: string;
  token: string;
  upload_identity_id: string;
  discord_user_id: string;
  discord_user_name: string | null;
  discord_channel_id: string;
  discord_guild_id: string | null;
  discord_interaction_token: string | null;
  discord_application_id: string | null;
  status: 'pending' | 'completed' | 'expired';
  file_id: string | null;
  created_at: Date;
  expires_at: Date;
  completed_at: Date | null;
}

export interface CreateSessionParams {
  discordUserId: string;
  discordUserName?: string;
  discordChannelId: string;
  discordGuildId?: string;
  discordInteractionToken?: string;
  discordApplicationId?: string;
}

export interface SessionWithIdentity extends DiscordUploadSession {
  identity: UploadIdentity;
}

/**
 * Create a new Discord upload session
 */
export async function createDiscordUploadSession(
  params: CreateSessionParams
): Promise<{ session: DiscordUploadSession; uploadUrl: string }> {
  const { discordUserId, discordUserName, discordChannelId, discordGuildId, discordInteractionToken, discordApplicationId } = params;

  // Get or create upload identity for this Discord user
  const identity = await getOrCreateUploadIdentity(
    'discord_user',
    discordUserId,
    discordUserName,
    discordGuildId ? { guild_id: discordGuildId } : undefined
  );

  // Generate session token
  const token = randomBytes(32).toString('hex');
  const id = uuidv4();

  // Calculate expiration
  const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MINUTES * 60 * 1000);

  const result = await query(
    `INSERT INTO discord_upload_sessions 
     (id, token, upload_identity_id, discord_user_id, discord_user_name, discord_channel_id, discord_guild_id, discord_interaction_token, discord_application_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [id, token, identity.id, discordUserId, discordUserName || null, discordChannelId, discordGuildId || null, discordInteractionToken || null, discordApplicationId || null, expiresAt]
  );

  const session = result.rows[0] as DiscordUploadSession;

  console.log(`Discord upload session created: ${id} for user ${discordUserId}, expires at ${expiresAt.toISOString()}`);

  return {
    session,
    uploadUrl: `/discord/upload/${token}`,
  };
}

/**
 * Get a session by token, including validation
 */
export async function getDiscordUploadSessionByToken(
  token: string
): Promise<SessionWithIdentity | null> {
  const result = await query(
    `SELECT s.*, 
            i.id as identity_id, i.account_id as identity_account_id, i.kind as identity_kind, 
            i.external_id as identity_external_id, i.display_name as identity_display_name, 
            i.extra_metadata as identity_extra_metadata,
            i.created_at as identity_created_at, i.updated_at as identity_updated_at
     FROM discord_upload_sessions s
     JOIN upload_identities i ON s.upload_identity_id = i.id
     WHERE s.token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  const session: DiscordUploadSession = {
    id: row.id,
    token: row.token,
    upload_identity_id: row.upload_identity_id,
    discord_user_id: row.discord_user_id,
    discord_user_name: row.discord_user_name,
    discord_channel_id: row.discord_channel_id,
    discord_guild_id: row.discord_guild_id,
    discord_interaction_token: row.discord_interaction_token,
    discord_application_id: row.discord_application_id,
    status: row.status,
    file_id: row.file_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    completed_at: row.completed_at,
  };

  const identity: UploadIdentity = {
    id: row.identity_id,
    account_id: row.identity_account_id,
    kind: row.identity_kind,
    external_id: row.identity_external_id,
    display_name: row.identity_display_name,
    extra_metadata: row.identity_extra_metadata,
    created_at: row.identity_created_at,
    updated_at: row.identity_updated_at,
  };

  return { ...session, identity };
}

/**
 * Validate a session (check expiration, status)
 */
export function isSessionValid(session: DiscordUploadSession): { valid: boolean; reason?: string } {
  if (session.status === 'completed') {
    return { valid: false, reason: 'Session already used' };
  }

  if (session.status === 'expired') {
    return { valid: false, reason: 'Session expired' };
  }

  if (new Date() > session.expires_at) {
    return { valid: false, reason: 'Session expired' };
  }

  return { valid: true };
}

/**
 * Mark a session as completed and link the file
 */
export async function completeDiscordUploadSession(
  sessionId: string,
  fileId: string
): Promise<void> {
  await query(
    `UPDATE discord_upload_sessions 
     SET status = 'completed', file_id = $2, completed_at = NOW()
     WHERE id = $1`,
    [sessionId, fileId]
  );

  console.log(`Discord upload session ${sessionId} completed with file ${fileId}`);
}

/**
 * Get session by ID
 */
export async function getDiscordUploadSessionById(
  sessionId: string
): Promise<DiscordUploadSession | null> {
  const result = await query(
    `SELECT * FROM discord_upload_sessions WHERE id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as DiscordUploadSession;
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `UPDATE discord_upload_sessions 
     SET status = 'expired' 
     WHERE status = 'pending' AND expires_at < NOW()
     RETURNING id`
  );

  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`Marked ${count} Discord upload sessions as expired`);
  }

  return count;
}
