import { mkdir, statfs } from "node:fs/promises";
import { env } from "../env";
import { UploadError } from "./errors";

let active = 0;
let reservedBytes = 0;

export async function acquireUploadCapacity(
  bytes: number,
): Promise<() => void> {
  const config = env();
  if (active >= config.UPLOAD_MAX_CONCURRENT)
    throw new UploadError("upload_busy", 503);
  active++;
  reservedBytes += bytes;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    active--;
    reservedBytes -= bytes;
  };
  try {
    await mkdir(config.UPLOAD_TEMP_DIR, { recursive: true, mode: 0o700 });
    const disk = await statfs(config.UPLOAD_TEMP_DIR);
    if (
      disk.bavail * disk.bsize <
      reservedBytes + config.UPLOAD_MIN_FREE_SPACE_MB * 1024 * 1024
    )
      throw new UploadError("storage_unavailable", 503);
    return release;
  } catch (err) {
    release();
    throw err;
  }
}
