import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';

export interface Account {
  id: string;
  primary_email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AccountStats {
  account_id: string;
  total_files: number;
  total_bytes: number;
  files_last_24h: number;
  bytes_last_24h: number;
}

export async function createAccount(primaryEmail?: string): Promise<Account> {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO accounts (id, primary_email, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     RETURNING id, primary_email, created_at, updated_at`,
    [id, primaryEmail || null]
  );

  console.log(`Account created: ${id} (email: ${primaryEmail || 'none'})`);
  return result.rows[0];
}

export async function getAccountById(id: string): Promise<Account | null> {
  const result = await query(
    `SELECT id, primary_email, created_at, updated_at
     FROM accounts
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  const result = await query(
    `SELECT id, primary_email, created_at, updated_at
     FROM accounts
     WHERE primary_email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function updateAccountEmail(accountId: string, email: string): Promise<Account> {
  const result = await query(
    `UPDATE accounts
     SET primary_email = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, primary_email, created_at, updated_at`,
    [accountId, email]
  );

  if (result.rows.length === 0) {
    throw new Error(`Account not found: ${accountId}`);
  }

  return result.rows[0];
}

export async function getOrCreateAccountForEmail(email: string): Promise<Account> {
  // Try to find existing account with this email
  const existing = await getAccountByEmail(email);
  if (existing) {
    return existing;
  }

  // Create new account
  return createAccount(email);
}

export async function getAccountStats(accountId: string): Promise<AccountStats> {
  const result = await query(
    `SELECT
      $1::uuid as account_id,
      COALESCE(COUNT(f.id), 0)::int as total_files,
      COALESCE(SUM(f.size_bytes), 0)::bigint as total_bytes,
      COALESCE(COUNT(f.id) FILTER (WHERE f.created_at >= NOW() - INTERVAL '24 hours'), 0)::int as files_last_24h,
      COALESCE(SUM(f.size_bytes) FILTER (WHERE f.created_at >= NOW() - INTERVAL '24 hours'), 0)::bigint as bytes_last_24h
     FROM files f
     WHERE f.account_id = $1`,
    [accountId]
  );

  const row = result.rows[0];
  return {
    account_id: accountId,
    total_files: row.total_files,
    total_bytes: Number(row.total_bytes),
    files_last_24h: row.files_last_24h,
    bytes_last_24h: Number(row.bytes_last_24h),
  };
}

export async function getAccountIdentities(accountId: string): Promise<{
  id: string;
  kind: string;
  external_id: string;
  display_name: string | null;
  created_at: Date;
}[]> {
  const result = await query(
    `SELECT id, kind, external_id, display_name, created_at
     FROM upload_identities
     WHERE account_id = $1
     ORDER BY created_at`,
    [accountId]
  );

  return result.rows;
}

// Link an existing identity to an account (for future identity merging)
export async function linkIdentityToAccount(identityId: string, accountId: string): Promise<void> {
  await query(
    `UPDATE upload_identities
     SET account_id = $2, updated_at = NOW()
     WHERE id = $1`,
    [identityId, accountId]
  );

  console.log(`Linked identity ${identityId} to account ${accountId}`);
}

// Merge all files and identities from one account into another
export async function mergeAccounts(sourceAccountId: string, targetAccountId: string): Promise<void> {
  // Move all files to target account
  await query(
    `UPDATE files
     SET account_id = $2
     WHERE account_id = $1`,
    [sourceAccountId, targetAccountId]
  );

  // Move all identities to target account
  await query(
    `UPDATE upload_identities
     SET account_id = $2, updated_at = NOW()
     WHERE account_id = $1`,
    [sourceAccountId, targetAccountId]
  );

  // Update target account timestamp
  await query(
    `UPDATE accounts SET updated_at = NOW() WHERE id = $1`,
    [targetAccountId]
  );

  // Delete source account (identities and files are already moved)
  await query(
    `DELETE FROM accounts WHERE id = $1`,
    [sourceAccountId]
  );

  console.log(`Merged account ${sourceAccountId} into ${targetAccountId}`);
}
