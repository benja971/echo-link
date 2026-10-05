import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(
  new URL("../apps/web/src/app.css", import.meta.url),
  "utf8",
);
const blocks = [
  ...css.matchAll(/(?:@theme|\[data-theme="dark"\])\s*\{([^}]+)\}/g),
].map((m) =>
  Object.fromEntries(
    [...m[1].matchAll(/--color-([\w-]+): (#[0-9a-f]{6})/g)].map((p) => [
      p[1],
      p[2],
    ]),
  ),
);
function luminance(hex) {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const channel = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return (
      sum +
      weight *
        (channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4)
    );
  }, 0);
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (x + 0.05) / (y + 0.05);
}
function mix(a, b, weight) {
  return (
    "#" +
    [0, 1, 2]
      .map((index) => {
        const offset = 1 + index * 2;
        const value = Math.round(
          parseInt(a.slice(offset, offset + 2), 16) * weight +
            parseInt(b.slice(offset, offset + 2), 16) * (1 - weight),
        );
        return value.toString(16).padStart(2, "0");
      })
      .join("")
  );
}
let checks = 0;
for (const [name, tokens] of [
  ["light", blocks[0]],
  ["dark", { ...blocks[0], ...blocks[1] }],
]) {
  for (const text of [
    "text",
    "subtext1",
    "subtext0",
    "overlay0",
    "overlay1",
    "overlay2",
    "blue",
    "teal",
    "yellow",
    "red",
    "green",
    "peach",
    "sky",
    "lavender",
    "pink",
  ]) {
    for (const surface of ["crust", "mantle", "surface0", "surface1"]) {
      assert.ok(
        ratio(tokens[text], tokens[surface]) >= 4.5,
        `${name}: ${text}/${surface} < 4.5`,
      );
      checks++;
    }
  }
  for (const accent of ["blue", "teal", "yellow", "red"]) {
    assert.ok(
      ratio(tokens["on-accent"], tokens[accent]) >= 4.5,
      `${name}: action text/${accent} < 4.5`,
    );
    checks++;
    for (const weight of [0.76, 0.64]) {
      const background = mix(
        tokens[accent],
        name === "light" ? "#000000" : "#ffffff",
        weight,
      );
      assert.ok(
        ratio(tokens["on-accent"], background) >= 4.5,
        `${name}: ${accent} interaction text < 4.5`,
      );
      checks++;
    }
  }
  assert.ok(
    ratio(tokens.red, mix(tokens.red, tokens.mantle, 0.18)) >= 4.5,
    `${name}: destructive hover text < 4.5`,
  );
  checks++;
}
console.log(
  `Contrast regression check passed: ${checks} text/action pairs across both themes.`,
);
