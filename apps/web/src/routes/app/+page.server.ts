// apps/web/src/routes/app/+page.server.ts
import type { PageServerLoad } from './$types';
import { listFilesByAccount, getAccountUploadStats } from '$server/files';

export const load: PageServerLoad = async ({ locals }) => {
  const accountId = locals.session!.accountId;
  const [files, stats] = await Promise.all([
    listFilesByAccount(accountId),
    getAccountUploadStats(accountId)
  ]);
  return { files, stats };
};
