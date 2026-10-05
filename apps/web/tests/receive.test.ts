import { afterEach, describe, expect, test } from "bun:test";
import { readFile, readdir, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declaredUploadSize,
  receiveUpload,
} from "../src/lib/server/uploads/receive";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "echo-receive-test-"));
  directories.push(path);
  return path;
}
function multipart(size: number, name = "file") {
  const form = new FormData();
  form.set(
    name,
    new File([Buffer.alloc(size, 42)], "sample.pdf", {
      type: "application/pdf",
    }),
  );
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  });
}

describe("streaming multipart reception", () => {
  test("exact file budget accepted and temporary explicitly disposable", async () => {
    const root = await directory();
    const result = await receiveUpload(
      multipart(64),
      64,
      new AbortController().signal,
      "file_too_large",
      root,
    );
    expect(result.sizeBytes).toBe(64);
    expect(await readFile(result.path)).toEqual(Buffer.alloc(64, 42));
    await result.dispose();
    expect(await readdir(root)).toEqual([]);
  });
  test("next byte rejected and partial files removed", async () => {
    const root = await directory();
    await expect(
      receiveUpload(
        multipart(65),
        64,
        new AbortController().signal,
        "file_too_large",
        root,
      ),
    ).rejects.toThrow("file_too_large");
    expect(await readdir(root)).toEqual([]);
  });
  test("ignored fields cannot evade whole body budget", async () => {
    const root = await directory();
    const form = new FormData();
    form.set("ignored", "x".repeat(9000));
    form.set("file", new File([Buffer.alloc(8)], "sample.pdf"));
    await expect(
      receiveUpload(
        new Request("http://localhost", { method: "POST", body: form }),
        64,
        new AbortController().signal,
        "file_too_large",
        root,
      ),
    ).rejects.toThrow("field_too_large");
    expect(await readdir(root)).toEqual([]);
  });
  test("wrong file field and duplicate files rejected", async () => {
    const root = await directory();
    await expect(
      receiveUpload(
        multipart(8, "other"),
        64,
        new AbortController().signal,
        "file_too_large",
        root,
      ),
    ).rejects.toThrow("invalid_file_field");
    const form = new FormData();
    form.append("file", new File([Buffer.alloc(8)], "first.pdf"));
    form.append("file", new File([Buffer.alloc(8)], "second.pdf"));
    await expect(
      receiveUpload(
        new Request("http://localhost", { method: "POST", body: form }),
        64,
        new AbortController().signal,
        "file_too_large",
        root,
      ),
    ).rejects.toThrow("too_many_files");
    expect(await readdir(root)).toEqual([]);
  });
  test("malformed and aborted bodies leave no temporary files", async () => {
    const root = await directory();
    const malformed = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: "broken",
    });
    await expect(
      receiveUpload(
        malformed,
        64,
        new AbortController().signal,
        "file_too_large",
        root,
      ),
    ).rejects.toThrow("invalid_multipart");
    const controller = new AbortController();
    controller.abort();
    await expect(
      receiveUpload(
        multipart(8),
        64,
        controller.signal,
        "file_too_large",
        root,
      ),
    ).rejects.toThrow("upload_aborted");
    expect(await readdir(root)).toEqual([]);
  });
  test("declared file size must be a positive safe integer", () => {
    expect(declaredUploadSize(multipart(1))).toBeNull();
    for (const size of ["0", "-1", "1.2", "NaN", "9007199254740992"]) {
      const request = multipart(1);
      request.headers.set("x-upload-size", size);
      expect(() => declaredUploadSize(request)).toThrow("invalid_upload_size");
    }
  });
});
