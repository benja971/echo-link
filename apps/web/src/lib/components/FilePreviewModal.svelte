<script lang="ts">
  import type { File } from '@echo-link/db';
  import { fade, scale } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { formatFileSize, formatExpiresIn } from '$lib/utils/format';

  type Props = {
    file: File | null;
    onClose: () => void;
  };
  let { file, onClose }: Props = $props();

  const fileUrl = $derived(file ? `/files/${file.s3Key}` : '');
  const shareUrl = $derived(
    file && typeof window !== 'undefined' ? `${window.location.origin}/v/${file.id}` : ''
  );
  const isVideo = $derived(file?.mimeType.startsWith('video/') ?? false);
  const isImage = $derived(file?.mimeType.startsWith('image/') ?? false);
  const isAudio = $derived(file?.mimeType.startsWith('audio/') ?? false);

  let copied = $state(false);
  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && file) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if file}
  <button
    type="button"
    aria-label="close preview"
    class="fixed inset-0 z-50 cursor-zoom-out bg-crust/80 backdrop-blur-md"
    onclick={onClose}
    transition:fade={{ duration: 180 }}
  ></button>

  <div
    role="dialog"
    aria-modal="true"
    class="fixed inset-0 z-50 grid place-items-center p-6 pointer-events-none"
  >
    <div
      class="relative pointer-events-auto flex max-h-[88vh] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-surface1 bg-mantle shadow-2xl"
      transition:scale={{ duration: 220, start: 0.96, opacity: 0 }}
    >
      <!-- Media area -->
      <div class="grid place-items-center bg-crust">
        {#if isImage}
          <img
            src={fileUrl}
            alt={file.title ?? ''}
            class="block max-h-[72vh] max-w-[88vw] object-contain"
          />
        {:else if isVideo}
          <!-- svelte-ignore a11y_media_has_caption — user-uploaded media -->
          <video
            src={fileUrl}
            controls
            autoplay
            class="block max-h-[72vh] max-w-[88vw]"
          ></video>
        {:else if isAudio}
          <div class="grid place-items-center px-12 py-16">
            <div class="mb-4 font-mono text-5xl text-accent">♪</div>
            <audio src={fileUrl} controls class="min-w-[320px]"></audio>
          </div>
        {:else}
          <div class="grid place-items-center px-12 py-16 text-center">
            <div class="mb-3 font-mono text-5xl text-overlay1">○</div>
            <p class="font-mono text-sm text-subtext0">{file.mimeType}</p>
            <a
              href={fileUrl}
              download
              class="mt-4 inline-flex items-center gap-2 rounded-md border border-surface1 bg-surface0 px-3 py-2 font-mono text-xs text-text hover:bg-surface1"
            >
              ↓ download
            </a>
          </div>
        {/if}
      </div>

      <!-- Footer with metadata + actions -->
      <div class="flex items-center justify-between gap-4 border-t border-surface0 bg-mantle px-5 py-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-text">{file.title ?? file.s3Key}</div>
          <div class="font-mono text-xs text-overlay1">
            {file.mimeType}
            <span class="mx-1.5 text-subtext0">·</span>{formatFileSize(file.sizeBytes)}
            {#if file.width && file.height}
              <span class="mx-1.5 text-subtext0">·</span>{file.width}×{file.height}
            {/if}
            <span class="mx-1.5 text-subtext0">·</span>{formatExpiresIn(file.expiresAt)}
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <a
            href={fileUrl}
            download
            class="inline-flex items-center rounded-md border border-surface1 bg-surface0 px-3 py-2 font-mono text-xs text-subtext1 transition-colors hover:bg-surface1 hover:text-text"
          >
            ↓ download
          </a>
          <button
            type="button"
            onclick={copyLink}
            class="inline-flex items-center rounded-md border border-accent/40 px-3 py-2 font-mono text-xs text-accent transition-colors hover:border-accent"
            style:background-color="color-mix(in oklab, var(--color-accent) 12%, transparent)"
          >
            {copied ? '✓ copied' : '⎘ copy link'}
          </button>
        </div>
      </div>

      <!-- Close button (top-right corner of the modal) -->
      <button
        type="button"
        aria-label="close"
        onclick={onClose}
        class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-crust/70 font-mono text-sm text-subtext0 backdrop-blur transition-colors hover:bg-crust hover:text-text"
      >
        ×
      </button>
    </div>
  </div>
{/if}
