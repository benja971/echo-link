import assert from "node:assert/strict";
import { generateVariant } from "../apps/web/src/lib/utils/shortcut-variants.ts";

const shareUrl = "https://example.test/v/shared";
const fileUrl = "https://example.test/files/image.png?a=1&b=2";
const title = `A & <B> "quoted" 'name'`;
const escapedTitle = "A &amp; &lt;B&gt; &quot;quoted&quot; &#39;name&#39;";
const escapedFileUrl = "https://example.test/files/image.png?a=1&amp;b=2";
for (const mime of [
  "image/png",
  "video/mp4",
  "audio/mpeg",
  "application/pdf",
]) {
  assert.equal(
    generateVariant("raw", shareUrl, title, mime, fileUrl),
    shareUrl,
  );
  assert.equal(
    generateVariant("md", shareUrl, title, mime, fileUrl),
    `[${title}](${shareUrl})`,
  );
}
assert.equal(
  generateVariant("html", shareUrl, title, "image/png", fileUrl),
  `<img src="${escapedFileUrl}" alt="${escapedTitle}">`,
);
assert.equal(
  generateVariant("html", shareUrl, title, "video/mp4", fileUrl),
  `<video src="${escapedFileUrl}" controls></video>`,
);
assert.equal(
  generateVariant("html", shareUrl, title, "audio/mpeg", fileUrl),
  `<audio src="${escapedFileUrl}" controls></audio>`,
);
assert.equal(
  generateVariant("html", shareUrl, title, "application/pdf", fileUrl),
  `<a href="${shareUrl}">${escapedTitle}</a>`,
);
assert.equal(
  generateVariant("bbcode", shareUrl, title, "image/png", fileUrl),
  `[img]${fileUrl}[/img]`,
);
assert.equal(
  generateVariant("bbcode", shareUrl, title, "video/mp4", fileUrl),
  `[video]${fileUrl}[/video]`,
);
assert.equal(
  generateVariant("bbcode", shareUrl, title, "application/pdf", fileUrl),
  `[url=${shareUrl}]${title}[/url]`,
);
assert.equal(
  generateVariant("html", shareUrl, "file", "image/png"),
  `<img src="${shareUrl}" alt="file">`,
);
console.log(
  "Variant checks passed: share URLs, direct media embeds, escaped HTML and legacy calls.",
);
