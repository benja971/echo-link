import { Router, Request, Response } from 'express';
import { config } from '../config';
import {
  getUserByEmail,
  createUser,
  createMagicLink,
  getMagicLinkByToken,
  isMagicLinkValid,
  markMagicLinkAsUsed,
  createUploadToken,
  updateUserLastLogin,
} from '../services/userService';
import { sendMagicLink } from '../services/emailService';

const router = Router();

// POST /auth/request - Request a magic link
router.post('/request', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email_required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'invalid_email' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Get or create user
    let user = await getUserByEmail(normalizedEmail);
    if (!user) {
      user = await createUser(normalizedEmail);
    }

    // Create magic link
    const magicLink = await createMagicLink(user.id);

    // Build magic link URL
    const magicLinkUrl = `${config.publicBaseUrl}/auth/verify?token=${magicLink.token}`;

    // Send email
    await sendMagicLink({
      email: normalizedEmail,
      magicLinkUrl,
    });

    console.log(`Magic link requested for ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'magic_link_sent',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Magic link request error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /auth/verify?token=... - Verify magic link and return upload token
router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).send(renderErrorPage('Lien invalide', 'Le lien de connexion est invalide.'));
      return;
    }

    // Get magic link
    const magicLink = await getMagicLinkByToken(token);

    if (!magicLink) {
      res.status(404).send(renderErrorPage('Lien introuvable', 'Le lien de connexion est invalide ou a expiré.'));
      return;
    }

    // Validate magic link
    if (!(await isMagicLinkValid(magicLink))) {
      const reason = magicLink.used_at
        ? 'Ce lien a déjà été utilisé.'
        : 'Ce lien a expiré.';

      res.status(400).send(renderErrorPage('Lien invalide', reason));
      return;
    }

    // Mark magic link as used
    await markMagicLinkAsUsed(magicLink.id);

    // Update user last login
    await updateUserLastLogin(magicLink.user_id);

    // Create upload token
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const uploadToken = await createUploadToken(magicLink.user_id, deviceInfo);

    console.log(`Magic link verified for user ${magicLink.user_id}`);

    // Return success page with token
    res.status(200).send(renderSuccessPage(uploadToken.token));
  } catch (error) {
    console.error('Magic link verification error:', error);
    res.status(500).send(renderErrorPage('Erreur serveur', 'Une erreur est survenue lors de la connexion.'));
  }
});

// Helper functions to render HTML pages
function renderSuccessPage(uploadToken: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion réussie - Echo Link</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .success-icon::after {
      content: '✓';
      color: white;
      font-size: 48px;
      font-weight: bold;
    }
    h1 {
      font-size: 28px;
      color: #1a1a1a;
      margin-bottom: 12px;
    }
    p {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .countdown {
      font-size: 14px;
      color: #999;
      margin-top: 16px;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon"></div>
    <h1>Connexion réussie !</h1>
    <p>Vous êtes maintenant connecté à Echo Link.</p>
    <p class="countdown">
      <span class="spinner"></span>
      Redirection automatique dans <span id="countdown">3</span> secondes...
    </p>
  </div>

  <script>
    // Store upload token in localStorage
    localStorage.setItem('echolink_upload_token', '${uploadToken}');

    // Redirect to home page after 3 seconds
    let seconds = 3;
    const countdownEl = document.getElementById('countdown');

    const interval = setInterval(() => {
      seconds--;
      if (countdownEl) {
        countdownEl.textContent = seconds.toString();
      }

      if (seconds <= 0) {
        clearInterval(interval);
        window.location.href = '/app';
      }
    }, 1000);
  </script>
</body>
</html>
  `;
}

function renderErrorPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Echo Link</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      background: #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .error-icon::after {
      content: '✕';
      color: white;
      font-size: 48px;
      font-weight: bold;
    }
    h1 {
      font-size: 28px;
      color: #1a1a1a;
      margin-bottom: 12px;
    }
    p {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background 0.2s;
    }
    a:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon"></div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/app">Retour à l'application</a>
  </div>
</body>
</html>
  `;
}

export default router;
