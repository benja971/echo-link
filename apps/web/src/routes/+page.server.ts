import type { PageServerLoad } from './$types';
import { env } from '$server/env';

export const load: PageServerLoad = ({ locals }) => {
  return {
    isAuthenticated: !!locals.session,
    anonEnabled: env().ANON_ENABLED,
    anonMaxMb: env().ANON_MAX_SIZE_MB,
    anonHours: env().ANON_EXPIRATION_HOURS
  };
};
