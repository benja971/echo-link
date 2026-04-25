import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { mergeAccounts } from './accountService';
import {
  createUploadIdentity,
  getUploadIdentityByKindAndExternalId,
  UploadIdentity,
} from './uploadIdentityService';

// Link request expiration time (30 minutes)
const LINK_CODE_EXPIRATION_MINUTES = 30;

export interface DiscordLinkRequest {
  id: string;
  account_id: string;
  code: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

export interface CreateLinkRequestResult {
  code: string;
  expiresAt: Date;
}

export interface LinkResult {
  status: 'linked' | 'already_linked' | 'merged';
  accountId: string;
  identityId: string;
  mergedFromAccountId?: string;
}

/**
 * Generate a short, human-readable code (format: XXX-XXX)
 */
function generateLinkCode(): string {
  // Use base36 (0-9, A-Z) for readability, avoiding confusing characters
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, 1, I
  let code = '';
  const bytes = randomBytes(6);
  
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 2) code += '-'; // Add separator after 3 chars
  }
  
  return code;
}

/**
 * Create a new Discord link request for an account
 */
export async function createDiscordLinkRequest(accountId: string): Promise<CreateLinkRequestResult> {
  const id = uuidv4();
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_EXPIRATION_MINUTES * 60 * 1000);

  // Invalidate any existing unused requests for this account
  await query(
    `UPDATE discord_link_requests 
     SET used_at = NOW() 
     WHERE account_id = $1 AND used_at IS NULL`,
    [accountId]
  );

  // Create new request
  await query(
    `INSERT INTO discord_link_requests (id, account_id, code, created_at, expires_at)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [id, accountId, code, expiresAt]
  );

  console.log(`Discord link request created for account ${accountId}: ${code} (expires ${expiresAt.toISOString()})`);

  return { code, expiresAt };
}

/**
 * Get a link request by code
 */
export async function getDiscordLinkRequestByCode(code: string): Promise<DiscordLinkRequest | null> {
  // Normalize code (uppercase, trim)
  const normalizedCode = code.toUpperCase().trim();

  const result = await query(
    `SELECT id, account_id, code, created_at, expires_at, used_at
     FROM discord_link_requests
     WHERE code = $1`,
    [normalizedCode]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Validate a link request
 */
export function validateLinkRequest(request: DiscordLinkRequest): { valid: boolean; reason?: string } {
  if (request.used_at) {
    return { valid: false, reason: 'Ce code a déjà été utilisé.' };
  }

  if (new Date() > request.expires_at) {
    return { valid: false, reason: 'Ce code a expiré. Génère un nouveau code depuis l\'interface Echo-Link.' };
  }

  return { valid: true };
}

/**
 * Mark a link request as used
 */
export async function markLinkRequestAsUsed(requestId: string): Promise<void> {
  await query(
    `UPDATE discord_link_requests SET used_at = NOW() WHERE id = $1`,
    [requestId]
  );
}

/**
 * Link a Discord identity to an account using a link code
 * Handles the case where the Discord user already has an account (merges them)
 */
export async function linkDiscordToAccount(
  code: string,
  discordUserId: string,
  discordUserName?: string,
  discordGuildId?: string
): Promise<LinkResult> {
  // Get and validate the link request
  const request = await getDiscordLinkRequestByCode(code);
  
  if (!request) {
    throw new LinkError('invalid_code', 'Ce code de liaison est invalide.');
  }

  const validation = validateLinkRequest(request);
  if (!validation.valid) {
    throw new LinkError('expired_code', validation.reason || 'Code invalide.');
  }

  const targetAccountId = request.account_id;

  // Check if this Discord user already has an identity
  const existingIdentity = await getUploadIdentityByKindAndExternalId('discord_user', discordUserId);

  let result: LinkResult;

  if (!existingIdentity) {
    // Case A: No existing Discord identity - create one linked to the target account
    const extraMetadata: Record<string, any> = {};
    if (discordGuildId) {
      extraMetadata.guild_id = discordGuildId;
    }

    const newIdentity = await createUploadIdentity(
      'discord_user',
      discordUserId,
      targetAccountId,
      discordUserName,
      Object.keys(extraMetadata).length > 0 ? extraMetadata : undefined
    );

    result = {
      status: 'linked',
      accountId: targetAccountId,
      identityId: newIdentity.id,
    };

    console.log(`Discord user ${discordUserId} linked to account ${targetAccountId} (new identity ${newIdentity.id})`);
  } else if (existingIdentity.account_id === targetAccountId) {
    // Case B: Already linked to the same account - nothing to do
    result = {
      status: 'already_linked',
      accountId: targetAccountId,
      identityId: existingIdentity.id,
    };

    console.log(`Discord user ${discordUserId} already linked to account ${targetAccountId}`);
  } else {
    // Case C: Linked to a different account - need to merge
    const sourceAccountId = existingIdentity.account_id;

    // Merge the old account into the target account
    await mergeAccounts(sourceAccountId, targetAccountId);

    result = {
      status: 'merged',
      accountId: targetAccountId,
      identityId: existingIdentity.id,
      mergedFromAccountId: sourceAccountId,
    };

    console.log(`Discord user ${discordUserId} merged from account ${sourceAccountId} to ${targetAccountId}`);
  }

  // Mark the link request as used
  await markLinkRequestAsUsed(request.id);

  return result;
}

/**
 * Get pending link requests for an account (for UI display)
 */
export async function getPendingLinkRequestsForAccount(accountId: string): Promise<DiscordLinkRequest[]> {
  const result = await query(
    `SELECT id, account_id, code, created_at, expires_at, used_at
     FROM discord_link_requests
     WHERE account_id = $1 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [accountId]
  );

  return result.rows;
}

/**
 * Cleanup expired link requests
 */
export async function cleanupExpiredLinkRequests(): Promise<number> {
  const result = await query(
    `DELETE FROM discord_link_requests 
     WHERE expires_at < NOW() - INTERVAL '1 day'
     RETURNING id`
  );

  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`Cleaned up ${count} expired Discord link requests`);
  }

  return count;
}

/**
 * Custom error class for link errors
 */
export class LinkError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'LinkError';
  }
}
