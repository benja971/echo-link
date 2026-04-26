import { createHash } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, files } from '@echo-link/db';
import { env } from './env';

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${env().ANONYMOUS_IP_SALT}:${ip}`).digest('base64url');
}

export async function anonymousUploadCount(ipHash: string): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - env().ANON_EXPIRATION_HOURS * 60 * 60 * 1000);
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(files)
    .where(
      and(
        eq(files.isAnonymous, true),
        eq(files.anonymousIpHash, ipHash),
        gte(files.createdAt, since)
      )
    );
  return result[0]?.count ?? 0;
}

export function clientIp(request: Request, headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return '0.0.0.0';
}
