import { Resend } from "resend";
import { env } from "../env";

let _client: Resend | null = null;

function client() {
  if (_client) return _client;
  _client = new Resend(env().RESEND_API_KEY);
  return _client;
}

export function renderMagicLinkEmail(link: string, expirationMinutes: number) {
  const safeLink = link.replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character]!;
  });

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Sign in to echo·link</title>
    <style>
      :root { color-scheme: light dark; }
      a:focus-visible { outline: 2px solid #1f4f91; outline-offset: 3px; }
      .email-button:hover { background-color: #183c6e !important; border-color: #183c6e !important; }
      @media (prefers-color-scheme: dark) {
        .email-background { background-color: #18181b !important; }
        .email-surface { background-color: #202024 !important; border-color: #3a3a41 !important; }
        .email-text { color: #f4f4f5 !important; }
        .email-muted { color: #d0d0d6 !important; }
        .email-divider { border-color: #3a3a41 !important; }
        .email-link, .email-dot { color: #a2c4fb !important; }
        .email-button { background-color: #a2c4fb !important; border-color: #a2c4fb !important; color: #131316 !important; }
        .email-button:hover { background-color: #b8d2fc !important; border-color: #b8d2fc !important; }
        a:focus-visible { outline-color: #a2c4fb; }
      }
    </style>
  </head>
  <body class="email-background" style="margin: 0; padding: 0; background-color: #fafbf9; color: #202920; font-family: 'Geist Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; -webkit-text-size-adjust: 100%;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">Your sign-in link expires in ${expirationMinutes} minutes.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-background" style="background-color: #fafbf9;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-surface" style="max-width: 560px; table-layout: fixed; background-color: #ffffff; border: 1px solid #d3d9cf; border-radius: 8px;">
            <tr>
              <td style="padding: 32px 24px 0;">
                <p class="email-text" style="margin: 0; color: #202920; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 16px; font-weight: 500; line-height: 24px;">echo<span class="email-dot" style="color: #1f4f91;">&nbsp;●&nbsp;</span>link</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 24px;">
                <h1 class="email-text" style="margin: 0 0 12px; color: #202920; font-size: 28px; font-weight: 500; letter-spacing: -0.7px; line-height: 36px;">Sign in to echo·link</h1>
                <p class="email-muted" style="margin: 0 0 24px; color: #4a574a; font-size: 16px; line-height: 24px;">Use the link below to sign in. No password needed.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#1f4f91" style="border-radius: 6px;">
                      <a href="${safeLink}" class="email-button" style="display: inline-block; background-color: #1f4f91; border: 1px solid #1f4f91; border-radius: 6px; color: #ffffff; font-size: 16px; font-weight: 500; line-height: 24px; padding: 12px 20px; text-decoration: none; mso-padding-alt: 12px 20px;">Sign in to echo·link</a>
                    </td>
                  </tr>
                </table>
                <p class="email-muted" style="margin: 16px 0 0; color: #4a574a; font-size: 14px; line-height: 22px;">This link expires in <strong>${expirationMinutes} minutes</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px 32px;">
                <div class="email-divider" style="border-top: 1px solid #d3d9cf; padding-top: 24px;">
                  <p class="email-muted" style="margin: 0 0 8px; color: #4a574a; font-size: 14px; line-height: 22px;">If the button doesn't work, copy this link into your browser:</p>
                  <p style="margin: 0; font-size: 13px; line-height: 22px; word-break: break-all; overflow-wrap: anywhere;">
                    <a href="${safeLink}" class="email-link" style="color: #1f4f91; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; text-decoration: underline;">${safeLink}</a>
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">
            <tr>
              <td style="padding: 24px;">
                <p class="email-muted" style="margin: 0; color: #4a574a; font-size: 13px; line-height: 22px;">If you didn't request this email, you can ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendMagicLink(to: string, link: string) {
  const result = await client().emails.send({
    from: env().EMAIL_FROM,
    to,
    subject: "your echo·link sign-in link",
    text: `click to sign in:\n\n${link}\n\nthis link expires in ${env().MAGIC_LINK_EXPIRATION_MINUTES} minutes.`,
    html: renderMagicLinkEmail(link, env().MAGIC_LINK_EXPIRATION_MINUTES),
  });
  if (result.error) throw new Error(`resend: ${result.error.message}`);
}
