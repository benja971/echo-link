import { Router, Request, Response } from 'express';
import { getFileById } from '../services/fileService';
import { getS3Object } from '../services/s3Service';

const router = Router();

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
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.size_bytes);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests for video seeking

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
