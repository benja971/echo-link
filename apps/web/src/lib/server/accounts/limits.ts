import { accounts, getDb, type UploadTier } from "@echo-link/db";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { UploadError } from "../uploads/errors";

export type UploadLimits = {
  maxFiles: number | null;
  maxBytes: number | null;
  maxFileBytes: number;
};

type UploadDefaults = Pick<
  ReturnType<typeof env>,
  "MAX_PER_USER" | "MAX_SIZE_MB_PER_USER" | "UPLOAD_MAX_SIZE_MB"
>;

export function resolveUploadLimits(
  tier: UploadTier,
  defaults: UploadDefaults,
): UploadLimits {
  return {
    maxFiles: tier === "trusted" ? null : defaults.MAX_PER_USER,
    maxBytes:
      tier === "trusted" ? null : defaults.MAX_SIZE_MB_PER_USER * 1024 * 1024,
    maxFileBytes: defaults.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
  };
}

export async function getAccountUploadLimits(
  accountId: string,
): Promise<UploadLimits> {
  const [account] = await getDb()
    .select({ uploadTier: accounts.uploadTier })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (!account) throw new UploadError("account_not_found", 404);
  return resolveUploadLimits(account.uploadTier, env());
}

export async function setAccountUploadTier(
  identifier: string,
  tier: UploadTier,
): Promise<{ id: string; uploadTier: UploadTier }> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );
  if (!isUuid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))
    throw new Error("Invalid account identifier.");
  if (tier !== "standard" && tier !== "trusted")
    throw new Error("Invalid upload tier.");
  return getDb().transaction(async (tx) => {
    const matching = isUuid
      ? eq(accounts.id, identifier)
      : eq(accounts.primaryEmail, identifier.toLowerCase());
    const found = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(matching)
      .for("update");
    if (found.length !== 1)
      throw new Error(
        found.length
          ? "Ambiguous email; use the account UUID."
          : "Account not found.",
      );
    const [account] = await tx
      .update(accounts)
      .set({ uploadTier: tier, updatedAt: new Date() })
      .where(eq(accounts.id, found[0]!.id))
      .returning({ id: accounts.id, uploadTier: accounts.uploadTier });
    return account!;
  });
}
