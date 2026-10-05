// apps/web/src/routes/app/+page.server.ts
import type { PageServerLoad } from "./$types";
import {
  listFilesByAccount,
  getAccountUploadStats,
} from "$server/files/repository";
import { env } from "$server/env";
import { getAccountUploadLimits } from "$server/accounts/limits";

export const load: PageServerLoad = async ({ locals }) => {
  const accountId = locals.session!.accountId;
  const [files, stats, limits] = await Promise.all([
    listFilesByAccount(accountId),
    getAccountUploadStats(accountId),
    getAccountUploadLimits(accountId),
  ]);
  const e = env();
  return {
    files,
    stats,
    limits: {
      ...limits,
      expirationDays: e.FILE_EXPIRATION_DAYS,
    },
  };
};
