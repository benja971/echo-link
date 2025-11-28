import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadBuffer } from './s3Service';
import { updateThumbnail } from './fileService';

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 360;
const THUMBNAIL_QUALITY = 85;
const DEFAULT_TIMESTAMP = '00:00:01'; // 1 second

interface ThumbnailResult {
  success: boolean;
  thumbnailKey?: string;
  error?: string;
}

/**
 * Generate a thumbnail from a video buffer using ffmpeg
 * Extracts a frame at 1 second (or start if video is shorter)
 */
export async function generateThumbnail(
  videoBuffer: Buffer,
  fileId: string,
  mimeType: string
): Promise<ThumbnailResult> {
  // Only process video files
  if (!mimeType.startsWith('video/')) {
    return { success: false, error: 'Not a video file' };
  }

  const tempDir = tmpdir();
  const inputPath = join(tempDir, `${uuidv4()}.video`);
  const outputPath = join(tempDir, `${uuidv4()}.jpg`);

  try {
    // Write video buffer to temp file
    await fs.writeFile(inputPath, videoBuffer);

    // Generate thumbnail using ffmpeg
    await runFfmpeg(inputPath, outputPath);

    // Read the generated thumbnail
    const thumbnailBuffer = await fs.readFile(outputPath);

    // Upload to S3
    const thumbnailKey = `thumbnails/${fileId}.jpg`;
    await uploadBuffer({
      key: thumbnailKey,
      buffer: thumbnailBuffer,
      contentType: 'image/jpeg',
    });

    // Update database record
    await updateThumbnail(fileId, thumbnailKey);

    console.log(`Thumbnail generated for file ${fileId}: ${thumbnailKey}`);

    return { success: true, thumbnailKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Thumbnail generation failed for file ${fileId}:`, errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    // Cleanup temp files
    await cleanup(inputPath, outputPath);
  }
}

/**
 * Run ffmpeg to extract a frame from video
 */
function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', DEFAULT_TIMESTAMP,
      '-vframes', '1',
      '-vf', `scale=${THUMBNAIL_WIDTH}:${THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${THUMBNAIL_WIDTH}:${THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
      '-q:v', String(Math.round((100 - THUMBNAIL_QUALITY) / 3.125)), // Convert quality to ffmpeg scale (2-31, lower is better)
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('ffmpeg not found. Please install ffmpeg.'));
      } else {
        reject(error);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      reject(new Error('ffmpeg timeout after 30 seconds'));
    }, 30000);
  });
}

/**
 * Cleanup temporary files
 */
async function cleanup(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      await fs.unlink(p);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Queue a thumbnail generation task (non-blocking)
 * This function returns immediately and processes the thumbnail in the background
 */
export function queueThumbnailGeneration(
  videoBuffer: Buffer,
  fileId: string,
  mimeType: string
): void {
  // Run in background, don't await
  generateThumbnail(videoBuffer, fileId, mimeType).catch((error) => {
    console.error(`Background thumbnail generation failed for ${fileId}:`, error);
  });
}
