export type CopyVariant = 'raw' | 'md' | 'html' | 'bbcode';

export function generateVariant(variant: CopyVariant, url: string, title: string, mime: string): string {
  switch (variant) {
    case 'raw':
      return url;
    case 'md':
      return `[${title}](${url})`;
    case 'html':
      if (mime.startsWith('video/')) return `<video src="${url}" controls></video>`;
      if (mime.startsWith('image/')) return `<img src="${url}" alt="${title}">`;
      if (mime.startsWith('audio/')) return `<audio src="${url}" controls></audio>`;
      return `<a href="${url}">${title}</a>`;
    case 'bbcode':
      if (mime.startsWith('video/')) return `[video]${url}[/video]`;
      if (mime.startsWith('image/')) return `[img]${url}[/img]`;
      return `[url=${url}]${title}[/url]`;
  }
}
