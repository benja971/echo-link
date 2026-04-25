import { Router, Request, Response } from 'express';
import { getFileById } from '../services/fileService';
import { getS3Object } from '../services/s3Service';

const router = Router();

// Handle CORS preflight
router.options('/:path(*)', (req: Request, res: Response): void => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.status(204).send();
});

router.get('/:path(*)', async (req: Request, res: Response): Promise<void> => {
  try {
    const fullPath = req.params.path;

    // Extract the UUID from the path (e.g., "videos/abc-123.mp4" -> "abc-123")
    const pathParts = fullPath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const fileId = filename.split('.')[0]; // Remove extension

    // Get file record from database
    const file = await getFileById(fileId);

    if (!file) {
      res.status(404).json({ error: 'file_not_found' });
      return;
    }

    // Check if file has expired
    if (file.expires_at && new Date() > file.expires_at) {
      res.status(410).json({ error: 'file_expired' });
      return;
    }

    // Get file stream from S3
    const stream = await getS3Object(file.s3_key);

    // Set appropriate headers
    const isMedia = file.mime_type.startsWith('image/') || file.mime_type.startsWith('video/');

    if (isMedia) {
      // Images and videos: serve inline for embeds, but sandbox to block JS (e.g. SVG scripts)
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Content-Security-Policy', 'sandbox');
    } else {
      // Everything else: force download to prevent browser execution
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.title || 'download')}"`);
    }

    res.setHeader('Content-Length', file.size_bytes);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests for video seeking
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Security header

    // Add CORS headers for embedding
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    // Stream the file to the response
    stream.pipe(res);

    // Handle stream errors
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'stream_error' });
      }
    });

  } catch (error) {
    console.error('File serving error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_error' });
    }
  }
});

export default router;
