import { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { createFileRecord } from '../services/fileService';
import { getPublicUrl, uploadBuffer } from '../services/s3Service';
import { queueThumbnailGeneration } from '../services/thumbnailService';
import { checkUserQuota, getUserByUploadToken } from '../services/userService';

const router = Router();

// 100 MB file size limit
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Fix UTF-8 encoding for filenames uploaded via multipart/form-data
function fixFilenameEncoding(filename: string): string {
  try {
    // Multer receives filenames in Latin1 (ISO-8859-1), but they're actually UTF-8
    // We need to decode from Latin1 and re-encode as UTF-8
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch (error) {
    console.error('Failed to fix filename encoding:', error);
    return filename;
  }
}

async function authenticateUpload(req: Request, res: Response, next: Function): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const token = authHeader.substring(7);

  const user = await getUserByUploadToken(token);
  if (user) {
    (req as any).user = user;
    next();
    return;
  }

  res.status(401).json({ error: 'unauthorized' });
}

router.post('/', authenticateUpload, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    const user = (req as any).user;
    const id = uuidv4();
    const originalFilename = fixFilenameEncoding(req.file.originalname);
    const originalExt = path.extname(originalFilename);
    const isVideo = req.file.mimetype.startsWith('video/');
    const isImage = req.file.mimetype.startsWith('image/');
    const folder = isVideo ? 'videos' : 'files';
    const key = `${folder}/${id}${originalExt}`;

    console.log(`Uploading file: ${originalFilename} (${req.file.size} bytes) as ${key} for user ${user.email}`);

    // Check quota
    const quotaCheck = await checkUserQuota(user.id, req.file.size);
    if (!quotaCheck.allowed) {
      res.status(429).json({
        error: 'quota_exceeded',
        message: quotaCheck.reason
      });
      return;
    }

    // Extract image dimensions if it's an image
    let width: number | undefined;
    let height: number | undefined;

    if (isImage) {
      try {
        const metadata = await sharp(req.file.buffer).metadata();
        width = metadata.width;
        height = metadata.height;
        console.log(`Image dimensions: ${width}x${height}`);
      } catch (error) {
        console.error('Failed to extract image dimensions:', error);
      }
    }

    await uploadBuffer({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.files.expirationDays);

    await createFileRecord({
      id,
      key,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      userId: user.id,
      title: originalFilename,
      width,
      height,
      expiresAt,
    });

    const shareUrl = `${config.publicBaseUrl}/v/${id}`;
    const directUrl = getPublicUrl(key);

    // Queue async thumbnail generation for videos (non-blocking)
    if (isVideo) {
      queueThumbnailGeneration(req.file.buffer, id, req.file.mimetype);
    }

    res.status(200).json({
      id,
      shareUrl,
      directUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'upload_failed' });
  }
});

export default router;
