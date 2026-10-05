import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { uploadRequest } from "$server/uploads/service";
import { UploadError } from "$server/uploads/errors";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session) throw redirect(303, "/login?from=share");
  let result;
  try {
    result = await uploadRequest(request, {
      kind: "authenticated",
      accountId: locals.session.accountId,
      userId: locals.session.userId,
    });
  } catch (err) {
    if (err instanceof UploadError) {
      if (err.code === "no_file") throw redirect(303, "/app");
      throw error(err.status, err.code);
    }
    throw err;
  }
  throw redirect(303, `/v/${result.slug ?? result.id}`);
};
