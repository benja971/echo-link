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

  await sendMagicLink(body.data.email, link);

  return json({ ok: true });
};
