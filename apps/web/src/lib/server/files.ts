import { eq, and, sql } from 'drizzle-orm';
import { getDb, files, type File, type NewFile } from '@echo-link/db';

export async function insertFile(input: NewFile): Promise<File> {
  const db = getDb();
  const inserted = await db.insert(files).values(input).returning();
  return inserted[0]!;
}

export async function getFileById(id: string): Promise<File | null> {
  const db = getDb();
  return (await db.select().from(files).where(eq(files.id, id)).limit(1))[0] ?? null;
}

export async function listFilesByAccount(accountId: string): Promise<File[]> {
  const db = getDb();
  return db
    .select()
    .from(files)
    .where(and(eq(files.accountId, accountId), eq(files.isAnonymous, false)))
    .orderBy(sql`${files.createdAt} desc`);
}

export async function deleteFile(id: string): Promise<void> {
  const db = getDb();
  await db.delete(files).where(eq(files.id, id));
}

export async function getAccountUploadStats(accountId: string): Promise<{
  fileCount: number;
  totalBytes: number;
}> {
  const db = getDb();
  const result = await db
    .select({
      count: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${files.sizeBytes}), 0)::bigint`
    })
    .from(files)
    .where(and(eq(files.accountId, accountId), eq(files.isAnonymous, false)));
  return {
    fileCount: result[0]?.count ?? 0,
    totalBytes: Number(result[0]?.bytes ?? 0)
  };
}

export async function deleteExpiredFiles(): Promise<File[]> {
  const db = getDb();
  const expired = await db
    .select()
    .from(files)
    .where(sql`${files.expiresAt} is not null and ${files.expiresAt} < now()`);
  if (expired.length === 0) return [];
  await db.delete(files).where(sql`${files.expiresAt} is not null and ${files.expiresAt} < now()`);
  return expired;
}
