<!-- apps/web/src/lib/components/FileRow.svelte -->
<script lang="ts">
  import type { File } from "@echo-link/db";
  import { formatFileSize, formatExpiresIn } from "$lib/utils/format";
  import { mimeKind, mimeIcon } from "$lib/utils/mime";

  type Props = {
    file: File;
    shortcutLabel?: string;
    onCopy: (file: File) => void;
    onMore?: (file: File) => void;
    delay?: number;
    collection?: boolean;
    marked?: boolean;
    markingDisabled?: boolean;
    onToggleMark?: (id: string) => void;
  };
  let {
    file,
    shortcutLabel,
    onCopy,
    onMore,
    delay = 0,
    collection = false,
    marked = false,
    markingDisabled = false,
    onToggleMark,
  }: Props = $props();
  const kind = $derived(mimeKind(file.mimeType));

  function onDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    const url = `${window.location.origin}/v/${file.slug ?? file.id}`;
    e.dataTransfer.effectAllowed = "copyLink";
    e.dataTransfer.setData("text/uri-list", url);
    e.dataTransfer.setData("text/plain", url);
  }
</script>

{#if collection}
  <!-- svelte-ignore a11y_no_static_element_interactions - drag-out supplements the explicit buttons. -->
  <div
    data-file-row
    data-file-id={file.id}
    draggable="true"
    ondragstart={onDragStart}
    class="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-x-2 gap-y-3 border-b px-1 py-4 font-sans {marked
      ? 'border-accent'
      : 'border-surface1'}"
    style:background-color={marked
      ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-mantle))"
      : "var(--color-mantle)"}
  >
    <label
      class="grid h-11 w-11 cursor-pointer place-items-center rounded-md has-disabled:cursor-not-allowed has-disabled:opacity-50"
    >
      <input
        type="checkbox"
        checked={marked}
        disabled={markingDisabled || !onToggleMark}
        onchange={() => onToggleMark?.(file.id)}
        aria-label={`Select ${file.title ?? file.s3Key}`}
        class="h-5 w-5 accent-accent"
      />
    </label>
    <div class="min-w-0 pt-1">
      <p
        class="text-base font-medium leading-6 text-text [overflow-wrap:anywhere]"
      >
        {file.title ?? file.s3Key}
      </p>
      <p class="mt-1 text-sm leading-5 text-subtext1">
        {formatFileSize(file.sizeBytes)} · {formatExpiresIn(file.expiresAt)}
      </p>
    </div>
    <div class="col-span-2 grid grid-cols-2 gap-2">
      <button
        onclick={() => onMore?.(file)}
        disabled={!onMore}
        aria-label={`Open ${file.title ?? file.s3Key}`}
        class="ui-button min-h-11 rounded-md border border-surface1 bg-base px-3 text-sm font-medium text-text"
      >
        View file
      </button>
      <button
        onclick={() => onCopy(file)}
        class="ui-button min-h-11 rounded-md border border-accent/40 px-3 text-sm font-medium text-accent"
      >
        Copy link
      </button>
    </div>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions — drag-out is progressive
     enhancement; primary actions (copy, more) are buttons inside this row. -->
  <div
    data-file-row
    draggable="true"
    ondragstart={onDragStart}
    class="grid cursor-grab grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[32px_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 sm:gap-3 rounded-md border border-surface0 bg-mantle px-3 py-2 text-sm transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] hover:border-surface2 hover:bg-base active:cursor-grabbing"
    title="drag to share"
    style="animation: slide-in 0.5s var(--ease-out-expo) {delay}ms both;"
  >
    <div
      class="grid h-8 w-8 place-items-center rounded-md bg-surface0 text-subtext1"
    >
      {mimeIcon(kind)}
    </div>
    <div class="truncate text-text">{file.title ?? file.s3Key}</div>
    <div
      class="col-start-2 row-start-2 text-xs text-overlay1 sm:col-auto sm:row-auto"
    >
      {formatFileSize(file.sizeBytes)} · {formatExpiresIn(file.expiresAt)}
    </div>
    <button
      onclick={() => onCopy(file)}
      class="ui-button col-start-3 row-span-2 min-h-11 rounded-md border border-accent/40 px-3 py-1 sm:col-auto sm:row-auto text-xs text-accent transition-colors"
    >
      Copy link
    </button>
    {#if shortcutLabel}
      <span
        class="hidden sm:inline rounded border border-surface1 border-b-2 bg-surface0 px-1.5 py-0.5 text-[10px] text-subtext0"
      >
        {shortcutLabel}
      </span>
    {:else}
      <span class="hidden sm:inline"></span>
    {/if}
    {#if onMore}
      <button
        onclick={() => onMore(file)}
        aria-label={`Open ${file.title ?? file.s3Key}`}
        title="View file"
        class="ui-button grid h-11 w-11 shrink-0 place-items-center rounded-md text-overlay0"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle
            cx="12"
            cy="12"
            r="3"
          /></svg
        >
      </button>
    {:else}
      <span class="hidden sm:inline"></span>
    {/if}
  </div>
{/if}
