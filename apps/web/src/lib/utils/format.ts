// apps/web/src/lib/utils/format.ts
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}mb`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}gb`;
}

export function formatExpiresIn(expiresAt: Date | null | undefined): string {
  if (!expiresAt) return 'no expiry';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 0) return 'expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return '<1h';
}
