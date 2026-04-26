import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { env } from './env';

let _client: S3Client | null = null;

function client() {
  if (_client) return _client;
  const e = env();
  const protocol = e.S3_USE_SSL ? 'https' : 'http';
  _client = new S3Client({
    endpoint: `${protocol}://${e.S3_ENDPOINT}:${e.S3_PORT}`,
    region: e.S3_REGION,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: e.S3_ACCESS_KEY,
      secretAccessKey: e.S3_SECRET_KEY
    }
  });
  return _client;
}

export async function s3PutBuffer(key: string, body: Buffer, contentType: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: env().S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

export async function s3HeadObject(key: string) {
  return client().send(new HeadObjectCommand({ Bucket: env().S3_BUCKET_NAME, Key: key }));
}

export async function s3DeleteObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET_NAME, Key: key }));
}

export async function s3GetObjectStream(key: string): Promise<{
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}> {
  const out = await client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET_NAME, Key: key }));
  return {
    stream: out.Body as Readable,
    contentType: out.ContentType,
    contentLength: out.ContentLength
  };
}
