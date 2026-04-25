import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { startDiscordLink } from '$server/discord';

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.session) throw error(401, 'unauthorized');
  const { code, expiresAt } = await startDiscordLink(locals.session.accountId);
  return json({ code, expiresAt });
};
