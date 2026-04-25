// apps/web/src/routes/app/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.session) throw redirect(303, '/login');
  return {};
};
