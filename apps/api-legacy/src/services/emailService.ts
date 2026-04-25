import nodemailer from 'nodemailer';
import { config } from '../config';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.auth.user,
    pass: config.email.auth.pass,
  },
  tls: {
    rejectUnauthorized: false, // Accept self-signed certificates (Proton Bridge)
  },
});

interface SendMagicLinkParams {
  email: string;
  magicLinkUrl: string;
}

export async function sendMagicLink(params: SendMagicLinkParams): Promise<void> {
  const { email, magicLinkUrl } = params;

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion à Echo Link</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #1a1a1a;">
                Echo Link
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: #666;">
                Partage de fichiers rapide et sécurisé
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                Bonjour,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333;">
                Vous avez demandé à accéder à votre espace Echo Link. Cliquez sur le bouton ci-dessous pour vous connecter :
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" style="display: inline-block; padding: 16px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Se connecter à Echo Link
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #666;">
                Ce lien est valide pendant <strong>${config.magicLink.expirationMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.
              </p>

              <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #666;">
                Si vous n'avez pas demandé cette connexion, vous pouvez ignorer cet email en toute sécurité.
              </p>

              <!-- Alternative Link -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 6px;">
                <p style="margin: 0 0 10px; font-size: 13px; color: #666;">
                  Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                </p>
                <p style="margin: 0; font-size: 13px; color: #3b82f6; word-break: break-all;">
                  ${magicLinkUrl}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #999;">
                Echo Link - Service de partage de fichiers
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Connexion à Echo Link

Bonjour,

Vous avez demandé à accéder à votre espace Echo Link. Cliquez sur le lien ci-dessous pour vous connecter :

${magicLinkUrl}

Ce lien est valide pendant ${config.magicLink.expirationMinutes} minutes et ne peut être utilisé qu'une seule fois.

Si vous n'avez pas demandé cette connexion, vous pouvez ignorer cet email en toute sécurité.

---
Echo Link - Service de partage de fichiers
  `;

  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject: 'Connexion à Echo Link - Magic Link',
    text: textContent,
    html: htmlContent,
  });

  console.log(`Magic link email sent to ${email}`);
}

// Verify transporter configuration on startup
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('Email configuration verification failed:', error);
    return false;
  }
}
