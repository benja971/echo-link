import { afterEach, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateFile } from "../src/lib/server/uploads/validation";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function sample(bytes: Buffer) {
  const root = await mkdtemp(join(tmpdir(), "echo-validation-"));
  directories.push(root);
  const path = join(root, "misleading.exe");
  await writeFile(path, bytes);
  return path;
}

test("real disk stream detects allowed MIME independently of extension", async () => {
  expect(
    await validateFile(
      await sample(Buffer.from("%PDF-1.7\n" + "x".repeat(120))),
    ),
  ).toEqual({ mime: "application/pdf", ext: "pdf" });
});
test("unsupported magic bytes and executable types rejected", async () => {
  await expect(validateFile(await sample(Buffer.alloc(128)))).rejects.toThrow(
    "unrecognized_file_type",
  );
  const executable = Buffer.alloc(128);
  executable.set([0x7f, 0x45, 0x4c, 0x46]);
  await expect(validateFile(await sample(executable))).rejects.toThrow(
    "mime_not_allowed",
  );
});
test("validation respects an already canceled transfer", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    validateFile(await sample(Buffer.alloc(128)), controller.signal),
  ).rejects.toThrow();
});
