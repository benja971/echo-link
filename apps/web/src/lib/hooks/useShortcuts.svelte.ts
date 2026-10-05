import { onMount } from "svelte";

export type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  enabled?: () => boolean;
  scope?: string;
  action: (e: KeyboardEvent) => void;
};

export function useShortcuts(getShortcuts: () => Shortcut[]) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      for (const sc of getShortcuts()) {
        if (sc.enabled && !sc.enabled()) continue;
        if (sc.scope && !target?.closest(sc.scope)) continue;
        const ctrlOrMeta = sc.ctrl || sc.meta;
        const ctrlMatches = ctrlOrMeta
          ? e.ctrlKey || e.metaKey
          : !e.ctrlKey && !e.metaKey;
        const shiftMatches = sc.shift ? e.shiftKey : true;
        const keyMatches = e.key.toLowerCase() === sc.key.toLowerCase();
        if (isTyping && !ctrlOrMeta) continue;
        if (
          !ctrlOrMeta &&
          target?.closest("button, a, [role=button]") &&
          [
            " ",
            "enter",
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
          ].includes(e.key.toLowerCase())
        )
          continue;
        if (ctrlMatches && shiftMatches && keyMatches) {
          e.preventDefault();
          sc.action(e);
          return;
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
}
