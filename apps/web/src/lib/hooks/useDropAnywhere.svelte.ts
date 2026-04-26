// apps/web/src/lib/hooks/useDropAnywhere.svelte.ts
import { onMount } from 'svelte';

export function useDropAnywhere(
  onFiles: (files: File[]) => void,
  enabled: () => boolean = () => true
) {
  let dragging = $state(false);

  onMount(() => {
    let counter = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!enabled()) return;
      counter++;
      if (e.dataTransfer?.types.includes('Files')) dragging = true;
    };
    const onDragLeave = () => {
      counter--;
      if (counter <= 0) {
        dragging = false;
        counter = 0;
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!enabled()) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!enabled()) return;
      e.preventDefault();
      counter = 0;
      dragging = false;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    };

    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);

    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  });

  return {
    get dragging() {
      return dragging;
    }
  };
}
