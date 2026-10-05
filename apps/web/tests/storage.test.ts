import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import {
  cleanupStoredObject,
  s3PutFile,
} from "../src/lib/server/storage/objects";
import { generateAndUploadThumbnail } from "../src/lib/server/storage/thumbnails";

const objects = new Map<string, Buffer>();
const requests: {
  method: string;
  key: string;
  part?: number;
  size: number;
  uploadId?: string;
  marker?: string;
  prefix?: string;
}[] = [];
let directory: string;
let cancellation: AbortController | undefined;
const server = createServer(async (request, response) => {
  const url = new URL(request.url!, "http://localhost");
  const key = url.pathname.split("/").slice(2).join("/");
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const part = url.searchParams.get("partNumber");
  requests.push({
    method: request.method!,
    key,
    part: part ? Number(part) : undefined,
    size: body.length,
    uploadId: url.searchParams.get("uploadId") ?? undefined,
    marker: url.searchParams.get("key-marker") ?? undefined,
    prefix: url.searchParams.get("prefix") ?? undefined,
  });
  response.setHeader("content-type", "application/xml");
  if (request.method === "DELETE") {
    if (key === "cleanup-fail" && url.searchParams.has("uploadId")) {
      response
        .writeHead(403)
        .end(
          "<Error><Code>AccessDenied</Code><Message>test failure</Message></Error>",
        );
      return;
    }
    if (url.searchParams.get("uploadId") === "gone") {
      response.writeHead(404).end("<Error><Code>NoSuchUpload</Code></Error>");
      return;
    }
    response.writeHead(204).end();
  } else if (request.method === "GET" && url.searchParams.has("uploads")) {
    if (url.searchParams.get("prefix") === "cleanup-fail") {
      response.end(
        "<ListMultipartUploadsResult><IsTruncated>false</IsTruncated><Upload><Key>cleanup-fail</Key><UploadId>blocked</UploadId></Upload></ListMultipartUploadsResult>",
      );
    } else if (url.searchParams.get("key-marker") === "cleanup") {
      assert.equal(url.searchParams.get("upload-id-marker"), "first");
      response.end(
        "<ListMultipartUploadsResult><IsTruncated>false</IsTruncated><Upload><Key>cleanup</Key><UploadId>second</UploadId></Upload><Upload><Key>cleanup</Key><UploadId>gone</UploadId></Upload></ListMultipartUploadsResult>",
      );
    } else {
      response.end(
        "<ListMultipartUploadsResult><IsTruncated>true</IsTruncated><NextKeyMarker>cleanup</NextKeyMarker><NextUploadIdMarker>first</NextUploadIdMarker><Upload><Key>cleanup</Key><UploadId>first</UploadId></Upload><Upload><Key>cleanup-other</Key><UploadId>ignored</UploadId></Upload></ListMultipartUploadsResult>",
      );
    }
  } else if (url.searchParams.has("uploads")) {
    response.end(
      "<InitiateMultipartUploadResult><UploadId>test-upload</UploadId></InitiateMultipartUploadResult>",
    );
  } else if (part) {
    if (key === "cancel") {
      cancellation!.abort();
      return;
    }
    if (key === "fail-part") {
      response
        .writeHead(403)
        .end(
          "<Error><Code>AccessDenied</Code><Message>test failure</Message></Error>",
        );
      return;
    }
    response.setHeader("etag", `"part-${part}"`);
    response.end();
  } else if (url.searchParams.has("uploadId")) {
    if (key === "fail-complete") {
      response
        .writeHead(403)
        .end(
          "<Error><Code>AccessDenied</Code><Message>test failure</Message></Error>",
        );
      return;
    }
    response.end(
      '<CompleteMultipartUploadResult><ETag>"complete"</ETag></CompleteMultipartUploadResult>',
    );
  } else {
    objects.set(key, body);
    response.setHeader("etag", '"stored"');
    response.end();
  }
});

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  Object.assign(process.env, {
    PUBLIC_BASE_URL: "http://localhost",
    CDN_PUBLIC_BASE_URL: "http://localhost",
    DATABASE_HOST: "localhost",
    DATABASE_USERNAME: "test",
    DATABASE_PASSWORD: "test",
    DATABASE_NAME: "test",
    S3_ENDPOINT: "127.0.0.1",
    S3_PORT: String(address.port),
    S3_USE_SSL: "false",
    S3_BUCKET_NAME: "test",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    RESEND_API_KEY: "test",
    EMAIL_FROM: "test@example.com",
    SESSION_SECRET: "x".repeat(32),
    ANONYMOUS_IP_SALT: "x".repeat(16),
  });
  directory = await mkdtemp(join(tmpdir(), "echo-storage-test-"));
  await writeFile(join(directory, "large"), "");
  await truncate(join(directory, "large"), 17 * 1024 * 1024);
});

after(async () => {
  const closed = new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  server.closeAllConnections();
  await closed;
  await rm(directory, { recursive: true, force: true });
});

test("small disk upload preserves bytes; missing source never starts a request", async () => {
  await writeFile(join(directory, "small"), "small object");
  await s3PutFile("small", join(directory, "small"), "text/plain");
  assert.equal(objects.get("small")?.toString(), "small object");
  await assert.rejects(
    s3PutFile("missing", join(directory, "missing"), "text/plain"),
  );
  assert.equal(
    requests.some((request) => request.key === "missing"),
    false,
  );
});

test("cleanup paginates multipart uploads, matches exact keys, and aborts before deleting", async () => {
  const start = requests.length;
  await cleanupStoredObject("cleanup");
  const sent = requests.slice(start);
  assert.equal(sent.filter((request) => request.method === "GET").length, 2);
  assert(
    sent
      .filter((request) => request.method === "GET")
      .every((request) => request.prefix === "cleanup"),
  );
  const deletions = sent.filter((request) => request.method === "DELETE");
  assert.deepEqual(
    deletions.map((request) => [request.key, request.uploadId]),
    [
      ["cleanup", "first"],
      ["cleanup", "second"],
      ["cleanup", "gone"],
      ["cleanup", undefined],
    ],
  );
  assert.equal(sent.at(-1)?.uploadId, undefined);
  assert.equal(sent.at(-1)?.method, "DELETE");
});

test("failed multipart cleanup rejects before object deletion so recovery can retry", async () => {
  const start = requests.length;
  await assert.rejects(cleanupStoredObject("cleanup-fail"));
  const sent = requests.slice(start);
  assert(
    sent.some(
      (request) =>
        request.key === "cleanup-fail" && request.uploadId === "blocked",
    ),
  );
  assert.equal(
    sent.some(
      (request) =>
        request.key === "cleanup-fail" &&
        request.method === "DELETE" &&
        !request.uploadId,
    ),
    false,
  );
});

test("disk upload sends bounded multipart parts and completes", async () => {
  await s3PutFile(
    "multipart",
    join(directory, "large"),
    "application/octet-stream",
  );
  const sent = requests.filter((request) => request.key === "multipart");
  assert.deepEqual(
    sent
      .filter((request) => request.part)
      .map((request) => request.size)
      .sort((a, b) => a - b),
    [1024 * 1024, 8 * 1024 * 1024, 8 * 1024 * 1024],
  );
  assert.equal(sent.filter((request) => request.method === "POST").length, 2);
  assert.equal(
    sent.some((request) => request.method === "DELETE"),
    false,
  );
});

test("multipart part and completion failures abort the upload", async () => {
  for (const key of ["fail-part", "fail-complete"]) {
    await assert.rejects(
      s3PutFile(key, join(directory, "large"), "application/octet-stream"),
    );
    assert(
      requests.some(
        (request) => request.key === key && request.method === "DELETE",
      ),
    );
  }
});

test("cancellation interrupts in-flight parts and aborts multipart before rejection", async () => {
  cancellation = new AbortController();
  await assert.rejects(
    s3PutFile(
      "cancel",
      join(directory, "large"),
      "application/octet-stream",
      cancellation.signal,
    ),
  );
  assert(
    requests.some(
      (request) => request.key === "cancel" && request.method === "DELETE",
    ),
  );
  assert.equal(
    requests.filter(
      (request) => request.key === "cancel" && request.method === "POST",
    ).length,
    1,
  );
});

test("already canceled disk upload starts no S3 request", async () => {
  await assert.rejects(
    s3PutFile(
      "already-cancelled",
      join(directory, "large"),
      "application/octet-stream",
      AbortSignal.abort(),
    ),
  );
  assert.equal(
    requests.some((request) => request.key === "already-cancelled"),
    false,
  );
});

test("image thumbnail reads a path, stores a 256px webp, and preserves original", async () => {
  const path = join(directory, "image.png");
  await sharp({
    create: { width: 900, height: 700, channels: 3, background: "red" },
  })
    .png()
    .toFile(path);
  const original = await readFile(path);
  const key = await generateAndUploadThumbnail({
    path,
    mime: "image/png",
    fileId: "image",
  });
  assert.equal(key, "thumbnails/image.webp");
  const metadata = await sharp(objects.get(key!)!).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.equal(metadata.format, "webp");
  assert.deepEqual(await readFile(path), original);
});

test("invalid video thumbnail cleans temporary frame directory and preserves input", async () => {
  const path = join(directory, "invalid-video");
  await writeFile(path, "not a video");
  const beforeDirectories = new Set(await readdir(directory));
  assert.equal(
    await generateAndUploadThumbnail({
      path,
      mime: "video/mp4",
      fileId: "invalid",
    }),
    null,
  );
  const newThumbnailDirectories = (await readdir(directory)).filter(
    (name) => name.startsWith("echo-thumb-") && !beforeDirectories.has(name),
  );
  assert.deepEqual(newThumbnailDirectories, []);
  assert.equal((await readFile(path)).toString(), "not a video");
});

test("video thumbnail uses the original path and produces a bounded webp", async () => {
  const path = join(directory, "video.mp4");
  const generated = spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=720x1280:d=2",
      "-threads",
      "1",
      path,
    ],
    { timeout: 15_000 },
  );
  assert.equal(generated.status, 0, generated.stderr?.toString());
  const key = await generateAndUploadThumbnail({
    path,
    mime: "video/mp4",
    fileId: "video",
  });
  assert.equal(key, "thumbnails/video.webp");
  const metadata = await sharp(objects.get(key!)!).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
});
