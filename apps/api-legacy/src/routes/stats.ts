import { Router, Request, Response } from 'express';
import { getUserByUploadToken, getUserQuotaUsage, getGlobalStats } from '../services/userService';
import { getRecentFilesByUser, getRecentFilesGlobal, getRecentFilesByAccount } from '../services/fileService';
import { getOrCreateUploadIdentity, UploadIdentity } from '../services/uploadIdentityService';
import { getAccountStats, getAccountIdentities, Account } from '../services/accountService';
import { config } from '../config';

const router = Router();

// Extended request type for stats routes
interface AuthenticatedRequest extends Request {
  user?: any;
  uploadIdentity?: UploadIdentity;
  account?: Account;
}

// Middleware to authenticate user via upload token and resolve account
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
  
  // Get or create upload identity and account for this user
  const uploadIdentity = await getOrCreateUploadIdentity('web_user', user.id, user.email);
  (req as any).uploadIdentity = uploadIdentity;
  
  if (uploadIdentity.account_id) {
    (req as any).accountId = uploadIdentity.account_id;
  }
  
  next();
}

// GET /stats/me - Get current user/account statistics (unified view across all identities)
router.get('/me', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const accountId = (req as any).accountId;
    const uploadIdentity = (req as any).uploadIdentity;

    // Get account-based stats if available (unified across web + Discord)
    let accountStats = null;
    let recentFiles: any[] = [];
    let identities: any[] = [];
    
    if (accountId) {
      accountStats = await getAccountStats(accountId);
      recentFiles = await getRecentFilesByAccount(accountId, 10);
      identities = await getAccountIdentities(accountId);
    } else {
      // Fallback to legacy user-based stats
      const quotaUsage = await getUserQuotaUsage(user.id);
      accountStats = {
        account_id: user.id,
        total_files: quotaUsage.total_files,
        total_bytes: quotaUsage.total_bytes,
        files_last_24h: 0,
        bytes_last_24h: 0,
      };
      recentFiles = await getRecentFilesByUser(user.id, 10);
    }

    // Format recent files for response (include source info)
    const formattedFiles = recentFiles.map((file: any) => ({
      id: file.id,
      title: file.title,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      shareUrl: `${config.publicBaseUrl}/v/${file.id}`,
      source: file.source_kind || 'unknown',
      sourceDisplayName: file.source_display_name || null,
    }));

    // Format identities for response
    const formattedIdentities = identities.map((identity: any) => ({
      id: identity.id,
      kind: identity.kind,
      displayName: identity.display_name,
      createdAt: identity.created_at,
    }));

    // Calculate quota percentages (use config limits)
    const maxFiles = config.files.maxPerUser;
    const maxBytes = config.files.maxSizeBytesPerUser;

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      account: accountId ? {
        id: accountId,
        identities: formattedIdentities,
      } : null,
      quota: {
        files: {
          used: accountStats.total_files,
          max: maxFiles,
          percentage: maxFiles > 0 ? Math.round((accountStats.total_files / maxFiles) * 100) : 0,
        },
        storage: {
          usedBytes: accountStats.total_bytes,
          maxBytes: maxBytes,
          percentage: maxBytes > 0 ? Math.round((accountStats.total_bytes / maxBytes) * 100) : 0,
        },
        last24h: {
          files: accountStats.files_last_24h,
          bytes: accountStats.bytes_last_24h,
        },
      },
      recentFiles: formattedFiles,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /stats/files - Get all account files (unified across all identities)
router.get('/files', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const accountId = (req as any).accountId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000; // Default to 1000 max

    // Use account-based file list if available (unified across web + Discord)
    let files: any[];
    if (accountId) {
      files = await getRecentFilesByAccount(accountId, limit);
    } else {
      // Fallback to legacy user-based list
      files = await getRecentFilesByUser(user.id, limit);
    }

    const formattedFiles = files.map((file: any) => ({
      id: file.id,
      title: file.title,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      shareUrl: `${config.publicBaseUrl}/v/${file.id}`,
      directUrl: `${config.publicBaseUrl}/files/${file.s3_key}`,
      source: file.source_kind || 'unknown',
      sourceDisplayName: file.source_display_name || null,
    }));

    res.status(200).json({
      files: formattedFiles,
    });
  } catch (error) {
    console.error('Files list error:', error);
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
