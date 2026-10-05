import { getDb, files, uploadReservations, type File } from "@echo-link/db";
import { eq, lt } from "drizzle-orm";
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../env";
import { s3DeleteObject, cleanupStoredObject } from "../storage/objects";
import { deleteFile } from "../files/repository";

export async function removeStoredFile(file: File): Promise<void> {
  await s3DeleteObject(file.s3Key);
  if (file.thumbnailS3Key) await s3DeleteObject(file.thumbnailS3Key);
  await deleteFile(file.id);
}

let cleaning: Promise<number> | null = null;
export function cleanupExpiredUploads(): Promise<number> {
  if (cleaning) return cleaning;
  cleaning = runCleanup().finally(() => {
    cleaning = null;
  });
  return cleaning;
}

async function runCleanup(): Promise<number> {
  const now = new Date();
  const expired = await getDb()
    .select()
    .from(files)
    .where(lt(files.expiresAt, now));
  let deleted = 0;
  for (const file of expired) {
    try {
      await removeStoredFile(file);
      deleted++;
    } catch (err) {
      console.warn("[cleanup] retaining file for retry:", file.id, err);
    }
  }
  const abandoned = await getDb()
    .select()
    .from(uploadReservations)
    .where(lt(uploadReservations.expiresAt, now));
  for (const reservation of abandoned) {
    try {
      for (const key of reservation.objectKeys) await cleanupStoredObject(key);
      await getDb()
        .delete(uploadReservations)
        .where(eq(uploadReservations.id, reservation.id));
    } catch (err) {
      console.warn(
        "[cleanup] retaining abandoned upload for retry:",
        reservation.id,
        err,
      );
    }
  }
  const config = env();
  const cutoff = now.getTime() - (config.UPLOAD_TIMEOUT_SECONDS + 300) * 1000;
  try {
    const entries = await readdir(config.UPLOAD_TEMP_DIR, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("echo-upload-"))
        continue;
      const path = join(config.UPLOAD_TEMP_DIR, entry.name);
      if ((await stat(path)).mtimeMs < cutoff)
        await rm(path, { recursive: true, force: true });
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return deleted;
}

let scheduled = false;
export function startCleanupScheduler(): void {
  if (scheduled) return;
  scheduled = true;
  const run = () => {
    void cleanupExpiredUploads().catch((err) =>
      console.error("[cleanup] failed:", err),
    );
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
