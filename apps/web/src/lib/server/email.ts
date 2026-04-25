import { Resend } from 'resend';
import { env } from './env';

let _client: Resend | null = null;

function client() {
  if (_client) return _client;
  _client = new Resend(env().RESEND_API_KEY);
  return _client;
}

export async function sendMagicLink(to: string, link: string) {
  const result = await client().emails.send({
    from: env().EMAIL_FROM,
    to,
    subject: 'your echo·link sign-in link',
    text: `click to sign in:\n\n${link}\n\nthis link expires in ${env().MAGIC_LINK_EXPIRATION_MINUTES} minutes.`,
    html: `
      <div style="font-family: ui-monospace, monospace; padding: 24px; background: #1e1e2e; color: #cdd6f4;">
        <p style="font-size: 14px; color: #a6adc8;">your sign-in link:</p>
        <p style="margin: 16px 0;">
          <a href="${link}" style="display: inline-block; padding: 10px 18px; background: #cba6f7; color: #1e1e2e; border-radius: 6px; text-decoration: none; font-weight: 500;">sign in to echo·link →</a>
        </p>
        <p style="font-size: 12px; color: #6c7086;">expires in ${env().MAGIC_LINK_EXPIRATION_MINUTES} minutes. ignore this email if you didn't request it.</p>
      </div>
    `
  });
  if (result.error) throw new Error(`resend: ${result.error.message}`);
}
