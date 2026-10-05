<!-- apps/web/src/lib/components/FileGrid.svelte -->
<script lang="ts">
  import type { File } from "@echo-link/db";
  import { mimeKind, mimeIcon, mimeColor } from "$lib/utils/mime";
  import { formatFileSize } from "$lib/utils/format";
  type Props = {
    files: File[];
    onSelect?: (file: File) => void;
    /** When set, the matching tile gets a strong accent ring + scale-up.
     *  Used by parent-driven keyboard navigation (J/K) so the focused
     *  cell follows arrow keys without focusing the button (which would
     *  cause the browser's default focus ring + scrolling chaos). */
    selectedId?: string | null;
    /** Set of "marked" file ids (multi-select). Marked tiles get a
     *  checkmark badge + filled accent corner. */
    markedIds?: Set<string>;
    onToggleMark?: (id: string) => void;
    markingDisabled?: boolean;
    onFocus?: (file: File) => void;
  };
  let {
    files,
    onSelect,
    selectedId = null,
    markedIds,
    onToggleMark,
    markingDisabled = false,
    onFocus,
  }: Props = $props();

  /** URL of a thumbnail-suitable image for this file, or null. Prefer the
   *  server-side webp thumbnail (256×256) when available; fall back to the
   *  original image for legacy files uploaded before the thumb pipeline. */
  function thumbUrl(file: File): string | null {
    if (file.thumbnailS3Key) return `/files/${file.thumbnailS3Key}`;
    if (file.mimeType.startsWith("image/")) return `/files/${file.s3Key}`;
    return null;
  }

  function shareUrlOf(file: File): string {
    return `${window.location.origin}/v/${file.slug ?? file.id}`;
  }

  /** Native HTML5 drag-out: dragging a tile to another tab/app drops the
   *  share URL. Also sets text/plain so apps that don't read uri-list
   *  (Discord, Slack, ...) still receive the URL as text. The custom
   *  application/x-echo-link-internal type lets useDropAnywhere ignore
   *  the drag if it ever loops back into our own page. */
  function onDragStart(e: DragEvent, file: File) {
    if (!e.dataTransfer) return;
    const url = shareUrlOf(file);
    e.dataTransfer.effectAllowed = "copyLink";
    e.dataTransfer.setData("text/uri-list", url);
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.setData("application/x-echo-link-internal", "1");
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex - the collection receives focus for scoped keyboard navigation. -->
<div
  data-file-grid
  role="region"
  aria-label="File collection. Use J and K to navigate, Space to select."
  tabindex="0"
  class="grid grid-cols-2 gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:grid-cols-4 md:grid-cols-6"
>
  {#each files as file}
    {@const kind = mimeKind(file.mimeType)}
    {@const url = thumbUrl(file)}
    {@const isMarked = markedIds?.has(file.id) ?? false}
    {@const isFocused = selectedId === file.id}
    <div class="relative min-w-0">
      <button
        aria-label={`Open ${file.title ?? file.s3Key}`}
        onclick={() => onSelect?.(file)}
        onfocus={() => onFocus?.(file)}
        draggable="true"
        ondragstart={(e) => onDragStart(e, file)}
        data-file-id={file.id}
        class="relative w-full aspect-square cursor-grab overflow-hidden rounded-md border bg-surface0 font-mono text-2xl text-{mimeColor(
          kind,
        )} transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] hover:border-accent active:cursor-grabbing {isFocused
          ? 'border-accent'
          : isMarked
            ? 'border-accent'
            : 'border-surface0'}"
        style:box-shadow={isFocused
          ? "0 0 0 2px var(--color-accent)"
          : isMarked
            ? "0 0 0 2px var(--color-accent)"
            : ""}
        title={`${file.title ?? file.s3Key} — drag to share`}
      >
        {#if url}
          <img
            src={url}
            alt={file.title ?? ""}
            loading="lazy"
            decoding="async"
            draggable="false"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <!-- subtle gradient at the bottom so the size badge stays readable over light images -->
        {:else}
          <div class="grid h-full place-items-center">{mimeIcon(kind)}</div>
        {/if}
        <span
          class="absolute right-1.5 bottom-1.5 rounded bg-mantle px-1.5 py-0.5 font-sans text-xs font-medium text-text"
        >
          {formatFileSize(file.sizeBytes)}
        </span>
      </button>
      {#if onToggleMark}
        <label
          class="absolute top-0 left-0 grid h-11 w-11 cursor-pointer place-items-center rounded-br-md bg-base/90"
        >
          <input
            type="checkbox"
            disabled={markingDisabled}
            checked={isMarked}
            onchange={() => onToggleMark?.(file.id)}
            aria-label={`Select ${file.title ?? file.s3Key}`}
            class="h-5 w-5 accent-accent"
          />
        </label>
      {/if}
    </div>
  {/each}
</div>
