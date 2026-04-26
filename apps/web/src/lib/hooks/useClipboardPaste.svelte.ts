import { onMount } from 'svelte';

/** Listens to document-level `paste` events and forwards any pasted file
 *  (typically a clipboard image / screenshot) to `onFile`. The browser only
 *  exposes file data via clipboardData when the paste happens outside an
 *  editable element, so we ignore pastes whose target is an input/textarea
 *  or contenteditable (those should accept the user's text paste). */
export function useClipboardPaste(
  onFile: (file: File) => void,
  enabled: () => boolean = () => true
) {
  onMount(() => {
    function onPaste(e: ClipboardEvent) {
      if (!enabled()) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditable) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
            return;
          }
        }
      }
    }

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
}
