import { onMount } from 'svelte';

/** Listens to document-level `paste` events and forwards any pasted files
 *  (typically a clipboard image / screenshot) to `onFiles`. The browser only
 *  exposes file data via clipboardData when the paste happens outside an
 *  editable element, so we ignore pastes whose target is an input/textarea
 *  or contenteditable (those should accept the user's text paste). */
export function useClipboardPaste(
  onFiles: (files: File[]) => void,
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

      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        onFiles(files);
      }
    }

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
}
