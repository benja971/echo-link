import assert from "node:assert/strict";
import { copyText } from "../apps/web/src/lib/utils/clipboard.ts";

const descriptors = new Map(
  ["navigator", "document", "HTMLElement"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
function set(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}
let restored = 0;
let removed = 0;
let selected = "";
class Element {
  focus() {
    restored++;
  }
}
const focus = new Element();
function documentStub(execCommand) {
  return {
    activeElement: focus,
    getSelection: () => null,
    querySelector: () => null,
    body: { append: () => {} },
    createElement: () => ({
      style: {},
      value: "",
      select() {
        selected = this.value;
      },
      remove() {
        removed++;
      },
    }),
    execCommand,
  };
}
try {
  set("HTMLElement", Element);
  let copied = "";
  set("navigator", {
    clipboard: {
      writeText: async (text) => {
        copied = text;
      },
    },
  });
  set(
    "document",
    documentStub(() => {
      throw new Error("Fallback should not run");
    }),
  );
  assert.equal(await copyText("https://local/v/file"), true);
  assert.equal(copied, "https://local/v/file");

  set("navigator", {
    clipboard: {
      writeText: async () => {
        throw new Error("Permission denied");
      },
    },
  });
  set(
    "document",
    documentStub(() => true),
  );
  assert.equal(await copyText("fallback link"), true);
  assert.equal(selected, "fallback link");
  assert.equal(restored, 1);
  assert.equal(removed, 1);

  set("navigator", {});
  set(
    "document",
    documentStub(() => false),
  );
  assert.equal(await copyText("manual link"), false);
  assert.equal(restored, 2);
  assert.equal(removed, 2);

  set(
    "document",
    documentStub(() => {
      throw new Error("Blocked");
    }),
  );
  assert.equal(await copyText("still recoverable"), false);
  assert.equal(restored, 3);
  assert.equal(removed, 3);
  console.log(
    "Clipboard regression check passed: success, denial, unavailable API, failed fallback and focus restoration.",
  );
} finally {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
