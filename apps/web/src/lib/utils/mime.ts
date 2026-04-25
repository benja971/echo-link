// apps/web/src/lib/utils/mime.ts
export type MimeKind = 'video' | 'image' | 'audio' | 'archive' | 'pdf' | 'other';

export function mimeKind(mime: string): MimeKind {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('application/zip') || mime.includes('compressed') || mime.includes('tar') || mime.includes('gzip'))
    return 'archive';
  return 'other';
}

export function mimeIcon(kind: MimeKind): string {
  return { video: '▶', image: '▢', audio: '♪', archive: '▦', pdf: '⊟', other: '○' }[kind];
}

export function mimeColor(kind: MimeKind): string {
  return { video: 'peach', image: 'sky', audio: 'green', archive: 'yellow', pdf: 'lavender', other: 'overlay1' }[kind];
}
