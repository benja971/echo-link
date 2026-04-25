import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { s3PutBuffer } from './s3';

export async function generateAndUploadVideoThumbnail(
  videoBuffer: Buffer,
  fileId: string
): Promise<string | null> {
  const dir = mkdtempSync(join(tmpdir(), 'echo-thumb-'));
  const inPath = join(dir, 'in');
  const outPath = join(dir, 'out.jpg');

  try {
    writeFileSync(inPath, videoBuffer);
    await runFfmpeg(['-y', '-ss', '1', '-i', inPath, '-frames:v', '1', '-vf', 'scale=640:-1', outPath]);
    const thumb = readFileSync(outPath);
    const key = `thumbnails/${fileId}.jpg`;
    await s3PutBuffer(key, thumb, 'image/jpeg');
    return key;
  } catch (err) {
    console.warn('[thumbnail] failed:', err);
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}
