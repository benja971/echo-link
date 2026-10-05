import {
  accounts,
  files,
  getDb,
  uploadReservations,
  type File,
  type NewFile,
} from "@echo-link/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { env } from "../env";
import { UploadError } from "../uploads/errors";
import { resolveUploadLimits, type UploadLimits } from "./limits";

export function assertUploadFits(
  limits: UploadLimits,
  usage: { fileCount: number; totalBytes: number },
  bytes: number,
): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0)
    throw new UploadError("invalid_upload_size", 400);
  if (bytes > limits.maxFileBytes) throw new UploadError("file_too_large", 413);
  if (limits.maxFiles !== null && usage.fileCount >= limits.maxFiles)
    throw new UploadError("file_count_quota", 413);
  if (limits.maxBytes !== null && usage.totalBytes + bytes > limits.maxBytes)
    throw new UploadError("storage_quota", 413);
}

export async function reserveUpload(
  accountId: string,
  bytes: number,
): Promise<{ id: string; maxBytes: number }> {
  return getDb().transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");
    if (!account) throw new UploadError("account_not_found", 404);
    const [committed] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        bytes: sql<string>`coalesce(sum(${files.sizeBytes}), 0)::bigint`,
      })
      .from(files)
      .where(and(eq(files.accountId, accountId), eq(files.isAnonymous, false)));
    const [reserved] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        bytes: sql<string>`coalesce(sum(${uploadReservations.bytes}), 0)::bigint`,
      })
      .from(uploadReservations)
      .where(
        and(
          eq(uploadReservations.accountId, accountId),
          gt(uploadReservations.expiresAt, sql`clock_timestamp()`),
        ),
      );
    const e = env();
    assertUploadFits(
      resolveUploadLimits(account.uploadTier, e),
      {
        fileCount: committed!.count + reserved!.count,
        totalBytes: Number(committed!.bytes) + Number(reserved!.bytes),
      },
      bytes,
    );
    const [reservation] = await tx
      .insert(uploadReservations)
      .values({
        accountId,
        bytes,
        expiresAt: sql`clock_timestamp() + (${e.UPLOAD_TIMEOUT_SECONDS + 300} * interval '1 second')`,
      })
      .returning({ id: uploadReservations.id });
    return { id: reservation!.id, maxBytes: bytes };
  });
}

export async function reserveAnonymousUpload(
  ipHash: string,
  bytes: number,
): Promise<{ id: string; maxBytes: number }> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ipHash}))`);
    const e = env();
    if (!e.ANON_ENABLED) throw new UploadError("anonymous_disabled", 403);
    if (!Number.isSafeInteger(bytes) || bytes < 0)
      throw new UploadError("invalid_upload_size", 400);
    if (bytes > e.ANON_MAX_SIZE_MB * 1024 * 1024)
      throw new UploadError("file_too_large_anon", 413);
    if (bytes > e.UPLOAD_MAX_SIZE_MB * 1024 * 1024)
      throw new UploadError("file_too_large", 413);
    const [committed] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(files)
      .where(
        and(
          eq(files.isAnonymous, true),
          eq(files.anonymousIpHash, ipHash),
          gt(
            files.createdAt,
            sql`clock_timestamp() - (${e.ANON_EXPIRATION_HOURS} * interval '1 hour')`,
          ),
        ),
      );
    const [reserved] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadReservations)
      .where(
        and(
          eq(uploadReservations.anonymousIpHash, ipHash),
          gt(uploadReservations.expiresAt, sql`clock_timestamp()`),
        ),
      );
    if (committed!.count + reserved!.count >= e.ANON_MAX_PER_IP_PER_DAY)
      throw new UploadError("anon_rate_limited", 429);
    const [reservation] = await tx
      .insert(uploadReservations)
      .values({
        anonymousIpHash: ipHash,
        bytes,
        expiresAt: sql`clock_timestamp() + (${e.UPLOAD_TIMEOUT_SECONDS + 300} * interval '1 second')`,
      })
      .returning({ id: uploadReservations.id });
    return { id: reservation!.id, maxBytes: bytes };
  });
}

export async function finishReservedUpload(
  reservationId: string,
  input: NewFile,
): Promise<File> {
  return getDb().transaction(async (tx) => {
    const [initial] = await tx
      .select({
        accountId: uploadReservations.accountId,
        anonymousIpHash: uploadReservations.anonymousIpHash,
      })
      .from(uploadReservations)
      .where(eq(uploadReservations.id, reservationId));
    if (!initial) throw new UploadError("upload_reservation_expired", 409);
    if (initial.accountId) {
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, initial.accountId))
        .for("update");
      if (!account) throw new UploadError("account_not_found", 404);
    } else {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${initial.anonymousIpHash}))`,
      );
    }
    const [reservation] = await tx
      .select()
      .from(uploadReservations)
      .where(
        and(
          eq(uploadReservations.id, reservationId),
          gt(uploadReservations.expiresAt, sql`clock_timestamp()`),
        ),
      )
      .for("update");
    if (!reservation) throw new UploadError("upload_reservation_expired", 409);
    const matchesIdentity = reservation.accountId
      ? input.accountId === reservation.accountId && input.isAnonymous !== true
      : !input.accountId &&
        input.isAnonymous === true &&
        input.anonymousIpHash === reservation.anonymousIpHash;
    if (!matchesIdentity)
      throw new UploadError("upload_reservation_mismatch", 403);
    if (
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 0 ||
      input.sizeBytes > reservation.bytes
    )
      throw new UploadError("upload_reservation_exceeded", 413);
    const [file] = await tx.insert(files).values(input).returning();
    await tx
      .delete(uploadReservations)
      .where(eq(uploadReservations.id, reservationId));
    return file!;
  });
}

export async function releaseUploadReservation(id: string): Promise<void> {
  await getDb().delete(uploadReservations).where(eq(uploadReservations.id, id));
}

export async function recoverFinishedUpload(
  input: NewFile,
): Promise<File | null> {
  if (!input.id) throw new UploadError("invalid_upload_id", 400);
  return getDb().transaction(async (tx) => {
    if (input.accountId) {
      await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .for("update");
    } else if (input.isAnonymous && input.anonymousIpHash) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${input.anonymousIpHash}))`,
      );
    } else {
      throw new UploadError("upload_reservation_mismatch", 403);
    }
    const [file] = await tx.select().from(files).where(eq(files.id, input.id!));
    return file ?? null;
  });
}

export async function trackUploadObjects(
  id: string,
  keys: string[],
): Promise<void> {
  const updated = await getDb()
    .update(uploadReservations)
    .set({ objectKeys: keys })
    .where(
      and(
        eq(uploadReservations.id, id),
        gt(uploadReservations.expiresAt, sql`clock_timestamp()`),
      ),
    )
    .returning({ id: uploadReservations.id });
  if (!updated.length) throw new UploadError("upload_reservation_expired", 409);
}

export async function expireUploadReservation(id: string): Promise<void> {
  await getDb()
    .update(uploadReservations)
    .set({ expiresAt: sql`clock_timestamp()` })
    .where(eq(uploadReservations.id, id));
}
