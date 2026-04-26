<script lang="ts">
  import type { File } from '@echo-link/db';
  import { fade, scale } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { formatFileSize, formatExpiresIn } from '$lib/utils/format';

  type Props = {
    file: File | null;
    onClose: () => void;
    onDeleted?: (id: string) => void;
  };
  let { file, onClose, onDeleted }: Props = $props();

  const fileUrl = $derived(file ? `/files/${file.s3Key}` : '');
  const shareUrl = $derived(
    file && typeof window !== 'undefined' ? `${window.location.origin}/v/${file.id}` : ''
  );
  const isVideo = $derived(file?.mimeType.startsWith('video/') ?? false);
  const isImage = $derived(file?.mimeType.startsWith('image/') ?? false);
  const isAudio = $derived(file?.mimeType.startsWith('audio/') ?? false);

  let copied = $state(false);
  let deleting = $state(false);
  let deleteError = $state<string | null>(null);
  /** Click-twice confirm: first click arms (label switches), second click
   *  actually deletes. Reverts to idle after 3s of inactivity. Same button
   *  slot — no layout shift. */
  let deleteArmed = $state(false);
  let armTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }

  function clearArm() {
    if (armTimer) clearTimeout(armTimer);
    armTimer = null;
    deleteArmed = false;
  }

  async function onDeleteClick() {
    if (!file) return;
    if (!deleteArmed) {
      deleteArmed = true;
      armTimer = setTimeout(() => {
        deleteArmed = false;
        armTimer = null;
      }, 3000);
      return;
    }
    clearArm();
    deleting = true;
    deleteError = null;
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        deleteError = body.message ?? `delete failed (${res.status})`;
        return;
      }
      const id = file.id;
      onDeleted?.(id);
      onClose();
    } catch (e) {
      deleteError = e instanceof Error ? e.message : 'delete failed';
    } finally {
      deleting = false;
    }
  }

  // Reset arm state if the modal closes or switches files
  $effect(() => {
    if (!file) clearArm();
  });

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
          {#if onDeleted}
            <button
              type="button"
              onclick={onDeleteClick}
              disabled={deleting}
              title={deleteArmed ? 'click again within 3s to confirm' : 'delete this file permanently'}
              class="inline-flex min-w-[7.5rem] items-center justify-center rounded-md border px-3 py-2 font-mono text-xs transition-colors disabled:opacity-60 {deleteArmed
                ? 'border-red bg-red/15 text-red hover:bg-red/25'
                : 'border-surface1 bg-surface0 text-subtext1 hover:border-red/40 hover:bg-red/10 hover:text-red'}"
            >
              {#if deleting}
                deleting…
              {:else if deleteArmed}
                ✕ click again
              {:else}
                ✕ delete
              {/if}
            </button>
          {/if}
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
      {#if deleteError}
        <div class="border-t border-red/20 bg-red/5 px-5 py-2 font-mono text-xs text-red">
          {deleteError}
        </div>
      {/if}

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
