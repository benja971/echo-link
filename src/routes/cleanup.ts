import { Request, Response, Router } from 'express';
import { deleteFile, getFileById } from '../services/fileService';
import { getUserByUploadToken } from '../services/userService';

const router = Router();

// Authenticate user via upload token
async function authenticateUser(req: Request, res: Response, next: Function): Promise<void> {
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

// Delete a specific file (only if owned by the authenticated user)
router.delete('/:fileId', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    const user = (req as any).user;

    // Get the file to check ownership
    const file = await getFileById(fileId);

    if (!file) {
      res.status(404).json({ error: 'file_not_found' });
      return;
    }

    // Check that the user owns this file
    if (file.user_id !== user.id) {
      res.status(403).json({ error: 'forbidden', message: 'You can only delete your own files' });
      return;
    }

    await deleteFile(fileId);

    console.log(`User ${user.email} deleted file ${fileId}`);

    res.json({
      success: true,
      deleted: fileId,
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'delete_failed' });
  }
});

export default router;
