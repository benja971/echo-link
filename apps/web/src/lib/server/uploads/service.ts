import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { File } from "@echo-link/db";
import { env } from "../env";
import { getAccountUploadLimits } from "../accounts/limits";
import {
  reserveUpload,
  reserveAnonymousUpload,
  releaseUploadReservation,
  trackUploadObjects,
  expireUploadReservation,
} from "../accounts/reservations";
import { getAccountUploadStats } from "../files/repository";
import { deriveSlugFromTitle, findAvailableSlug } from "../files/slug";
import { s3PutFile, cleanupStoredObject } from "../storage/objects";
import { generateAndUploadThumbnail } from "../storage/thumbnails";
import { hashIp } from "./anonymous";
import { UploadError } from "./errors";
import { acquireUploadCapacity } from "./capacity";
import { declaredUploadSize, receiveUpload } from "./receive";
import { validateFile } from "./validation";
import { finalizeStoredUpload, UncertainCommitError } from "./finalize";

export type UploadActor =
  | { kind: "authenticated"; accountId: string; userId: string }
  | { kind: "anonymous"; ip: string };

export async function uploadRequest(
  request: Request,
  actor: UploadActor,
): Promise<File> {
  const config = env();
  const declaredBytes = declaredUploadSize(request);
  let budget: number;
  let ipHash: string | null = null;
  if (actor.kind === "authenticated") {
    const [limits, stats] = await Promise.all([
      getAccountUploadLimits(actor.accountId),
      getAccountUploadStats(actor.accountId),
    ]);
    if (declaredBytes !== null && declaredBytes > limits.maxFileBytes)
      throw new UploadError("file_too_large", 413);
    budget =
      declaredBytes ??
      Math.floor(
        Math.min(
          limits.maxFileBytes,
          limits.maxBytes === null
            ? Infinity
            : limits.maxBytes - stats.totalBytes,
        ),
      );
    if (budget <= 0) throw new UploadError("storage_quota", 413);
  } else {
    if (!config.ANON_ENABLED) throw new UploadError("anonymous_disabled", 403);
    budget =
      declaredBytes ??
      Math.floor(
        Math.min(config.ANON_MAX_SIZE_MB, config.UPLOAD_MAX_SIZE_MB) *
          1024 *
          1024,
      );
    ipHash = hashIp(actor.ip);
  }
  let releaseCapacity = () => {};
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const timeout = setTimeout(abort, config.UPLOAD_TIMEOUT_SECONDS * 1000);
  timeout.unref();
  let reservationId: string | null = null;
  let received: Awaited<ReturnType<typeof receiveUpload>> | null = null;
  const storedKeys: string[] = [];
  let committed = false;
  let objectCleanupFailed = false;
  let commitUnknown = false;
  try {
    const reservation =
      actor.kind === "authenticated"
        ? await reserveUpload(actor.accountId, budget)
        : await reserveAnonymousUpload(ipHash!, budget);
    reservationId = reservation.id;
    controller.signal.throwIfAborted();
    releaseCapacity = await acquireUploadCapacity(budget);
    received = await receiveUpload(
      request,
      reservation.maxBytes,
      controller.signal,
      actor.kind === "anonymous" ? "file_too_large_anon" : "file_too_large",
      config.UPLOAD_TEMP_DIR,
    );
    if (declaredBytes !== null && received.sizeBytes !== declaredBytes)
      throw new UploadError("upload_size_mismatch");
    const validated = await validateFile(received.path, controller.signal);
    controller.signal.throwIfAborted();
    const id = randomUUID();
    const folder = validated.mime.startsWith("video/")
      ? "videos"
      : validated.mime.startsWith("image/")
        ? "images"
        : validated.mime.startsWith("audio/")
          ? "audio"
          : "files";
    const key = `${folder}/${id}.${validated.ext}`;
    storedKeys.push(key, `thumbnails/${id}.webp`);
    await trackUploadObjects(reservation.id, storedKeys);
    await s3PutFile(key, received.path, validated.mime, controller.signal);
    let dimensions: { width: number; height: number } | null = null;
    if (validated.mime.startsWith("image/")) {
      try {
        const metadata = await sharp(received.path, {
          limitInputPixels: 40_000_000,
        }).metadata();
        if (metadata.width && metadata.height)
          dimensions = { width: metadata.width, height: metadata.height };
      } catch {
        /* Metadata is optional. */
      }
    }
    const thumbnailS3Key = await generateAndUploadThumbnail({
      path: received.path,
      mime: validated.mime,
      fileId: id,
    });
    controller.signal.throwIfAborted();
    const title = received.filename.replace(/\.[^.]+$/, "").slice(0, 200);
    const candidate =
      actor.kind === "authenticated" ? deriveSlugFromTitle(title) : null;
    const expiryHours =
      actor.kind === "anonymous"
        ? config.ANON_EXPIRATION_HOURS
        : config.FILE_EXPIRATION_DAYS * 24;
    const data = {
      id,
      s3Key: key,
      mimeType: validated.mime,
      sizeBytes: received.sizeBytes,
      title,
      slug: candidate ? await findAvailableSlug(candidate) : null,
      width: dimensions?.width,
      height: dimensions?.height,
      thumbnailS3Key,
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
      isAnonymous: actor.kind === "anonymous",
      anonymousIpHash: ipHash,
      accountId: actor.kind === "authenticated" ? actor.accountId : null,
      userId: actor.kind === "authenticated" ? actor.userId : null,
    };
    controller.signal.throwIfAborted();
    const result = await finalizeStoredUpload(reservation.id, data);
    committed = true;
    return result;
  } catch (err) {
    commitUnknown = err instanceof UncertainCommitError;
    if (!committed && !commitUnknown) {
      for (const key of storedKeys) {
        try {
          await cleanupStoredObject(key);
        } catch (cleanupError) {
          objectCleanupFailed = true;
          console.error("[upload] object cleanup deferred:", key, cleanupError);
        }
      }
    }
    if (controller.signal.aborted) throw new UploadError("upload_aborted", 408);
    throw err;
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    try {
      if (reservationId && !committed && !commitUnknown) {
        if (objectCleanupFailed) await expireUploadReservation(reservationId);
        else await releaseUploadReservation(reservationId);
      }
    } finally {
      try {
        await received?.dispose();
      } finally {
        releaseCapacity();
      }
    }
  }
}
