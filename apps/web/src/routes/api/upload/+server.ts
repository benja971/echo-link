import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { uploadRequest } from "$server/uploads/service";
import { UploadError } from "$server/uploads/errors";
import { env } from "$server/env";

export const POST: RequestHandler = async ({
  request,
  locals,
  getClientAddress,
}) => {
  try {
    const result = await uploadRequest(
      request,
      locals.session
        ? {
            kind: "authenticated",
            accountId: locals.session.accountId,
            userId: locals.session.userId,
          }
        : { kind: "anonymous", ip: getClientAddress() },
    );
    return json({
      id: result.id,
      shareUrl: `${env().PUBLIC_BASE_URL}/v/${result.slug ?? result.id}`,
      directUrl: `${env().CDN_PUBLIC_BASE_URL}/files/${result.s3Key}`,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      title: result.title,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    if (err instanceof UploadError) throw error(err.status, err.code);
    throw err;
  }
};
