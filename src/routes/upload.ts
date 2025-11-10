import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { config } from '../config';
import { uploadBuffer, getPublicUrl } from '../services/s3Service';
import { createFileRecord } from '../services/fileService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function authenticateUpload(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const token = authHeader.substring(7);
  
  if (token !== config.uploadToken) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}

router.post('/', authenticateUpload, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    const id = uuidv4();
    const originalExt = path.extname(req.file.originalname);
    const isVideo = req.file.mimetype.startsWith('video/');
    const folder = isVideo ? 'videos' : 'files';
    const key = `${folder}/${id}${originalExt}`;

    console.log(`Uploading file: ${req.file.originalname} (${req.file.size} bytes) as ${key}`);

    await uploadBuffer({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    await createFileRecord({
      id,
      key,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      title: req.file.originalname,
    });

    const shareUrl = `${config.publicBaseUrl}/v/${id}`;
    const directUrl = getPublicUrl(key);

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
