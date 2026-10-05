import { expect, test } from "bun:test";
import { readSmallRequest } from "../src/lib/server/http/body";

test("small JSON bodies retain headers and content", async () => {
  const source = new Request("http://localhost/api/auth/request", {
    method: "POST",
    body: '{"email":"test@example.com"}',
    headers: { "content-type": "application/json" },
  });
  const result = await readSmallRequest(source);
  expect(result?.headers.get("content-type")).toBe("application/json");
  expect(await result?.json()).toEqual({ email: "test@example.com" });
});

test("large bodies are bounded with and without a declared length", async () => {
  for (const declared of [false, true]) {
    const headers: Record<string, string> = declared
      ? { "content-length": "65537" }
      : {};
    const source = new Request("http://localhost/api/auth/request", {
      method: "POST",
      body: Buffer.alloc(65537),
      headers,
    });
    expect(await readSmallRequest(source)).toBeNull();
  }
});
