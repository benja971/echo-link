import { onMount } from 'svelte';

export type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  enabled?: () => boolean;
  action: (e: KeyboardEvent) => void;
};

export function useShortcuts(getShortcuts: () => Shortcut[]) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      for (const sc of getShortcuts()) {
        if (sc.enabled && !sc.enabled()) continue;
        const ctrlOrMeta = sc.ctrl || sc.meta;
        const ctrlMatches = ctrlOrMeta ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatches = sc.shift ? e.shiftKey : true;
        const keyMatches = e.key.toLowerCase() === sc.key.toLowerCase();
        if (isTyping && !ctrlOrMeta) continue;
        if (ctrlMatches && shiftMatches && keyMatches) {
          e.preventDefault();
          sc.action(e);
          return;
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
}
