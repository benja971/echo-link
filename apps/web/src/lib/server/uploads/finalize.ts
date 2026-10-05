import type { File, NewFile } from "@echo-link/db";
import {
  finishReservedUpload,
  recoverFinishedUpload,
} from "../accounts/reservations";

type FinalizationStore = {
  finish: typeof finishReservedUpload;
  recover: typeof recoverFinishedUpload;
};

export class UncertainCommitError extends Error {
  constructor(
    public originalError: unknown,
    public recoveryError: unknown,
  ) {
    super("upload_commit_unknown");
  }
}

export async function finalizeStoredUpload(
  reservationId: string,
  input: NewFile,
  store: FinalizationStore = {
    finish: finishReservedUpload,
    recover: recoverFinishedUpload,
  },
): Promise<File> {
  let failure: unknown;
  try {
    return await store.finish(reservationId, input);
  } catch (err) {
    failure = err;
    if (
      (err as { code?: string; constraint?: string }).code === "23505" &&
      (err as { constraint?: string }).constraint?.includes("slug")
    ) {
      try {
        return await store.finish(reservationId, { ...input, slug: null });
      } catch (retryError) {
        failure = retryError;
      }
    }
  }
  try {
    const committed = await store.recover(input);
    if (committed) return committed;
  } catch (recoveryError) {
    throw new UncertainCommitError(failure, recoveryError);
  }
  throw failure;
}
