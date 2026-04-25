<!-- apps/web/src/lib/components/FileRow.svelte -->
<script lang="ts">
  import type { File } from '@echo-link/db';
  import { formatFileSize, formatExpiresIn } from '$lib/utils/format';
  import { mimeKind, mimeIcon, mimeColor } from '$lib/utils/mime';

  type Props = {
    file: File;
    shortcutLabel?: string;
    onCopy: (file: File) => void;
    onMore?: (file: File) => void;
    delay?: number;
  };
  let { file, shortcutLabel, onCopy, onMore, delay = 0 }: Props = $props();
  const kind = $derived(mimeKind(file.mimeType));
</script>

<div
  class="grid grid-cols-[32px_1fr_auto_auto_auto_auto] items-center gap-3 rounded-md border border-surface0 bg-mantle px-4 py-3 font-mono text-sm transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] hover:translate-x-0.5 hover:border-surface2 hover:bg-base"
  style="animation: slide-in 0.5s var(--ease-out-expo) {delay}ms both;"
>
  <div class="grid h-8 w-8 place-items-center rounded-md bg-surface0 text-{mimeColor(kind)}">
    {mimeIcon(kind)}
  </div>
  <div class="truncate text-text">{file.title ?? file.s3Key}</div>
  <div class="text-xs text-overlay1">{formatFileSize(file.sizeBytes)} · {formatExpiresIn(file.expiresAt)}</div>
  <button
    onclick={() => onCopy(file)}
    class="rounded-md border border-green/20 px-3 py-1 text-xs text-green transition-colors hover:bg-green/10"
  >
    → copy link
  </button>
  {#if shortcutLabel}
    <span class="rounded border border-surface1 border-b-2 bg-surface0 px-1.5 py-0.5 text-[10px] text-subtext0">
      {shortcutLabel}
    </span>
  {:else}
    <span></span>
  {/if}
  {#if onMore}
    <button onclick={() => onMore(file)} class="px-1.5 text-overlay0 hover:text-text">⋯</button>
  {:else}
    <span></span>
  {/if}
</div>
