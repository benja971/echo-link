import assert from "node:assert/strict";
import { deleteFiles } from "../apps/web/src/lib/utils/delete-files.ts";
const originalFetch = globalThis.fetch;
try {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, method: options.method });
    if (url.endsWith("/network-error")) throw new Error("Offline");
    return { ok: url.endsWith("/success") };
  };
  const result = await deleteFiles(["success", "http-error", "network-error"]);
  assert.deepEqual(result.deletedIds, ["success"]);
  assert.deepEqual(result.failedIds, ["http-error", "network-error"]);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.method === "DELETE"));
  assert.deepEqual(await deleteFiles([]), { deletedIds: [], failedIds: [] });
  console.log(
    "Deletion regression check passed: partial failure, network failure, continuation and empty selection.",
  );
} finally {
  globalThis.fetch = originalFetch;
}
