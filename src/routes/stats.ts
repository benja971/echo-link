import { Router, Request, Response } from 'express';
import { getUserByUploadToken, getUserQuotaUsage, getGlobalStats } from '../services/userService';
import { getRecentFilesByUser, getRecentFilesGlobal } from '../services/fileService';
import { config } from '../config';

const router = Router();

// Middleware to authenticate user via upload token
async function authenticateUser(req: Request, res: Response, next: Function): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const token = authHeader.substring(7);
  const user = await getUserByUploadToken(token);

  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  (req as any).user = user;
  next();
}

// GET /stats/me - Get current user statistics
router.get('/me', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    // Get quota usage
    const quotaUsage = await getUserQuotaUsage(user.id);

    // Get recent files
    const recentFiles = await getRecentFilesByUser(user.id, 10);

    // Format recent files for response
    const formattedFiles = recentFiles.map(file => ({
      id: file.id,
      title: file.title,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      shareUrl: `${config.publicBaseUrl}/v/${file.id}`,
    }));

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      quota: {
        files: {
          used: quotaUsage.total_files,
          max: quotaUsage.quota_max_files,
          percentage: quotaUsage.quota_files_percentage,
        },
        storage: {
          usedBytes: quotaUsage.total_bytes,
          maxBytes: quotaUsage.quota_max_bytes,
          percentage: quotaUsage.quota_bytes_percentage,
        },
      },
      recentFiles: formattedFiles,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /stats/global - Get global platform statistics (authenticated)
router.get('/global', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const globalStats = await getGlobalStats();
    const recentFiles = await getRecentFilesGlobal(10);

    const formattedFiles = recentFiles.map(file => ({
      id: file.id,
      title: file.title,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      shareUrl: `${config.publicBaseUrl}/v/${file.id}`,
    }));

    res.status(200).json({
      totals: {
        users: globalStats.total_users,
        files: globalStats.total_files,
        storageBytes: globalStats.total_bytes,
      },
      today: {
        files: globalStats.files_today,
        storageBytes: globalStats.bytes_today,
      },
      thisWeek: {
        files: globalStats.files_this_week,
        storageBytes: globalStats.bytes_this_week,
      },
      thisMonth: {
        files: globalStats.files_this_month,
        storageBytes: globalStats.bytes_this_month,
      },
      recentFiles: formattedFiles,
    });
  } catch (error) {
    console.error('Global stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
