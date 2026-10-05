import busboy from "busboy";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { UploadError } from "./errors";

export const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

export function declaredUploadSize(request: Request): number | null {
  const value = request.headers.get("x-upload-size");
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new UploadError("invalid_upload_size");
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0)
    throw new UploadError("invalid_upload_size");
  return bytes;
}

export async function receiveUpload(
  request: Request,
  maxBytes: number,
  signal: AbortSignal,
  sizeError = "file_too_large",
  tempRoot = tmpdir(),
): Promise<{
  path: string;
  filename: string;
  sizeBytes: number;
  dispose: () => Promise<void>;
}> {
  if (!request.body) throw new UploadError("no_file");
  const maxBodyBytes = maxBytes + MULTIPART_OVERHEAD_BYTES;
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (
      !/^\d+$/.test(contentLength) ||
      !Number.isSafeInteger(Number(contentLength))
    )
      throw new UploadError("invalid_content_length");
    if (Number(contentLength) > maxBodyBytes)
      throw new UploadError(sizeError, 413);
  }
  let parser: ReturnType<typeof busboy>;
  try {
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new Error("multipart required");
    parser = busboy({
      headers: { "content-type": request.headers.get("content-type")! },
      limits: {
        files: 1,
        fields: 4,
        parts: 5,
        fieldSize: 8192,
        fieldNameSize: 100,
        fileSize: maxBytes + 1,
      },
    });
  } catch {
    throw new UploadError("invalid_multipart");
  }
  const directory = await mkdtemp(join(tempRoot, "echo-upload-"));
  const path = join(directory, "file");
  const dispose = () => rm(directory, { recursive: true, force: true });
  const reader = request.body.getReader();
  // Releasing the reader preserves the connection long enough to send a rejection.
  const input = new Readable({
    read() {
      reader.read().then(
        ({ done, value }) => {
          if (!this.destroyed) this.push(done ? null : value);
        },
        (err) => this.destroy(err),
      );
    },
    destroy(err, callback) {
      reader.releaseLock();
      callback(err);
    },
  });
  let filename: string | null = null;
  let sizeBytes = 0;
  let bodyBytes = 0;
  const state: { failure: Error | null } = { failure: null };
  const writes: Promise<void>[] = [];
  const bodyLimit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bodyBytes += chunk.length;
      callback(
        bodyBytes > maxBodyBytes ? new UploadError(sizeError, 413) : null,
        chunk,
      );
    },
  });
  parser.on("file", (name, file, info) => {
    if (name !== "file" || !info.filename || info.filename.length > 255) {
      state.failure = new UploadError("invalid_file_field");
      file.resume();
      return;
    }
    filename = info.filename;
    const fileLimit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.length;
        callback(
          sizeBytes > maxBytes ? new UploadError(sizeError, 413) : null,
          chunk,
        );
      },
    });
    file.on("limit", () => {
      state.failure = new UploadError(sizeError, 413);
    });
    writes.push(
      pipeline(
        file,
        fileLimit,
        createWriteStream(path, { flags: "wx", mode: 0o600 }),
        { signal },
      ).catch((err: Error) => {
        state.failure = err;
        input.destroy(err);
      }),
    );
  });
  parser.on("filesLimit", () => {
    state.failure = new UploadError("too_many_files");
  });
  parser.on("fieldsLimit", () => {
    state.failure = new UploadError("too_many_fields");
  });
  parser.on("partsLimit", () => {
    state.failure = new UploadError("too_many_parts");
  });
  parser.on("field", (_name, _value, info) => {
    if (info.nameTruncated || info.valueTruncated)
      state.failure = new UploadError("field_too_large");
  });
  try {
    await pipeline(input, bodyLimit, parser, { signal });
    await Promise.all(writes);
    if (state.failure) throw state.failure;
    if (!filename || sizeBytes === 0) throw new UploadError("no_file");
    return { path, filename, sizeBytes, dispose };
  } catch (err) {
    input.destroy();
    await Promise.allSettled(writes);
    await dispose();
    if (signal.aborted) throw new UploadError("upload_aborted", 408);
    if (state.failure instanceof UploadError) throw state.failure;
    if (err instanceof UploadError) throw err;
    throw new UploadError("invalid_multipart");
  }
}
