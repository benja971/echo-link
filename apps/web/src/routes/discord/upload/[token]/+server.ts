import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = ({ params }) => {
  throw redirect(303, `/app?discord_session=${encodeURIComponent(params.token)}`);
};
