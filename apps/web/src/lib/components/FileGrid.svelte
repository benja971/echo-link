<!-- apps/web/src/lib/components/FileGrid.svelte -->
<script lang="ts">
  import type { File } from '@echo-link/db';
  import { mimeKind, mimeIcon, mimeColor } from '$lib/utils/mime';
  import { formatFileSize } from '$lib/utils/format';
  let { files, onSelect }: { files: File[]; onSelect?: (file: File) => void } = $props();

  /** URL of a thumbnail-suitable image for this file, or null. */
  function thumbUrl(file: File): string | null {
    if (file.mimeType.startsWith('image/')) return `/files/${file.s3Key}`;
    if (file.thumbnailS3Key) return `/files/${file.thumbnailS3Key}`;
    return null;
  }
</script>

<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
  {#each files as file}
    {@const kind = mimeKind(file.mimeType)}
    {@const url = thumbUrl(file)}
    <button
      onclick={() => onSelect?.(file)}
      class="relative aspect-square overflow-hidden rounded-md border border-surface0 bg-gradient-to-br from-surface0 to-mantle font-mono text-2xl text-{mimeColor(kind)} transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:scale-[1.02] hover:border-accent"
      title={file.title ?? file.s3Key}
    >
      {#if url}
        <img
          src={url}
          alt={file.title ?? ''}
          loading="lazy"
          decoding="async"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <!-- subtle gradient at the bottom so the size badge stays readable over light images -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-crust/80 to-transparent"></div>
      {:else}
        <div class="grid h-full place-items-center">{mimeIcon(kind)}</div>
      {/if}
      <span class="absolute right-1.5 bottom-1 font-sans text-[10px] font-medium tracking-wide text-text [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {formatFileSize(file.sizeBytes)}
      </span>
    </button>
  {/each}
</div>
