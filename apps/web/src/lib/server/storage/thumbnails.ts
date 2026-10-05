import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { s3PutBuffer } from "./objects";

export async function generateAndUploadThumbnail(input: {
  path: string;
  mime: string;
  fileId: string;
}): Promise<string | null> {
  if (!input.mime.startsWith("image/") && !input.mime.startsWith("video/"))
    return null;

  const deadline = Date.now() + 60_000;
  const signal = AbortSignal.timeout(60_000);
  let temporaryDirectory: string | undefined;
  try {
    let imagePath = input.path;
    if (input.mime.startsWith("video/")) {
      temporaryDirectory = await mkdtemp(
        join(dirname(input.path), "echo-thumb-"),
      );
      imagePath = join(temporaryDirectory, "frame.jpg");
      await runFfmpeg([
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        "1",
        "-threads",
        "1",
        "-i",
        input.path,
        "-frames:v",
        "1",
        "-filter_threads",
        "1",
        "-vf",
        "scale=640:640:force_original_aspect_ratio=decrease",
        imagePath,
      ]);
    }

    signal.throwIfAborted();
    const thumbnail = await sharp(imagePath, { limitInputPixels: 40_000_000 })
      .timeout({
        seconds: Math.max(1, Math.ceil((deadline - Date.now()) / 1000)),
      })
      .rotate()
      .resize(256, 256, { fit: "cover", position: "attention" })
      .webp({ quality: 70 })
      .toBuffer();
    const key = `thumbnails/${input.fileId}.webp`;
    await s3PutBuffer(key, thumbnail, "image/webp", signal);
    return key;
  } catch (error) {
    console.warn("[thumbnail] failed:", error);
    return null;
  } finally {
    if (temporaryDirectory)
      await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "inherit"],
      timeout: 60_000,
      killSignal: "SIGKILL",
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed: ${signal ?? code}`));
    });
  });
}
