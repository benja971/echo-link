import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.session) return { session: null };
  return {
    session: {
      email: locals.session.email,
      userId: locals.session.userId,
      accountId: locals.session.accountId
    }
  };
};
