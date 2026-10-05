import { describe, expect, test } from "bun:test";
import { resolveUploadLimits } from "../src/lib/server/accounts/limits";
import { assertUploadFits } from "../src/lib/server/accounts/reservations";

const MiB = 1024 * 1024;
const defaults = {
  MAX_PER_USER: 25,
  MAX_SIZE_MB_PER_USER: 500,
  UPLOAD_MAX_SIZE_MB: 1024,
};

describe("account upload policies", () => {
  test("standard keeps existing quotas and trusted only removes business quotas", () => {
    expect(resolveUploadLimits("standard", defaults)).toEqual({
      maxFiles: 25,
      maxBytes: 500 * MiB,
      maxFileBytes: 1024 * MiB,
    });
    expect(resolveUploadLimits("trusted", defaults)).toEqual({
      maxFiles: null,
      maxBytes: null,
      maxFileBytes: 1024 * MiB,
    });
  });

  test("exact capacity accepted, next byte and next file rejected", () => {
    const limits = resolveUploadLimits("standard", defaults);
    expect(() =>
      assertUploadFits(
        limits,
        { fileCount: 24, totalBytes: 100 * MiB },
        400 * MiB,
      ),
    ).not.toThrow();
    expect(() =>
      assertUploadFits(
        limits,
        { fileCount: 24, totalBytes: 100 * MiB },
        400 * MiB + 1,
      ),
    ).toThrow("storage_quota");
    expect(() =>
      assertUploadFits(limits, { fileCount: 25, totalBytes: 0 }, 1),
    ).toThrow("file_count_quota");
  });

  test("trusted permits accumulated usage but retains technical size cap", () => {
    const limits = resolveUploadLimits("trusted", defaults);
    expect(() =>
      assertUploadFits(
        limits,
        { fileCount: 1000, totalBytes: 10000 * MiB },
        1024 * MiB,
      ),
    ).not.toThrow();
    expect(() =>
      assertUploadFits(limits, { fileCount: 0, totalBytes: 0 }, 1024 * MiB + 1),
    ).toThrow("file_too_large");
  });

  test("invalid sizes cannot evade quota arithmetic", () => {
    for (const bytes of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        assertUploadFits(
          resolveUploadLimits("trusted", defaults),
          { fileCount: 0, totalBytes: 0 },
          bytes,
        ),
      ).toThrow("invalid_upload_size");
    }
  });
});
