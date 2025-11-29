import { Request, Response, Router } from 'express';
import { deleteFile, getFileById } from '../services/fileService';
import { getUserByUploadToken } from '../services/userService';

const router = Router();

async function authenticateRequest(req: Request, res: Response, next: Function): Promise<void> {
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

router.delete('/:id', authenticateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params.id;
    const user = (req as any).user;

    // Get file to check ownership
    const file = await getFileById(fileId);

    if (!file) {
      res.status(404).json({ error: 'file_not_found' });
      return;
    }

    // Verify the file belongs to the user
    if (file.user_id !== user.id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Delete the file (handles S3 and database)
    await deleteFile(fileId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'delete_failed' });
  }
});

export default router;
