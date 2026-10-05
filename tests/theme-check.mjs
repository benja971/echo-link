import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { compileModule } = await import(require.resolve("svelte/compiler"));
const root = fileURLToPath(new URL("../apps/web/src/", import.meta.url));
const html = fs.readFileSync(root + "app.html", "utf8");
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const typed = fs.readFileSync(root + "lib/stores/theme.svelte.ts", "utf8");
const transpiled = new Bun.Transpiler({ loader: "ts" }).transformSync(typed);
const store =
  compileModule(transpiled, { generate: "server" })
    .js.code.replace(/import[^;]+;/g, "")
    .replace(/export /g, "") + "\nglobalThis.testTheme = theme;";
function context(t, a, failRead = false, failWrite = false) {
  const saved = { theme: t, accent: a };
  const meta = {};
  const sandbox = {
    document: {
      documentElement: { dataset: {} },
      querySelector: () => ({ setAttribute: (k, v) => (meta[k] = v) }),
    },
    navigator: { userAgent: "Macintosh" },
    localStorage: {
      getItem: (k) => {
        if (failRead) throw new Error("denied");
        return saved[k] ?? null;
      },
      setItem: (k, v) => {
        if (failWrite) throw new Error("quota");
        saved[k] = v;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  vm.runInContext(store, sandbox);
  sandbox.testTheme.init();
  return { sandbox, saved, meta };
}
const themes = Object.fromEntries([
  ["light", "light"],
  ["dark", "dark"],
  ["latte", "light"],
  ["frappe", "dark"],
  ["macchiato", "dark"],
  ["mocha", "dark"],
  ["invalid", "light"],
  ["__proto__", "light"],
  ["constructor", "light"],
]);
const accents = {
  blue: "blue",
  teal: "teal",
  amber: "amber",
  rose: "rose",
  sky: "blue",
  lavender: "blue",
  mauve: "blue",
  peach: "amber",
  yellow: "amber",
  green: "teal",
  red: "rose",
  pink: "rose",
  invalid: "blue",
  constructor: "blue",
};
let cases = 0;
for (const [t, wantTheme] of Object.entries(themes)) {
  for (const [a, wantAccent] of Object.entries(accents)) {
    const { sandbox, saved, meta } = context(t, a);
    assert.equal(sandbox.document.documentElement.dataset.theme, wantTheme);
    assert.equal(sandbox.testTheme.current, wantTheme);
    assert.equal(sandbox.testTheme.accent, wantAccent);
    assert.equal(saved.theme, wantTheme);
    assert.equal(saved.accent, wantAccent);
    assert.equal(meta.content, wantTheme === "light" ? "#f3f4f0" : "#131316");
    cases++;
  }
}
for (const [read, write] of [
  [true, false],
  [false, true],
  [true, true],
]) {
  const { sandbox } = context("mocha", "mauve", read, write);
  assert.equal(sandbox.testTheme.current, read ? "light" : "dark");
  sandbox.testTheme.setTheme("dark");
  sandbox.testTheme.setAccent("rose");
  assert.equal(sandbox.document.documentElement.dataset.accent, "rose");
  sandbox.testTheme.cycle();
  assert.equal(sandbox.testTheme.current, "light");
  sandbox.testTheme.toggle();
  assert.equal(sandbox.testTheme.current, "dark");
}
const { sandbox } = context();
assert.equal(sandbox.testTheme.current, "light");
assert.equal(sandbox.testTheme.accent, "blue");
console.log(
  `Theme checks passed: ${cases} migration combinations, defaults, refused storage, cycle and toggle.`,
);
