import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$server/env';
import { findOrCreateAccountByEmail, createMagicLink } from '$server/accounts';
import { sendMagicLink } from '$server/email';

const Body = z.object({ email: z.string().email() });

export const POST: RequestHandler = async ({ request }) => {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) throw error(400, 'invalid email');

  const { user } = await findOrCreateAccountByEmail(body.data.email);
  const token = await createMagicLink(user.id);
  const link = `${env().PUBLIC_BASE_URL}/login/verify?token=${encodeURIComponent(token)}`;

  // In dev (or when SMTP is not reachable), log the magic link to the
  // server console so the dev can grab it without a working mail server.
  // We never expose the link in the API response (would defeat the magic-
  // link security model).
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.log('\n  ──── magic link (dev) ────');
    console.log(`  to:   ${body.data.email}`);
    console.log(`  link: ${link}`);
    console.log('  ──────────────────────────\n');
  }

  try {
    await sendMagicLink(body.data.email, link);
  } catch (err) {
    // Don't leak SMTP failures to the client. The magic_link row is
    // already inserted; in dev the link is in the server log above.
    // In prod, SMTP outages should be alerted out-of-band.
    console.warn('[auth/request] sendMagicLink failed:', (err as Error).message);
    if (!isDev) {
      // In production, surface a clear-but-vague error so the user can retry.
      throw error(503, 'mail_unavailable');
    }
  }

  return json({ ok: true });
};
