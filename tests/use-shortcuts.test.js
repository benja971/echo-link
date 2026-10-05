import { afterAll, describe, expect, mock, test } from "bun:test";

let handler;
let cleanup;
mock.module("svelte", () => ({
  onMount: (setup) => {
    cleanup = setup();
  },
}));
const originalDocument = globalThis.document;
afterAll(() => {
  globalThis.document = originalDocument;
});
globalThis.document = {
  addEventListener: (_type, callback) => {
    handler = callback;
  },
  removeEventListener: () => {
    handler = undefined;
  },
};
const { useShortcuts } =
  await import("../apps/web/src/lib/hooks/useShortcuts.svelte.ts");

function keyEvent(
  key,
  { native = false, grid = false, typing = false, ctrl = false } = {},
) {
  return {
    key,
    ctrlKey: ctrl,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: {
      tagName: typing ? "INPUT" : native ? "BUTTON" : "DIV",
      closest: (selector) =>
        selector === "[data-file-grid]"
          ? grid
            ? {}
            : null
          : native
            ? {}
            : null,
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

describe("scoped file shortcuts", () => {
  test("Space, Enter and arrows preserve focused native controls", () => {
    let calls = 0;
    useShortcuts(() =>
      [" ", "Enter", "ArrowDown"].map((key) => ({
        key,
        action: () => calls++,
      })),
    );
    for (const key of [" ", "Enter", "ArrowDown"]) {
      const event = keyEvent(key, { native: true, grid: true });
      handler(event);
      expect(event.defaultPrevented).toBeUndefined();
    }
    expect(calls).toBe(0);
    cleanup();
  });

  test("file navigation runs within the collection and ignores text input", () => {
    let calls = 0;
    useShortcuts(() => [
      { key: "j", scope: "[data-file-grid]", action: () => calls++ },
    ]);
    handler(keyEvent("j"));
    handler(keyEvent("j", { grid: true, typing: true }));
    expect(calls).toBe(0);
    const event = keyEvent("j", { grid: true, native: true });
    handler(event);
    expect(calls).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    cleanup();
  });

  test("modifier palette shortcut remains available while typing", () => {
    let calls = 0;
    useShortcuts(() => [{ key: "k", meta: true, action: () => calls++ }]);
    handler(keyEvent("k", { typing: true, ctrl: true }));
    expect(calls).toBe(1);
    cleanup();
  });
});
