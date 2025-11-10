import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { config } from '../config';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    await query('SELECT 1');
    
    const isS3ConfigValid =
      config.s3.endpoint &&
      config.s3.bucket &&
      config.s3.accessKey &&
      config.s3.secretKey;

    if (!isS3ConfigValid) {
      res.status(500).json({ status: 'error', message: 'S3 configuration incomplete' });
      return;
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error' });
  }
});

export default router;
