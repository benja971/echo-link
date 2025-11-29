import { timingSafeEqual } from 'crypto';
import { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { createFileRecord } from '../services/fileService';
import { getPublicUrl, uploadBuffer } from '../services/s3Service';
import { queueThumbnailGeneration } from '../services/thumbnailService';
import { getOrCreateUploadIdentity, UploadIdentity } from '../services/uploadIdentityService';
import { assertUploadAllowed } from '../services/uploadLimitsService';
import { checkUserQuota, getUserByUploadToken } from '../services/userService';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      uploadIdentity?: UploadIdentity;
    }
  }
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.files.maxSizeBytes
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

// Timing-safe comparison for tokens
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Combined authentication middleware for web users and Discord bot
async function authenticateUpload(req: Request, res: Response, next: Function): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const token = authHeader.substring(7);

  // Check if this is a Discord bot request
  const xClient = req.headers['x-client'] as string | undefined;

  if (xClient === 'discord-bot' && config.discordBot.botToken) {
    // Discord bot authentication
    if (!safeCompare(token, config.discordBot.botToken)) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid bot token' });
      return;
    }

    // Get Discord user info from headers
    const discordUserId = req.headers['x-discord-user-id'] as string | undefined;
    const discordUserName = req.headers['x-discord-user-name'] as string | undefined;
    const discordGuildId = req.headers['x-discord-guild-id'] as string | undefined;

    if (!discordUserId) {
      res.status(401).json({ error: 'unauthorized', message: 'X-Discord-User-Id header required' });
      return;
    }

    // Create or get upload identity for this Discord user
    const extraMetadata: Record<string, any> = {};
    if (discordGuildId) {
      extraMetadata.guild_id = discordGuildId;
    }

    const uploadIdentity = await getOrCreateUploadIdentity(
      'discord_user',
      discordUserId,
      discordUserName,
      Object.keys(extraMetadata).length > 0 ? extraMetadata : undefined
    );

    req.uploadIdentity = uploadIdentity;
    console.log(`Discord bot auth: user ${discordUserId} (${discordUserName || 'unknown'})`);
    next();
    return;
  }

  // Web user authentication (existing flow)
  const user = await getUserByUploadToken(token);
  if (user) {
    req.user = user;

    // Create or get upload identity for this web user
    const uploadIdentity = await getOrCreateUploadIdentity(
      'web_user',
      user.id,
      user.email
    );

    req.uploadIdentity = uploadIdentity;
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

    if (!req.uploadIdentity) {
      res.status(401).json({ error: 'unauthorized', message: 'Upload identity not found' });
      return;
    }

    const user = req.user;
    const uploadIdentity = req.uploadIdentity;
    const id = uuidv4();
    const originalFilename = fixFilenameEncoding(req.file.originalname);
    const originalExt = path.extname(originalFilename);
    const isVideo = req.file.mimetype.startsWith('video/');
    const isImage = req.file.mimetype.startsWith('image/');
    const folder = isVideo ? 'videos' : 'files';
    const key = `${folder}/${id}${originalExt}`;

    const identityInfo = uploadIdentity.kind === 'discord_user'
      ? `Discord user ${uploadIdentity.external_id} (${uploadIdentity.display_name || 'unknown'})`
      : `user ${user?.email || uploadIdentity.external_id}`;
    console.log(`Uploading file: ${originalFilename} (${req.file.size} bytes) as ${key} for ${identityInfo}`);

    // Check upload limits based on identity (for all identity types)
    const limitCheck = await assertUploadAllowed(uploadIdentity, req.file.size);
    if (!limitCheck.allowed) {
      res.status(429).json({
        error: 'quota_exceeded',
        message: limitCheck.reason
      });
      return;
    }

    // Also check legacy user quota for web users (if user exists)
    if (user) {
      const quotaCheck = await checkUserQuota(user.id, req.file.size);
      if (!quotaCheck.allowed) {
        res.status(429).json({
          error: 'quota_exceeded',
          message: quotaCheck.reason
        });
        return;
      }
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
      userId: user?.id,
      uploadIdentityId: uploadIdentity.id,
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
