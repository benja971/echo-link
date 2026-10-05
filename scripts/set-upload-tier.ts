import { setAccountUploadTier } from "../apps/web/src/lib/server/accounts/limits";

const identifier = process.argv[2]?.trim();
const tier = process.argv[3];

if (
  process.argv.length !== 4 ||
  !identifier ||
  (tier !== "standard" && tier !== "trusted")
) {
  console.error(
    "Usage: bun scripts/set-upload-tier.ts <email|account-uuid> <standard|trusted>",
  );
  process.exit(1);
}

async function main() {
  const updated = await setAccountUploadTier(
    identifier!,
    tier as "standard" | "trusted",
  );
  console.log(`Account ${updated.id}: upload tier ${updated.uploadTier}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(
      "[set-upload-tier]",
      err instanceof Error ? err.message : "Failed",
    );
    process.exit(1);
  });
