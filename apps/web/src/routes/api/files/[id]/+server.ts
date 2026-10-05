import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import {
  getFileById,
  getFileBySlug,
  updateFileMetadata,
} from "$server/files/repository";
import { removeStoredFile } from "$server/lifecycle/cleanup";
import { validateSlug } from "$server/files/slug";

const TITLE_MAX = 200;

async function loadOwned(id: string, accountId: string) {
  const file = await getFileById(id);
  if (!file) throw error(404, "not_found");
  if (!file.accountId || file.accountId !== accountId)
    throw error(403, "forbidden");
  return file;
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.session) throw error(401, "unauthorized");

  const file = await loadOwned(params.id, locals.session.accountId);

  try {
    await removeStoredFile(file);
  } catch (err) {
    console.error("[delete] storage deletion failed:", err);
    throw error(503, "storage_unavailable");
  }
  return json({ ok: true });
};

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  if (!locals.session) throw error(401, "unauthorized");

  const file = await loadOwned(params.id, locals.session.accountId);

  let body: { title?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, "invalid_json");
  }

  const patch: { title?: string | null; slug?: string | null } = {};

  if ("title" in body) {
    if (body.title === null || body.title === "") {
      patch.title = null;
    } else if (typeof body.title === "string") {
      const trimmed = body.title.trim();
      if (trimmed.length > TITLE_MAX) throw error(400, "title_too_long");
      patch.title = trimmed;
    } else {
      throw error(400, "invalid_title");
    }
  }

  if ("slug" in body) {
    if (body.slug === null || body.slug === "") {
      patch.slug = null;
    } else if (typeof body.slug === "string") {
      const candidate = body.slug.trim().toLowerCase();
      const reason = validateSlug(candidate);
      if (reason) throw error(400, `slug_${reason}`);
      // No-op when unchanged; otherwise check uniqueness ourselves to give
      // a clean error code instead of leaking a unique-constraint failure.
      if (candidate !== file.slug) {
        const taken = await getFileBySlug(candidate);
        if (taken && taken.id !== file.id) throw error(409, "slug_taken");
      }
      patch.slug = candidate;
    } else {
      throw error(400, "invalid_slug");
    }
  }

  if (Object.keys(patch).length === 0) {
    return json({ file });
  }

  const updated = await updateFileMetadata(file.id, patch);
  if (!updated) throw error(500, "update_failed");
  return json({ file: updated });
};
