import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { cleanupExpiredUploads } from "$server/lifecycle/cleanup";
import { timingSafeStringEqual } from "$server/accounts/session";

export const POST: RequestHandler = async ({ request }) => {
  const auth = request.headers.get("authorization");
  const expected = process.env.CLEANUP_TOKEN;
  if (
    !auth?.startsWith("Bearer ") ||
    !expected ||
    !timingSafeStringEqual(auth.slice(7), expected)
  )
    throw error(401, "unauthorized");
  return json({ deleted: await cleanupExpiredUploads() });
};
