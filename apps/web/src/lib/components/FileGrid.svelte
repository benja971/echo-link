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

  function shareUrlOf(file: File): string {
    return `${window.location.origin}/v/${file.id}`;
  }

  /** Native HTML5 drag-out: dragging a tile to another tab/app drops the
   *  share URL. Also sets text/plain so apps that don't read uri-list
   *  (Discord, Slack, ...) still receive the URL as text. */
  function onDragStart(e: DragEvent, file: File) {
    if (!e.dataTransfer) return;
    const url = shareUrlOf(file);
    e.dataTransfer.effectAllowed = 'copyLink';
    e.dataTransfer.setData('text/uri-list', url);
    e.dataTransfer.setData('text/plain', url);
  }
</script>

<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
  {#each files as file}
    {@const kind = mimeKind(file.mimeType)}
    {@const url = thumbUrl(file)}
    <button
      onclick={() => onSelect?.(file)}
      draggable="true"
      ondragstart={(e) => onDragStart(e, file)}
      class="relative aspect-square cursor-grab overflow-hidden rounded-md border border-surface0 bg-gradient-to-br from-surface0 to-mantle font-mono text-2xl text-{mimeColor(kind)} transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:scale-[1.02] hover:border-accent active:cursor-grabbing"
      title={`${file.title ?? file.s3Key} — drag to share`}
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
