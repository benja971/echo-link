// apps/web/src/routes/app/+page.server.ts
import type { PageServerLoad } from './$types';
import { listFilesByAccount, getAccountUploadStats } from '$server/files';
import { env } from '$server/env';

export const load: PageServerLoad = async ({ locals }) => {
  const accountId = locals.session!.accountId;
  const [files, stats] = await Promise.all([
    listFilesByAccount(accountId),
    getAccountUploadStats(accountId)
  ]);
  const e = env();
  return {
    files,
    stats,
    limits: {
      maxFiles: e.MAX_PER_USER,
      maxBytes: e.MAX_SIZE_MB_PER_USER * 1024 * 1024
    }
  };
};
