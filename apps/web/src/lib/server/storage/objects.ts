import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../env";

let _client: S3Client | null = null;

function client() {
  if (_client) return _client;
  const e = env();
  const protocol = e.S3_USE_SSL ? "https" : "http";
  _client = new S3Client({
    endpoint: `${protocol}://${e.S3_ENDPOINT}:${e.S3_PORT}`,
    region: e.S3_REGION,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: e.S3_ACCESS_KEY,
      secretAccessKey: e.S3_SECRET_KEY,
    },
  });
  return _client;
}

export async function s3PutBuffer(
  key: string,
  body: Buffer,
  contentType: string,
  signal = AbortSignal.timeout(60_000),
) {
  await client().send(
    new PutObjectCommand({
      Bucket: env().S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
    { abortSignal: signal },
  );
}

export async function s3PutFile(
  key: string,
  path: string,
  contentType: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const size = (await stat(path)).size;
  signal?.throwIfAborted();
  const s3Client = client();
  const bucket = env().S3_BUCKET_NAME;
  // lib-storage's abort() alone does not interrupt in-flight SDK requests.
  const uploadClient = new Proxy(s3Client, {
    get(target, property, receiver) {
      if (property === "send") {
        return (command: Parameters<S3Client["send"]>[0]) =>
          target.send(command, {
            abortSignal:
              command instanceof AbortMultipartUploadCommand
                ? AbortSignal.timeout(60_000)
                : signal,
          });
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const stream = createReadStream(path);
  const upload = new Upload({
    client: uploadClient,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentLength: size,
      ContentType: contentType,
    },
    queueSize: 2,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  });
  try {
    await upload.done();
  } catch (error) {
    if (upload.uploadId) {
      try {
        await s3Client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: upload.uploadId,
          }),
          { abortSignal: AbortSignal.timeout(60_000) },
        );
      } catch (cleanupError) {
        if (
          !(
            cleanupError instanceof Error &&
            cleanupError.name === "NoSuchUpload"
          )
        ) {
          console.error("[storage] multipart cleanup failed:", cleanupError);
        }
      }
    }
    throw error;
  } finally {
    stream.destroy();
  }
}

export async function s3HeadObject(key: string) {
  return client().send(
    new HeadObjectCommand({ Bucket: env().S3_BUCKET_NAME, Key: key }),
  );
}

export async function s3DeleteObject(key: string) {
  await client().send(
    new DeleteObjectCommand({ Bucket: env().S3_BUCKET_NAME, Key: key }),
    { abortSignal: AbortSignal.timeout(60_000) },
  );
}

export async function cleanupStoredObject(key: string): Promise<void> {
  const s3Client = client();
  const bucket = env().S3_BUCKET_NAME;
  const signal = AbortSignal.timeout(60_000);
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;
  do {
    const page = await s3Client.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        Prefix: key,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
      }),
      { abortSignal: signal },
    );
    for (const upload of page.Uploads ?? []) {
      if (upload.Key !== key || !upload.UploadId) continue;
      try {
        await s3Client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: upload.UploadId,
          }),
          { abortSignal: signal },
        );
      } catch (error) {
        if (!(error instanceof Error && error.name === "NoSuchUpload"))
          throw error;
      }
    }
    if (!page.IsTruncated) break;
    if (
      !page.NextKeyMarker ||
      (page.NextKeyMarker === keyMarker &&
        page.NextUploadIdMarker === uploadIdMarker)
    ) {
      throw new Error(
        "Multipart upload listing did not advance its pagination markers",
      );
    }
    keyMarker = page.NextKeyMarker;
    uploadIdMarker = page.NextUploadIdMarker;
  } while (true);
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
    abortSignal: signal,
  });
}

export async function s3GetObjectStream(key: string): Promise<{
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}> {
  const out = await client().send(
    new GetObjectCommand({ Bucket: env().S3_BUCKET_NAME, Key: key }),
  );
  return {
    stream: out.Body as Readable,
    contentType: out.ContentType,
    contentLength: out.ContentLength,
  };
}
