import { expect, test } from "bun:test";
import { modal } from "../apps/web/src/lib/actions/modal";

test("modal wraps visible controls, leaves inner Tab native and restores focus on cleanup", () => {
  const originals = {
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    getComputedStyle: globalThis.getComputedStyle,
  };
  const fakeDocument = { activeElement: null as ElementStub | null };
  class ElementStub {
    tabIndex = 0;
    isConnected = true;
    disabled = false;
    hidden = false;
    inert = false;
    visibility = "visible";
    focus() {
      fakeDocument.activeElement = this;
    }
    matches() {
      return this.disabled || this.hidden;
    }
    closest() {
      return this.inert ? this : null;
    }
    getClientRects() {
      return this.hidden ? [] : [{}];
    }
  }
  const before = new ElementStub();
  const first = new ElementStub();
  const middle = new ElementStub();
  const last = new ElementStub();
  const disabled = new ElementStub();
  disabled.disabled = true;
  const hidden = new ElementStub();
  hidden.hidden = true;
  const invisible = new ElementStub();
  invisible.visibility = "hidden";
  const inert = new ElementStub();
  inert.inert = true;
  const controls = [disabled, hidden, first, middle, last, invisible, inert];
  const listeners = new Map<string, (event: unknown) => void>();
  let opened = false;
  let closeCount = 0;
  const node = {
    showModal() {
      opened = true;
      first.focus();
    },
    close() {
      closeCount++;
      opened = false;
    },
    querySelector() {
      return first;
    },
    querySelectorAll() {
      return controls;
    },
    contains(element: ElementStub) {
      return controls.includes(element);
    },
    addEventListener(type: string, handler: (event: unknown) => void) {
      listeners.set(type, handler);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
  };
  Object.assign(globalThis, {
    HTMLElement: ElementStub,
    document: fakeDocument,
    getComputedStyle: (element: ElementStub) => ({
      visibility: element.visibility,
    }),
  });
  try {
    before.focus();
    const action = modal(node as unknown as HTMLDialogElement, () => {});
    expect(opened).toBe(true);
    expect(fakeDocument.activeElement).toBe(first);
    function tab(shiftKey = false, key = "Tab") {
      let prevented = false;
      listeners.get("keydown")?.({
        key,
        shiftKey,
        preventDefault() {
          prevented = true;
        },
      });
      return prevented;
    }
    last.focus();
    expect(tab()).toBe(true);
    expect(fakeDocument.activeElement).toBe(first);
    expect(tab(true)).toBe(true);
    expect(fakeDocument.activeElement).toBe(last);
    middle.focus();
    expect(tab()).toBe(false);
    expect(fakeDocument.activeElement).toBe(middle);
    expect(tab(false, "Enter")).toBe(false);
    before.focus();
    expect(tab()).toBe(true);
    expect(fakeDocument.activeElement).toBe(first);
    action.destroy();
    expect(opened).toBe(false);
    expect(closeCount).toBe(1);
    expect(listeners.size).toBe(0);
    expect(fakeDocument.activeElement).toBe(before);
  } finally {
    Object.assign(globalThis, originals);
  }
});
