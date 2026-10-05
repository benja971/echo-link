import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { accounts, files, getDb, uploadReservations } from "@echo-link/db";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getAccountUploadLimits,
  setAccountUploadTier,
} from "../src/lib/server/accounts/limits";
import {
  expireUploadReservation,
  finishReservedUpload,
  recoverFinishedUpload,
  releaseUploadReservation,
  reserveAnonymousUpload,
  reserveUpload,
  trackUploadObjects,
} from "../src/lib/server/accounts/reservations";

const databaseUrl = process.env.UPLOAD_TEST_DATABASE_URL;
const accountIds: string[] = [];
const ipHashes: string[] = [];
const MiB = 1024 * 1024;

describe.skipIf(!databaseUrl)("upload reservations on PostgreSQL", () => {
  beforeAll(() => {
    const url = new URL(databaseUrl!);
    Object.assign(process.env, {
      DATABASE_HOST: url.hostname,
      DATABASE_PORT: url.port,
      DATABASE_USERNAME: url.username,
      DATABASE_PASSWORD: url.password,
      DATABASE_NAME: url.pathname.slice(1),
      DATABASE_SSL: "0",
      PUBLIC_BASE_URL: "http://localhost:3000",
      CDN_PUBLIC_BASE_URL: "http://localhost:9000",
      S3_ENDPOINT: "localhost",
      S3_PORT: "9000",
      S3_USE_SSL: "false",
      S3_BUCKET_NAME: "test",
      S3_ACCESS_KEY: "test",
      S3_SECRET_KEY: "test",
      RESEND_API_KEY: "test",
      EMAIL_FROM: "test@example.com",
      SESSION_SECRET: "test-session-secret-at-least-32-characters",
      ANONYMOUS_IP_SALT: "test-salt-at-least-16",
      MAX_PER_USER: "25",
      MAX_SIZE_MB_PER_USER: "500",
      UPLOAD_MAX_SIZE_MB: "1024",
      ANON_ENABLED: "true",
      ANON_MAX_SIZE_MB: "50",
      ANON_MAX_PER_IP_PER_DAY: "3",
      ANON_EXPIRATION_HOURS: "24",
      UPLOAD_TIMEOUT_SECONDS: "1800",
    });
  });

  afterAll(async () => {
    if (accountIds.length) {
      await getDb().delete(files).where(inArray(files.accountId, accountIds));
      await getDb().delete(accounts).where(inArray(accounts.id, accountIds));
    }
    if (ipHashes.length) {
      await getDb()
        .delete(files)
        .where(inArray(files.anonymousIpHash, ipHashes));
      await getDb()
        .delete(uploadReservations)
        .where(inArray(uploadReservations.anonymousIpHash, ipHashes));
    }
  });

  async function createAccount(tier: "standard" | "trusted" = "standard") {
    const [account] = await getDb()
      .insert(accounts)
      .values({ uploadTier: tier })
      .returning();
    accountIds.push(account!.id);
    return account!.id;
  }

  function fileInput(accountId: string, bytes: number) {
    return {
      id: randomUUID(),
      accountId,
      sizeBytes: bytes,
      s3Key: `tests/${randomUUID()}`,
      mimeType: "application/pdf",
    };
  }

  test("concurrent reservations cannot exceed account storage", async () => {
    const id = await createAccount();
    const result = await Promise.allSettled([
      reserveUpload(id, 400 * MiB),
      reserveUpload(id, 400 * MiB),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    const rejected = result.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
      "storage_quota",
    );
  });

  test("concurrent reservations cannot exceed file count", async () => {
    const id = await createAccount();
    await getDb()
      .insert(files)
      .values(Array.from({ length: 24 }, () => fileInput(id, 1)));
    const result = await Promise.allSettled([
      reserveUpload(id, 1),
      reserveUpload(id, 1),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = result.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
      "file_count_quota",
    );
  });

  test("finish atomically swaps reservation for committed usage and is not reusable", async () => {
    const id = await createAccount();
    const reservation = await reserveUpload(id, 400 * MiB);
    const file = await finishReservedUpload(
      reservation.id,
      fileInput(id, 400 * MiB),
    );
    expect(file.sizeBytes).toBe(400 * MiB);
    expect(
      await getDb()
        .select()
        .from(uploadReservations)
        .where(eq(uploadReservations.id, reservation.id)),
    ).toHaveLength(0);
    await expect(reserveUpload(id, 101 * MiB)).rejects.toThrow("storage_quota");
    await expect(
      finishReservedUpload(reservation.id, fileInput(id, 1)),
    ).rejects.toThrow("upload_reservation_expired");
  });

  test("recovery waits for uncertain authenticated commit before checking the file", async () => {
    const id = await createAccount();
    const input = fileInput(id, 10);
    let locked!: () => void;
    let allowCommit!: () => void;
    const lockReady = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const commitReady = new Promise<void>((resolve) => {
      allowCommit = resolve;
    });
    const original = getDb().transaction(async (tx) => {
      await tx.select().from(accounts).where(eq(accounts.id, id)).for("update");
      locked();
      await commitReady;
      await tx.insert(files).values(input);
    });
    await lockReady;
    let recovered = false;
    const recovery = recoverFinishedUpload(input).then((file) => {
      recovered = true;
      return file;
    });
    try {
      await Bun.sleep(30);
      expect(recovered).toBe(false);
    } finally {
      allowCommit();
    }
    await original;
    expect((await recovery)?.id).toBe(input.id);
    expect(await recoverFinishedUpload(fileInput(id, 10))).toBeNull();
  });

  test("anonymous recovery uses the same advisory lock as finalization", async () => {
    const hash = randomUUID();
    ipHashes.push(hash);
    const input = {
      ...fileInput("", 10),
      accountId: null,
      isAnonymous: true,
      anonymousIpHash: hash,
    };
    let locked!: () => void;
    let allowCommit!: () => void;
    const lockReady = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const commitReady = new Promise<void>((resolve) => {
      allowCommit = resolve;
    });
    const original = getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${hash}))`);
      locked();
      await commitReady;
      await tx.insert(files).values(input);
    });
    await lockReady;
    let recovered = false;
    const recovery = recoverFinishedUpload(input).then((file) => {
      recovered = true;
      return file;
    });
    try {
      await Bun.sleep(30);
      expect(recovered).toBe(false);
    } finally {
      allowCommit();
    }
    await original;
    expect((await recovery)?.id).toBe(input.id);
  });

  test("size, identity and expiration mismatches cannot commit files", async () => {
    const id = await createAccount();
    const other = await createAccount();
    const reservation = await reserveUpload(id, 10);
    await expect(
      finishReservedUpload(reservation.id, fileInput(id, 11)),
    ).rejects.toThrow("upload_reservation_exceeded");
    await expect(
      finishReservedUpload(reservation.id, fileInput(other, 10)),
    ).rejects.toThrow("upload_reservation_mismatch");
    await getDb()
      .update(uploadReservations)
      .set({ expiresAt: new Date(0) })
      .where(eq(uploadReservations.id, reservation.id));
    await expect(
      finishReservedUpload(reservation.id, fileInput(id, 10)),
    ).rejects.toThrow("upload_reservation_expired");
    expect(
      await getDb().select().from(files).where(eq(files.accountId, id)),
    ).toHaveLength(0);
  });

  test("expired and released reservations do not consume capacity", async () => {
    const id = await createAccount();
    const reservation = await reserveUpload(id, 500 * MiB);
    await getDb()
      .update(uploadReservations)
      .set({ expiresAt: new Date(0) })
      .where(eq(uploadReservations.id, reservation.id));
    const next = await reserveUpload(id, 500 * MiB);
    await releaseUploadReservation(next.id);
    await releaseUploadReservation(next.id);
    await expect(reserveUpload(id, 500 * MiB)).resolves.toMatchObject({
      maxBytes: 500 * MiB,
    });
  });

  test("tracked object keys survive failed cleanup while expired quota is released", async () => {
    const id = await createAccount();
    const reservation = await reserveUpload(id, 500 * MiB);
    const keys = [
      `files/${randomUUID()}.pdf`,
      `thumbnails/${randomUUID()}.webp`,
    ];
    await trackUploadObjects(reservation.id, keys);
    await expireUploadReservation(reservation.id);
    const [retained] = await getDb()
      .select()
      .from(uploadReservations)
      .where(eq(uploadReservations.id, reservation.id));
    expect(retained!.objectKeys).toEqual(keys);
    expect(retained!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(reserveUpload(id, 500 * MiB)).resolves.toMatchObject({
      maxBytes: 500 * MiB,
    });
    await expect(
      trackUploadObjects(reservation.id, ["replaced"]),
    ).rejects.toThrow("upload_reservation_expired");
    await expect(
      finishReservedUpload(reservation.id, fileInput(id, 1)),
    ).rejects.toThrow("upload_reservation_expired");
    await releaseUploadReservation(reservation.id);
    expect(
      await getDb()
        .select()
        .from(uploadReservations)
        .where(eq(uploadReservations.id, reservation.id)),
    ).toHaveLength(0);
  });

  test("tiers are read from DB for every reservation", async () => {
    const id = await createAccount("trusted");
    await expect(reserveUpload(id, 800 * MiB)).resolves.toMatchObject({
      maxBytes: 800 * MiB,
    });
    expect((await getAccountUploadLimits(id)).maxBytes).toBeNull();
    await setAccountUploadTier(id, "standard");
    await expect(reserveUpload(id, 1)).rejects.toThrow("storage_quota");
    await expect(reserveUpload(randomUUID(), 1)).rejects.toThrow(
      "account_not_found",
    );
  });

  test("tier CLI grants by UUID and rejects ambiguous or invalid identifiers", async () => {
    const id = await createAccount();
    const script = new URL(
      "../../../scripts/set-upload-tier.ts",
      import.meta.url,
    ).pathname;
    const command = Bun.spawn([process.execPath, script, id, "trusted"], {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });
    const status = await command.exited;
    if (status !== 0)
      throw new Error(await new Response(command.stderr).text());
    expect(await new Response(command.stdout).text()).toContain(
      `Account ${id}: upload tier trusted`,
    );
    expect((await getAccountUploadLimits(id)).maxBytes).toBeNull();
    await expect(setAccountUploadTier("invalid", "trusted")).rejects.toThrow(
      "Invalid account identifier",
    );
    const duplicate = await createAccount();
    const email = `${randomUUID()}@example.com`;
    await getDb()
      .update(accounts)
      .set({ primaryEmail: email })
      .where(inArray(accounts.id, [id, duplicate]));
    await expect(setAccountUploadTier(email, "trusted")).rejects.toThrow(
      "Ambiguous email",
    );
  });

  test("anonymous concurrency respects rolling upload count and identity", async () => {
    const hash = randomUUID();
    ipHashes.push(hash);
    const result = await Promise.allSettled(
      Array.from({ length: 4 }, () => reserveAnonymousUpload(hash, 10)),
    );
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const rejected = result.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
      "anon_rate_limited",
    );
    const accepted = result.find((r) => r.status === "fulfilled");
    if (accepted?.status !== "fulfilled")
      throw new Error("No anonymous reservation");
    const input = {
      ...fileInput("", 10),
      accountId: null,
      isAnonymous: true,
      anonymousIpHash: hash,
    };
    await expect(
      finishReservedUpload(accepted.value.id, {
        ...input,
        anonymousIpHash: randomUUID(),
      }),
    ).rejects.toThrow("upload_reservation_mismatch");
    await expect(
      finishReservedUpload(accepted.value.id, input),
    ).resolves.toMatchObject({ isAnonymous: true, anonymousIpHash: hash });
    await expect(reserveAnonymousUpload(hash, 10)).rejects.toThrow(
      "anon_rate_limited",
    );
  });

  test("anonymous file size rejected before a reservation is inserted", async () => {
    const hash = randomUUID();
    ipHashes.push(hash);
    await expect(reserveAnonymousUpload(hash, 50 * MiB + 1)).rejects.toThrow(
      "file_too_large_anon",
    );
    expect(
      await getDb()
        .select()
        .from(uploadReservations)
        .where(eq(uploadReservations.anonymousIpHash, hash)),
    ).toHaveLength(0);
  });
});
