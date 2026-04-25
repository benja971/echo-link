import FileType from 'file-type';

// Whitelist of allowed MIME type prefixes/exact matches
const ALLOWED_MIME_PATTERNS = [
  'image/',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/',
  'application/pdf',
];

export interface FileValidationResult {
  allowed: boolean;
  detectedMime: string;
  reason?: string;
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PATTERNS.some(pattern =>
    pattern.endsWith('/') ? mime.startsWith(pattern) : mime === pattern
  );
}

/**
 * Validate a file's type using magic bytes detection.
 * Rejects files whose real type doesn't match the whitelist,
 * and files where no type can be detected (e.g. HTML, PHP, text).
 */
export async function validateFileType(
  buffer: Buffer,
  declaredMime: string
): Promise<FileValidationResult> {
  const result = await FileType.fromBuffer(buffer);

  // file-type couldn't detect anything (text, HTML, PHP, CSV, etc.) → reject
  if (!result) {
    return {
      allowed: false,
      detectedMime: declaredMime,
      reason: `File type could not be verified. Only images, videos, audio, and PDF files are allowed.`,
    };
  }

  const detectedMime = result.mime;

  if (!isAllowedMime(detectedMime)) {
    return {
      allowed: false,
      detectedMime,
      reason: `File type "${detectedMime}" is not allowed. Only images, videos, audio, and PDF files are allowed.`,
    };
  }

  return { allowed: true, detectedMime };
}
