import { eq, and, isNull } from 'drizzle-orm';
import {
  getDb,
  discordUploadSessions,
  discordLinkRequests,
  accounts,
  uploadIdentities,
  files as filesTbl
} from '@echo-link/db';
import { generateOpaqueToken, timingSafeStringEqual } from './auth';

const SESSION_TTL_MS = 1000 * 60 * 30; // 30 min

export function checkBotToken(headerValue: string | null, expected: string | undefined): boolean {
  if (!headerValue || !expected) return false;
  if (!headerValue.startsWith('Bearer ')) return false;
  return timingSafeStringEqual(headerValue.slice(7), expected);
}

export async function createDiscordUploadSession(args: {
  discordUserId: string;
  discordChannelId: string;
  discordInteractionToken?: string;
}) {
  const db = getDb();
  const token = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const inserted = await db.insert(discordUploadSessions).values({ token, ...args, expiresAt }).returning();
  return inserted[0]!;
}

export async function consumeDiscordUploadSession(token: string) {
  const db = getDb();
  const row = (await db.select().from(discordUploadSessions).where(eq(discordUploadSessions.token, token)).limit(1))[0];
  if (!row) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function markSessionConsumed(id: string) {
  const db = getDb();
  await db.update(discordUploadSessions).set({ consumedAt: new Date() }).where(eq(discordUploadSessions.id, id));
}

export type LinkOutcome = 'linked' | 'already_linked' | 'merged';

export async function consumeDiscordLinkCode(code: string, discordUserId: string, discordDisplayName?: string) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(discordLinkRequests)
      .where(and(eq(discordLinkRequests.code, code), isNull(discordLinkRequests.usedAt)))
      .limit(1)
  )[0];
  if (!row) return { ok: false as const, reason: 'invalid_or_used' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: 'expired' };

  const existing = (
    await db
      .select()
      .from(uploadIdentities)
      .where(and(eq(uploadIdentities.kind, 'discord_user'), eq(uploadIdentities.externalId, discordUserId)))
      .limit(1)
  )[0];

  let outcome: LinkOutcome;
  if (existing && existing.accountId === row.accountId) {
    outcome = 'already_linked';
  } else if (existing) {
    const oldAccount = existing.accountId;
    await db.update(uploadIdentities).set({ accountId: row.accountId }).where(eq(uploadIdentities.id, existing.id));
    await db.update(filesTbl).set({ accountId: row.accountId }).where(eq(filesTbl.accountId, oldAccount));
    await db.delete(accounts).where(eq(accounts.id, oldAccount));
    outcome = 'merged';
  } else {
    await db.insert(uploadIdentities).values({
      accountId: row.accountId,
      kind: 'discord_user',
      externalId: discordUserId,
      displayName: discordDisplayName
    });
    outcome = 'linked';
  }

  await db.update(discordLinkRequests).set({ usedAt: new Date() }).where(eq(discordLinkRequests.id, row.id));
  return { ok: true as const, status: outcome, accountId: row.accountId };
}

export async function startDiscordLink(accountId: string): Promise<{ code: string; expiresAt: Date }> {
  const db = getDb();
  const code = `${randomBlock()}-${randomBlock()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(discordLinkRequests).values({ accountId, code, expiresAt });
  return { code, expiresAt };
}

function randomBlock(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 3; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
