import type { Handle } from "@sveltejs/kit";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { decodeSession } from "$server/accounts/session";
import { startCleanupScheduler } from "$server/lifecycle/cleanup";
import { readSmallRequest } from "$server/http/body";
import { json } from "@sveltejs/kit";

// Hydrate process.env from SvelteKit's env so code reading process.env
// directly (e.g. @echo-link/db, our zod env schema) gets the right values
// in dev. Vite/SvelteKit loads .env into its own env modules, not process.env.
for (const source of [privateEnv, publicEnv]) {
  for (const [key, value] of Object.entries(source)) {
    if (process.env[key] === undefined && typeof value === "string") {
      process.env[key] = value;
    }
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  startCleanupScheduler();
  const cookie = event.cookies.get("session");
  event.locals.session = decodeSession(cookie);
  const upload =
    event.request.method === "POST" &&
    ["/api/upload", "/share-target"].includes(event.url.pathname);
  if (!upload) {
    const request = await readSmallRequest(event.request);
    if (!request)
      return json(
        { message: "request_too_large" },
        { status: 413, headers: { connection: "close" } },
      );
    event.request = request;
  }
  return resolve(event);
};
