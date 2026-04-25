import { eq, and } from 'drizzle-orm';
import {
  getDb,
  accounts,
  uploadIdentities,
  users,
  magicLinks,
  type Account,
  type User
} from '@echo-link/db';
import { generateOpaqueToken } from './auth';
import { env } from './env';

export async function findOrCreateAccountByEmail(email: string): Promise<{
  user: User;
  account: Account;
}> {
  const db = getDb();
  const lower = email.toLowerCase().trim();

  let user = (await db.select().from(users).where(eq(users.email, lower)).limit(1))[0];
  if (!user) {
    const inserted = await db.insert(users).values({ email: lower }).returning();
    user = inserted[0]!;
  }

  let identity = (
    await db
      .select()
      .from(uploadIdentities)
      .where(and(eq(uploadIdentities.kind, 'web_user'), eq(uploadIdentities.externalId, user.id)))
      .limit(1)
  )[0];

  let account: Account;
  if (identity) {
    account = (await db.select().from(accounts).where(eq(accounts.id, identity.accountId)).limit(1))[0]!;
  } else {
    const insertedAccount = await db
      .insert(accounts)
      .values({ primaryEmail: lower })
      .returning();
    account = insertedAccount[0]!;
    await db.insert(uploadIdentities).values({
      accountId: account.id,
      kind: 'web_user',
      externalId: user.id,
      displayName: lower
    });
  }

  return { user, account };
}

export async function createMagicLink(userId: string): Promise<string> {
  const db = getDb();
  const token = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + env().MAGIC_LINK_EXPIRATION_MINUTES * 60 * 1000);
  await db.insert(magicLinks).values({ userId, token, expiresAt });
  return token;
}

export async function consumeMagicLink(token: string): Promise<User | null> {
  const db = getDb();
  const row = (await db.select().from(magicLinks).where(eq(magicLinks.token, token)).limit(1))[0];
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await db.update(magicLinks).set({ usedAt: new Date() }).where(eq(magicLinks.id, row.id));
  const user = (await db.select().from(users).where(eq(users.id, row.userId)).limit(1))[0];
  return user ?? null;
}

export async function getAccountForUser(userId: string): Promise<Account | null> {
  const db = getDb();
  const id = (
    await db
      .select()
      .from(uploadIdentities)
      .where(and(eq(uploadIdentities.kind, 'web_user'), eq(uploadIdentities.externalId, userId)))
      .limit(1)
  )[0];
  if (!id) return null;
  return (await db.select().from(accounts).where(eq(accounts.id, id.accountId)).limit(1))[0] ?? null;
}
