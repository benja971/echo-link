import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { checkBotToken, consumeDiscordLinkCode } from '$server/discord';
import { env } from '$server/env';

const Body = z.object({
  code: z.string(),
  discordUserId: z.string(),
  discordDisplayName: z.string().optional()
});

export const POST: RequestHandler = async ({ request }) => {
  const auth = request.headers.get('authorization');
  if (!checkBotToken(auth, env().ECHOLINK_BOT_TOKEN)) throw error(401, 'unauthorized');
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw error(400, 'invalid body');

  const result = await consumeDiscordLinkCode(parsed.data.code, parsed.data.discordUserId, parsed.data.discordDisplayName);
  if (!result.ok) throw error(400, result.reason);
  return json({ ok: true });
};
