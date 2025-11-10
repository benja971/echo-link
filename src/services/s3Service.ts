import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import { Readable } from 'stream';

// Build full endpoint URL from parts
const protocol = config.s3.useSsl ? 'https' : 'http';
const fullEndpoint = `${protocol}://${config.s3.endpoint}:${config.s3.port}`;

const s3Client = new S3Client({
  endpoint: fullEndpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

interface UploadBufferParams {
  key: string;
  buffer: Buffer;
  contentType: string;
}

export async function uploadBuffer({ key, buffer, contentType }: UploadBufferParams): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

export function getPublicUrl(key: string): string {
  // Files are now served through the app's /files route instead of directly from S3
  return `${config.publicBaseUrl}/files/${key}`;
}

export async function getS3Object(key: string): Promise<Readable> {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('No body in S3 response');
  }

  return response.Body as Readable;
}

export { s3Client };
