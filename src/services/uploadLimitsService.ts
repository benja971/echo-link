import { config } from '../config';
import { getAccountStats, AccountStats } from './accountService';
import { UploadIdentity } from './uploadIdentityService';

// Limits configuration (can be moved to config.ts later)
const LIMITS = {
  // Per 24-hour limits (per account)
  maxFilesPerDay: 50,
  maxBytesPerDay: 2 * 1024 * 1024 * 1024, // 2 GB

  // Total limits per account
  maxTotalFiles: 500,
  maxTotalBytes: 10 * 1024 * 1024 * 1024, // 10 GB
};

export interface UploadLimitResult {
  allowed: boolean;
  reason?: string;
}

// Check upload limits based on account_id (unified across all identities)
export async function assertUploadAllowed(
  identity: UploadIdentity,
  fileSizeBytes: number
): Promise<UploadLimitResult> {
  // Use account_id for quota calculations
  const accountId = identity.account_id;
  
  if (!accountId) {
    // Fallback: if no account_id (shouldn't happen for new records), allow upload
    console.warn(`Identity ${identity.id} has no account_id, allowing upload without quota check`);
    return { allowed: true };
  }

  const stats = await getAccountStats(accountId);

  // Check 24h file count limit
  if (stats.files_last_24h >= LIMITS.maxFilesPerDay) {
    return {
      allowed: false,
      reason: `Daily file limit reached (${LIMITS.maxFilesPerDay} files per 24 hours). Try again later.`,
    };
  }

  // Check 24h bytes limit
  if (stats.bytes_last_24h + fileSizeBytes > LIMITS.maxBytesPerDay) {
    return {
      allowed: false,
      reason: `Daily upload limit reached (${formatBytes(LIMITS.maxBytesPerDay)} per 24 hours). Try again later.`,
    };
  }

  // Check total file count limit
  if (stats.total_files >= LIMITS.maxTotalFiles) {
    return {
      allowed: false,
      reason: `Total file limit reached (${LIMITS.maxTotalFiles} files). Please delete some files to continue uploading.`,
    };
  }

  // Check total bytes limit
  if (stats.total_bytes + fileSizeBytes > LIMITS.maxTotalBytes) {
    return {
      allowed: false,
      reason: `Total storage limit reached (${formatBytes(LIMITS.maxTotalBytes)}). Please delete some files to continue uploading.`,
    };
  }

  return { allowed: true };
}

// Alternative function that takes account_id directly
export async function assertUploadAllowedForAccount(
  accountId: string,
  fileSizeBytes: number
): Promise<UploadLimitResult> {
  const stats = await getAccountStats(accountId);

  // Check 24h file count limit
  if (stats.files_last_24h >= LIMITS.maxFilesPerDay) {
    return {
      allowed: false,
      reason: `Daily file limit reached (${LIMITS.maxFilesPerDay} files per 24 hours). Try again later.`,
    };
  }

  // Check 24h bytes limit
  if (stats.bytes_last_24h + fileSizeBytes > LIMITS.maxBytesPerDay) {
    return {
      allowed: false,
      reason: `Daily upload limit reached (${formatBytes(LIMITS.maxBytesPerDay)} per 24 hours). Try again later.`,
    };
  }

  // Check total file count limit
  if (stats.total_files >= LIMITS.maxTotalFiles) {
    return {
      allowed: false,
      reason: `Total file limit reached (${LIMITS.maxTotalFiles} files). Please delete some files to continue uploading.`,
    };
  }

  // Check total bytes limit
  if (stats.total_bytes + fileSizeBytes > LIMITS.maxTotalBytes) {
    return {
      allowed: false,
      reason: `Total storage limit reached (${formatBytes(LIMITS.maxTotalBytes)}). Please delete some files to continue uploading.`,
    };
  }

  return { allowed: true };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
