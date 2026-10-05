import { expect, test } from "bun:test";
import type { File, NewFile } from "@echo-link/db";
import {
  finalizeStoredUpload,
  UncertainCommitError,
} from "../src/lib/server/uploads/finalize";

const file: File = {
  id: "test-file",
  s3Key: "files/test.pdf",
  mimeType: "application/pdf",
  sizeBytes: 64,
  title: "test",
  width: null,
  height: null,
  thumbnailS3Key: null,
  expiresAt: new Date(),
  createdAt: new Date(),
  userId: null,
  uploadIdentityId: null,
  accountId: "test-account",
  isAnonymous: false,
  anonymousIpHash: null,
  slug: "test",
};
const input: NewFile = file;

test("a lost commit reply recovers the already committed file", async () => {
  let committed = false;
  const result = await finalizeStoredUpload("reservation", input, {
    finish: async () => {
      committed = true;
      throw new Error("connection lost after COMMIT");
    },
    recover: async () => (committed ? file : null),
  });
  expect(result).toBe(file);
});

test("confirmed rollback propagates the failure for safe object cleanup", async () => {
  const failure = new Error("transaction rolled back");
  await expect(
    finalizeStoredUpload("reservation", input, {
      finish: async () => {
        throw failure;
      },
      recover: async () => null,
    }),
  ).rejects.toBe(failure);
});

test("an unavailable recovery preserves an explicitly unknown commit result", async () => {
  await expect(
    finalizeStoredUpload("reservation", input, {
      finish: async () => {
        throw new Error("connection lost");
      },
      recover: async () => {
        throw new Error("database unavailable");
      },
    }),
  ).rejects.toBeInstanceOf(UncertainCommitError);
});

test("a slug collision retries once with the public UUID route", async () => {
  let count = 0;
  const result = await finalizeStoredUpload("reservation", input, {
    finish: async (_reservation, data) => {
      count++;
      if (count === 1)
        throw Object.assign(new Error("duplicate slug"), {
          code: "23505",
          constraint: "files_slug_unique",
        });
      expect(data.slug).toBeNull();
      return { ...file, slug: null };
    },
    recover: async () => {
      throw new Error("recovery should not run");
    },
  });
  expect(result.slug).toBeNull();
  expect(count).toBe(2);
});
