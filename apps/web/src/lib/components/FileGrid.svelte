<!-- apps/web/src/lib/components/FileGrid.svelte -->
<script lang="ts">
  import type { File } from '@echo-link/db';
  import { mimeKind, mimeIcon, mimeColor } from '$lib/utils/mime';
  import { formatFileSize } from '$lib/utils/format';
  let { files, onSelect }: { files: File[]; onSelect?: (file: File) => void } = $props();
</script>

<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
  {#each files as file}
    {@const kind = mimeKind(file.mimeType)}
    <button
      onclick={() => onSelect?.(file)}
      class="relative aspect-square overflow-hidden rounded-md border border-surface0 bg-gradient-to-br from-surface0 to-mantle font-mono text-2xl text-{mimeColor(kind)} transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:scale-[1.02] hover:border-mauve"
    >
      <div class="grid h-full place-items-center">{mimeIcon(kind)}</div>
      <span class="absolute right-1.5 bottom-1 text-[8px] tracking-wide text-overlay0">
        {formatFileSize(file.sizeBytes)}
      </span>
    </button>
  {/each}
</div>
