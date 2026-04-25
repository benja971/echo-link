import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { consumeMagicLink, getAccountForUser } from '$server/accounts';
import { encodeSession, newSession } from '$server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token');
  if (!token) throw redirect(303, '/login?error=missing_token');

  const user = await consumeMagicLink(token);
  if (!user) throw redirect(303, '/login?error=invalid_or_expired');

  const account = await getAccountForUser(user.id);
  if (!account) throw redirect(303, '/login?error=no_account');

  const sessionCookie = encodeSession(
    newSession({ userId: user.id, accountId: account.id, email: user.email })
  );

  cookies.set('session', sessionCookie, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });

  throw redirect(303, '/app');
};
