import { Request, Response, Router } from 'express';
import { getAccountById, getAccountIdentities } from '../services/accountService';
import { createDiscordLinkRequest, getPendingLinkRequestsForAccount } from '../services/discordLinkService';
import { deleteUploadIdentity, getOrCreateUploadIdentity, getUploadIdentityById, UploadIdentity } from '../services/uploadIdentityService';
import { getUserByUploadToken } from '../services/userService';

const router = Router();

// Extended request type
interface AuthenticatedRequest extends Request {
  user?: any;
  uploadIdentity?: UploadIdentity;
  accountId?: string;
}

/**
 * Middleware to authenticate user via upload token and resolve account
 */
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

  (req as AuthenticatedRequest).user = user;

  // Get or create upload identity and account for this user
  const uploadIdentity = await getOrCreateUploadIdentity('web_user', user.id, user.email);
  (req as AuthenticatedRequest).uploadIdentity = uploadIdentity;

  if (uploadIdentity.account_id) {
    (req as AuthenticatedRequest).accountId = uploadIdentity.account_id;
  }

  next();
}

/**
 * POST /me/discord/link/start
 * Generate a code for linking Discord account
 */
router.post('/discord/link/start', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const accountId = (req as AuthenticatedRequest).accountId;

    if (!accountId) {
      res.status(400).json({ error: 'no_account', message: 'No account found for this user.' });
      return;
    }

    // Create a new link request
    const { code, expiresAt } = await createDiscordLinkRequest(accountId);

    res.status(200).json({
      code,
      expiresAt: expiresAt.toISOString(),
      instructions: 'Sur Discord, exécute la commande: /link code:' + code,
    });
  } catch (error) {
    console.error('Failed to create Discord link request:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /me/discord/link/status
 * Get current link status and pending requests
 */
router.get('/discord/link/status', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const accountId = (req as AuthenticatedRequest).accountId;

    if (!accountId) {
      res.status(400).json({ error: 'no_account', message: 'No account found for this user.' });
      return;
    }

    // Get all identities for this account
    const identities = await getAccountIdentities(accountId);

    // Check if any Discord identities are linked
    const discordIdentities = identities.filter(i => i.kind === 'discord_user');
    const hasDiscordLinked = discordIdentities.length > 0;

    // Get pending link requests
    const pendingRequests = await getPendingLinkRequestsForAccount(accountId);

    res.status(200).json({
      hasDiscordLinked,
      discordIdentities: discordIdentities.map(i => ({
        id: i.id,
        displayName: i.display_name,
        externalId: i.external_id,
        createdAt: i.created_at,
      })),
      pendingRequests: pendingRequests.map(r => ({
        code: r.code,
        expiresAt: r.expires_at,
      })),
    });
  } catch (error) {
    console.error('Failed to get Discord link status:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /me/identities
 * Get all linked identities for the current account
 */
router.get('/identities', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const accountId = (req as AuthenticatedRequest).accountId;

    if (!accountId) {
      res.status(400).json({ error: 'no_account', message: 'No account found for this user.' });
      return;
    }

    const account = await getAccountById(accountId);
    const identities = await getAccountIdentities(accountId);

    res.status(200).json({
      account: account ? {
        id: account.id,
        primaryEmail: account.primary_email,
        createdAt: account.created_at,
      } : null,
      identities: identities.map(i => ({
        id: i.id,
        kind: i.kind,
        displayName: i.display_name,
        externalId: i.external_id,
        createdAt: i.created_at,
      })),
    });
  } catch (error) {
    console.error('Failed to get identities:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * DELETE /me/discord/unlink/:identityId
 * Unlink a Discord identity from the account
 */
router.delete('/discord/unlink/:identityId', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const accountId = (req as AuthenticatedRequest).accountId;
    const { identityId } = req.params;

    if (!accountId) {
      res.status(400).json({ error: 'no_account', message: 'No account found for this user.' });
      return;
    }

    // Get the identity to verify it belongs to this account and is a Discord identity
    const identity = await getUploadIdentityById(identityId);

    if (!identity) {
      res.status(404).json({ error: 'not_found', message: 'Identity not found.' });
      return;
    }

    if (identity.account_id !== accountId) {
      res.status(403).json({ error: 'forbidden', message: 'This identity does not belong to your account.' });
      return;
    }

    if (identity.kind !== 'discord_user') {
      res.status(400).json({ error: 'invalid_identity', message: 'Only Discord identities can be unlinked.' });
      return;
    }

    // Delete the identity
    await deleteUploadIdentity(identityId);

    res.status(200).json({
      success: true,
      message: 'Compte Discord délié avec succès.',
    });
  } catch (error) {
    console.error('Failed to unlink Discord identity:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
