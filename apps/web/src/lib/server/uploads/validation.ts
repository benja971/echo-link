import { fileTypeFromStream } from "file-type";
import { createReadStream } from "node:fs";
import { UploadError } from "./errors";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/pdf",
]);

export async function validateFile(
  path: string,
  signal?: AbortSignal,
): Promise<{ mime: string; ext: string }> {
  signal?.throwIfAborted();
  const stream = createReadStream(path, { signal });
  let detected;
  try {
    detected = await fileTypeFromStream(stream);
  } finally {
    stream.destroy();
  }
  signal?.throwIfAborted();
  if (!detected) throw new UploadError("unrecognized_file_type", 415);
  if (!ALLOWED_MIME.has(detected.mime))
    throw new UploadError(`mime_not_allowed:${detected.mime}`, 415);
  return detected;
}
