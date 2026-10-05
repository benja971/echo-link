import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";

const [mode, baseUrl, cookie] = process.argv.slice(2);
const json = mode === "json-chunked";
const boundary = `test-${randomUUID()}`;
const headers = {
  "content-type": json
    ? "application/json"
    : `multipart/form-data; boundary=${boundary}`,
  origin: baseUrl,
};
const prefix = Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
);
const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
let finished = false;
let cancelled = false;
let sent = 0;
if (cookie) headers.cookie = cookie;
if (mode === "cancel") headers["x-upload-size"] = "500000";
headers["transfer-encoding"] = "chunked";
const request = httpRequest(
  `${baseUrl}${json ? "/api/auth/request" : "/api/upload"}`,
  { method: "POST", headers },
  async (response) => {
    finished = true;
    let body = "";
    for await (const chunk of response) body += chunk.toString();
    process.stdout.write(
      JSON.stringify({ status: response.statusCode, body, sent }),
    );
    request.destroy();
  },
);
request.on("error", (error) => {
  if (!finished && !cancelled) {
    console.error(error);
    process.exitCode = 1;
  }
});
if (!json) request.write(prefix);
if (json) {
  const body = Buffer.from(JSON.stringify({ email: "x".repeat(128 * 1024) }));
  sent = body.length;
  request.write(body.subarray(0, 32 * 1024));
  request.write(body.subarray(32 * 1024, 96 * 1024));
  request.end(body.subarray(96 * 1024));
} else if (mode === "cancel") {
  request.write(
    Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64 * 1024)]),
  );
  process.stdin.once("data", () => {
    cancelled = true;
    request.destroy();
    process.stdin.pause();
    process.stdout.write(JSON.stringify({ cancelled: true }));
  });
} else {
  const body = Buffer.alloc(2 * 1024 * 1024, 0x20);
  body.write("%PDF-1.7\n");
  while (sent < body.length && !finished) {
    const end = Math.min(sent + 64 * 1024, body.length);
    request.write(body.subarray(sent, end));
    sent = end;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (!finished) request.end(footer);
}
