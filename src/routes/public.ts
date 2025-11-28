import { Router, Request, Response } from 'express';
import { getFileById } from '../services/fileService';
import { getPublicUrl } from '../services/s3Service';
import { config } from '../config';

const router = Router();

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const file = await getFileById(id);

    if (!file) {
      res.status(404).send('File not found');
      return;
    }

    if (file.expires_at && new Date(file.expires_at) < new Date()) {
      res.status(404).send('File expired');
      return;
    }

    const fileUrl = getPublicUrl(file.s3_key);
    const isVideo = file.mime_type.startsWith('video/');
    const isImage = file.mime_type.startsWith('image/');

    // Determine thumbnail URL
    let thumbUrl: string;
    if (file.thumbnail_s3_key) {
      // Use generated thumbnail if available
      thumbUrl = getPublicUrl(file.thumbnail_s3_key);
    } else if (isImage) {
      // For images, use the image itself as thumbnail
      thumbUrl = fileUrl;
    } else {
      // For videos without thumbnails, use a placeholder
      // Discord requires an actual image URL, not a video file
      thumbUrl = `${config.publicBaseUrl}/placeholder-video.jpg`;
    }

    const pageUrl = `${config.publicBaseUrl}/v/${id}`;

    // Generate optimized title (50-60 chars for Open Graph)
    const baseTitle = file.title || 'Shared file';
    const title = baseTitle.length < 50
      ? `${baseTitle} - Shared via echo-link`
      : baseTitle;

    // Generate optimized description (110-160 chars for Open Graph)
    const fileTypeLabel = isVideo ? 'video' : isImage ? 'image' : 'file';
    const sizeLabel = formatBytes(file.size_bytes);
    const description = `View and download this ${fileTypeLabel} (${sizeLabel}) shared securely via echo-link. Click to access the full-quality ${fileTypeLabel}.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  
  <!-- Open Graph meta tags -->
  <meta property="og:site_name" content="echo-link" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  ${isVideo ? `<meta property="og:type" content="video.other" />
  <meta property="og:video" content="${escapeHtml(fileUrl)}" />
  <meta property="og:video:url" content="${escapeHtml(fileUrl)}" />
  <meta property="og:video:secure_url" content="${escapeHtml(fileUrl)}" />
  <meta property="og:video:type" content="${escapeHtml(file.mime_type)}" />
  <meta property="og:video:width" content="${file.width || 1920}" />
  <meta property="og:video:height" content="${file.height || 1080}" />
  <meta property="og:image" content="${escapeHtml(thumbUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(thumbUrl)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="${escapeHtml(title)} thumbnail" />` : ''}
  ${isImage ? `<meta property="og:type" content="website" />
  <meta property="og:image" content="${escapeHtml(fileUrl)}" />
  <meta property="og:image:url" content="${escapeHtml(fileUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(fileUrl)}" />
  <meta property="og:image:type" content="${escapeHtml(file.mime_type)}" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  ${file.width ? `<meta property="og:image:width" content="${file.width}" />` : ''}
  ${file.height ? `<meta property="og:image:height" content="${file.height}" />` : ''}` : ''}

  <!-- Twitter Card meta tags (required for Discord) -->
  <meta name="twitter:card" content="${isImage ? 'summary_large_image' : 'player'}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(isImage ? fileUrl : thumbUrl)}" />
  ${isVideo ? `<meta name="twitter:player" content="${escapeHtml(pageUrl)}" />
  <meta name="twitter:player:width" content="${file.width || 1920}" />
  <meta name="twitter:player:height" content="${file.height || 1080}" />
  <meta name="twitter:player:stream" content="${escapeHtml(fileUrl)}" />
  <meta name="twitter:player:stream:content_type" content="${escapeHtml(file.mime_type)}" />` : ''}

  <!-- Discord theme color -->
  <meta name="theme-color" content="#5865F2" />
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .container {
      width: 100%;
      max-width: 1200px;
      padding: 20px;
    }
    video, img {
      width: 100%;
      max-height: 100vh;
      display: block;
      object-fit: contain;
    }
    .info {
      color: #fff;
      margin-top: 20px;
      padding: 15px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
    }
    .info h1 {
      font-size: 1.5rem;
      margin-bottom: 10px;
    }
    .info p {
      color: #ccc;
      font-size: 0.9rem;
    }
    a {
      color: #6ca0ff;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    ${isVideo ? `<video controls preload="metadata">
      <source src="${escapeHtml(fileUrl)}" type="${escapeHtml(file.mime_type)}">
      Your browser does not support the video tag.
    </video>` : ''}
    ${isImage ? `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(title)}" />` : ''}
    ${!isVideo && !isImage ? `<div class="info">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><a href="${escapeHtml(fileUrl)}" download>Download file</a></p>
    </div>` : ''}
    ${(isVideo || isImage) ? `<div class="info">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><a href="${escapeHtml(fileUrl)}" download>Download file</a></p>
    </div>` : ''}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Public page error:', error);
    res.status(500).send('Internal server error');
  }
});

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default router;
