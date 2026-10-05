export type CopyVariant = "raw" | "md" | "html" | "bbcode";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export function generateVariant(
  variant: CopyVariant,
  url: string,
  title: string,
  mime: string,
  mediaUrl = url,
): string {
  switch (variant) {
    case "raw":
      return url;
    case "md":
      return `[${title}](${url})`;
    case "html":
      if (mime.startsWith("video/"))
        return `<video src="${escapeHtml(mediaUrl)}" controls></video>`;
      if (mime.startsWith("image/"))
        return `<img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(title)}">`;
      if (mime.startsWith("audio/"))
        return `<audio src="${escapeHtml(mediaUrl)}" controls></audio>`;
      return `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`;
    case "bbcode":
      if (mime.startsWith("video/")) return `[video]${mediaUrl}[/video]`;
      if (mime.startsWith("image/")) return `[img]${mediaUrl}[/img]`;
      return `[url=${url}]${title}[/url]`;
  }
}
