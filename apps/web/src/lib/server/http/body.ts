export async function readSmallRequest(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<Request | null> {
  if (!request.body) return request;
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) return null;
      chunks.push(value);
    }
    return new Request(request, { body: Buffer.concat(chunks, bytes) });
  } finally {
    reader.releaseLock();
  }
}
