/** Friendly upload error messages keyed by the codes thrown server-side
 *  in apps/web/src/lib/server/upload.ts (UploadError.code). */
export function uploadErrorMessage(code: string): string {
  const mimeMatch = code.match(/^mime_not_allowed:(.+)$/);
  if (mimeMatch) return `file type not supported (${mimeMatch[1]})`;

  const map: Record<string, string> = {
    unrecognized_file_type: "this file type isn't supported",
    anonymous_disabled: 'anonymous uploads are disabled — please sign in',
    file_too_large_anon: 'file too large for anonymous upload (50mb max)',
    anon_rate_limited:
      "you've reached the anonymous upload limit from this network — try again later or sign in",
    file_too_large: "file too large for your remaining storage quota",
    file_count_quota: "you've reached your file count quota",
    storage_quota: "this file would exceed your storage quota — delete some files or wait for them to expire",
    'no file': 'no file received',
    no_file: 'no file received',
    invalid_email: 'please enter a valid email address',
    'invalid email': 'please enter a valid email address',
    unauthorized: 'you need to sign in first',
    expired: 'this link has expired'
  };
  if (map[code]) return map[code];
  return `upload failed (${code})`;
}

/** Pulls the meaningful code/message out of a fetch Response.
 *  SvelteKit throws errors as JSON `{ "message": "<code>" }`. */
export async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `http ${res.status}`;
  } catch {
    const text = await res.text().catch(() => '');
    return text || `http ${res.status}`;
  }
}
