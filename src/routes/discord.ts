import { timingSafeEqual } from 'crypto';
import { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { sendUploadCompletionMessage } from '../services/discordNotificationService';
import {
  completeDiscordUploadSession,
  createDiscordUploadSession,
  getDiscordUploadSessionByToken,
  isSessionValid,
} from '../services/discordSessionService';
import { createFileRecord } from '../services/fileService';
import { getPublicUrl, uploadBuffer } from '../services/s3Service';
import { queueThumbnailGeneration } from '../services/thumbnailService';
import { assertUploadAllowed } from '../services/uploadLimitsService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.files.maxSizeBytes,
  },
});

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

// Fix UTF-8 encoding for filenames
function fixFilenameEncoding(filename: string): string {
  try {
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}

/**
 * POST /discord/upload-session
 * Called by the Discord bot to create an upload session
 */
router.post('/upload-session', async (req: Request, res: Response): Promise<void> => {
  try {
    // Authenticate bot
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const token = authHeader.substring(7);
    if (!config.discordBot.botToken || !safeCompare(token, config.discordBot.botToken)) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid bot token' });
      return;
    }

    // Check required headers
    const discordUserId = req.headers['x-discord-user-id'] as string | undefined;
    const discordUserName = req.headers['x-discord-user-name'] as string | undefined;
    const discordChannelId = req.headers['x-discord-channel-id'] as string | undefined;
    const discordGuildId = req.headers['x-discord-guild-id'] as string | undefined;
    const discordInteractionToken = req.headers['x-discord-interaction-token'] as string | undefined;
    const discordApplicationId = req.headers['x-discord-application-id'] as string | undefined;

    if (!discordUserId) {
      res.status(400).json({ error: 'missing_header', message: 'X-Discord-User-Id required' });
      return;
    }

    if (!discordChannelId) {
      res.status(400).json({ error: 'missing_header', message: 'X-Discord-Channel-Id required' });
      return;
    }

    // Create upload session
    const { session, uploadUrl } = await createDiscordUploadSession({
      discordUserId,
      discordUserName,
      discordChannelId,
      discordGuildId,
      discordInteractionToken,
      discordApplicationId,
    });

    const fullUploadUrl = `${config.publicBaseUrl}${uploadUrl}`;

    res.status(200).json({
      sessionId: session.id,
      uploadUrl: fullUploadUrl,
      expiresAt: session.expires_at.toISOString(),
    });
  } catch (error) {
    console.error('Failed to create Discord upload session:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /discord/upload/:token
 * Redirect to React app with discord session token
 */
router.get('/upload/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const session = await getDiscordUploadSessionByToken(token);

    if (!session) {
      res.status(404).send(renderErrorPage('Session introuvable', 'Ce lien d\'upload n\'existe pas ou a expiré.'));
      return;
    }

    const validation = isSessionValid(session);
    if (!validation.valid) {
      res.status(400).send(renderErrorPage('Session invalide', validation.reason || 'Cette session n\'est plus valide.'));
      return;
    }

    // Redirect to React app with discord session token
    res.redirect(`/app?discord_session=${token}`);
  } catch (error) {
    console.error('Failed to load Discord upload page:', error);
    res.status(500).send(renderErrorPage('Erreur serveur', 'Un problème est survenu.'));
  }
});

/**
 * GET /discord/session/:token
 * Get session info for the frontend
 */
router.get('/session/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const session = await getDiscordUploadSessionByToken(token);

    if (!session) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }

    const validation = isSessionValid(session);
    if (!validation.valid) {
      res.status(400).json({ error: 'session_invalid', message: validation.reason });
      return;
    }

    res.status(200).json({
      valid: true,
      userName: session.discord_user_name || 'Utilisateur Discord',
      expiresAt: session.expires_at.toISOString(),
    });
  } catch (error) {
    console.error('Failed to get Discord session:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /discord/upload/:token
 * Handle file upload from Discord session
 */
router.post('/upload/:token', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const session = await getDiscordUploadSessionByToken(token);

    if (!session) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }

    const validation = isSessionValid(session);
    if (!validation.valid) {
      res.status(400).json({ error: 'session_invalid', message: validation.reason });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    const identity = session.identity;

    // Check upload limits
    const limitCheck = await assertUploadAllowed(identity, req.file.size);
    if (!limitCheck.allowed) {
      res.status(429).json({ error: 'quota_exceeded', message: limitCheck.reason });
      return;
    }

    // Process upload
    const id = uuidv4();
    const originalFilename = fixFilenameEncoding(req.file.originalname);
    const originalExt = path.extname(originalFilename);
    const isVideo = req.file.mimetype.startsWith('video/');
    const isImage = req.file.mimetype.startsWith('image/');
    const folder = isVideo ? 'videos' : 'files';
    const key = `${folder}/${id}${originalExt}`;

    console.log(`Discord upload: ${originalFilename} (${req.file.size} bytes) for Discord user ${session.discord_user_id}`);

    // Extract dimensions for images
    let width: number | undefined;
    let height: number | undefined;

    if (isImage) {
      try {
        const metadata = await sharp(req.file.buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        console.error('Failed to extract image dimensions:', error);
      }
    }

    // Upload to S3
    await uploadBuffer({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.files.expirationDays);

    // Create file record
    await createFileRecord({
      id,
      key,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadIdentityId: identity.id,
      title: originalFilename,
      width,
      height,
      expiresAt,
    });

    // Mark session as completed
    await completeDiscordUploadSession(session.id, id);

    const shareUrl = `${config.publicBaseUrl}/v/${id}`;
    const directUrl = getPublicUrl(key);

    // Queue thumbnail generation for videos
    if (isVideo) {
      queueThumbnailGeneration(req.file.buffer, id, req.file.mimetype);
    }

    // Send ephemeral notification to Discord with buttons
    await sendUploadCompletionMessage(
      session.discord_application_id,
      session.discord_interaction_token,
      session.discord_channel_id,
      session.discord_user_id,
      session.discord_user_name || 'Utilisateur',
      originalFilename,
      req.file.size,
      shareUrl,
      id
    );

    res.status(200).json({
      id,
      shareUrl,
      directUrl,
      discordChannelId: session.discord_channel_id,
      discordGuildId: session.discord_guild_id,
    });
  } catch (error) {
    console.error('Discord upload error:', error);
    res.status(500).json({ error: 'upload_failed' });
  }
});

/**
 * Render error page
 */
function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erreur - Echo Link</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    h1 { color: #e74c3c; margin-bottom: 10px; }
    p { color: rgba(255, 255, 255, 0.7); }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ ${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;
