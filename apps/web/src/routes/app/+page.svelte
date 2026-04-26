<!-- apps/web/src/routes/app/+page.svelte -->
<script lang="ts">
  import Brand from '$components/Brand.svelte';
  import Dropzone from '$components/Dropzone.svelte';
  import FileRow from '$components/FileRow.svelte';
  import FileGrid from '$components/FileGrid.svelte';
  import CommandPalette from '$components/CommandPalette.svelte';
  import FilePreviewModal from '$components/FilePreviewModal.svelte';
  import KeyboardCheatsheet from '$components/KeyboardCheatsheet.svelte';
  import { formatShortcut } from '$lib/utils/platform';
  import { formatFileSize } from '$lib/utils/format';
  import { useDropAnywhere } from '$lib/hooks/useDropAnywhere.svelte';
  import { useClipboardPaste } from '$lib/hooks/useClipboardPaste.svelte';
  import { useShortcuts } from '$lib/hooks/useShortcuts.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { uploadErrorMessage } from '$lib/utils/errors';
  import { uploadFileWithProgress, type UploadProgress } from '$lib/utils/upload-with-progress';
  import { TIPS } from '$lib/utils/tips';
  import RotatingTip from '$components/RotatingTip.svelte';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let busy = $state(false);
  let uploadError = $state<string | null>(null);
  let uploadProgress = $state<UploadProgress | null>(null);
  let uploadingFileName = $state<string | null>(null);
  /** When uploading multiple files in sequence, exposes `current of total`. */
  let queue = $state<{ current: number; total: number } | null>(null);
  let paletteOpen = $state(false);
  let preview = $state<typeof data.files[number] | null>(null);
  let cheatsheetOpen = $state(false);

  const filesPct = $derived(
    Math.min(100, Math.round((data.stats.fileCount / data.limits.maxFiles) * 100))
  );
  const bytesPct = $derived(
    Math.min(100, Math.round((data.stats.totalBytes / data.limits.maxBytes) * 100))
  );
  const usagePct = $derived(Math.max(filesPct, bytesPct));
  let recent = $derived(data.files.slice(0, 3));
  let allFiles = $derived(data.files);

  onMount(() => theme.init());

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    busy = true;
    uploadError = null;
    queue = files.length > 1 ? { current: 0, total: files.length } : null;
    let lastShareUrl: string | null = null;
    let okCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (queue) queue.current = i + 1;
      uploadingFileName = file.name;
      uploadProgress = { loaded: 0, total: file.size, pct: 0 };
      try {
        const result = await uploadFileWithProgress(file, '/api/upload', (p) => {
          uploadProgress = p;
        });
        if (!result.ok) {
          uploadError = uploadErrorMessage(result.errorCode ?? `http ${result.status}`);
          break; // stop the queue on first failure
        }
        const out = result.body as { shareUrl: string; title?: string };
        lastShareUrl = out.shareUrl;
        okCount++;
      } catch (e) {
        uploadError = e instanceof Error ? e.message : 'upload failed — network error';
        break;
      }
    }

    uploadProgress = null;
    uploadingFileName = null;
    queue = null;
    busy = false;

    if (okCount > 0) {
      // Copy the LAST URL to clipboard (matches single-file behavior); for
      // batches the user can always click any tile to grab a specific link.
      if (lastShareUrl) await navigator.clipboard.writeText(lastShareUrl);
      toast.flash(
        okCount === 1
          ? `✓ uploaded — link copied`
          : `✓ ${okCount} files uploaded — last link copied`
      );
      await invalidateAll();
    }
  }

  function copyLink(file: typeof data.files[number]) {
    navigator.clipboard.writeText(`${window.location.origin}/v/${file.id}`);
    toast.flash(`✓ link copied — ${file.title ?? 'file'}`);
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  function copyLast() {
    if (recent[0]) copyLink(recent[0]);
  }

  const dnd = useDropAnywhere(handleFiles, () => !busy);
  useClipboardPaste(handleFiles, () => !busy && !anyOverlayOpen);

  // Note on cross-platform shortcuts:
  // - ⌘K / Ctrl+K is the only browser-safe modifier combo we use (not
  //   reserved on any major browser).
  // - Ctrl+T (new tab), Ctrl+1‒9 (switch tabs), Ctrl+O (open file) are
  //   reserved by Chrome/Brave/Firefox and JS preventDefault is ignored.
  //   So workspace shortcuts use plain keys (no modifier); the hook's
  //   typing-guard prevents them from firing inside inputs.
  // Shortcut policy:
  // - ⌘/Ctrl+K toggles the palette (works while palette is open to close;
  //   blocked while cheatsheet or preview is open to avoid stacking)
  // - ?         toggles the cheatsheet (mirror of above)
  // - O/T/1‒3   workspace actions, disabled while ANY overlay is open
  const otherOverlayOpen = $derived(cheatsheetOpen || preview !== null);
  const anyOverlayOpen = $derived(paletteOpen || cheatsheetOpen || preview !== null);

  useShortcuts(() => [
    { key: 'k', meta: true, enabled: () => !otherOverlayOpen, action: () => (paletteOpen = !paletteOpen) },
    { key: 'k', ctrl: true, enabled: () => !otherOverlayOpen, action: () => (paletteOpen = !paletteOpen) },
    { key: '?', enabled: () => !paletteOpen && preview === null, action: () => (cheatsheetOpen = !cheatsheetOpen) },
    { key: 'o', enabled: () => !anyOverlayOpen, action: () => document.querySelector<HTMLButtonElement>('[data-pick-trigger]')?.click() },
    { key: 't', enabled: () => !anyOverlayOpen, action: () => theme.cycle() },
    { key: 'c', enabled: () => !anyOverlayOpen, action: copyLast },
    ...recent.map((file, i) => ({
      key: String(i + 1),
      enabled: () => !anyOverlayOpen,
      action: () => copyLink(file)
    }))
  ]);
</script>

<svelte:head><title>echo·link · workspace</title></svelte:head>

<div class="min-h-screen pb-14">
  <header class="flex items-center justify-between border-b border-surface0 px-7 py-4">
    <Brand />
    <div class="flex items-center gap-3">
      <span class="hidden md:inline text-xs text-subtext0">
        press <span class="font-mono rounded border border-surface1 border-b bg-surface0 px-1 py-px text-[10px] text-text">{formatShortcut('K', { mod: true })}</span> for anything · <span class="font-mono rounded border border-surface1 border-b bg-surface0 px-1 py-px text-[10px] text-text">?</span> for shortcuts
      </span>
      <span class="inline-flex items-center gap-2 rounded-full bg-surface0 px-3 py-1 font-mono text-xs text-subtext1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-green before:[box-shadow:0_0_6px_var(--color-green)]">
        {data.session?.email}
      </span>
    </div>
  </header>

  <section class="px-6 pt-8 text-center">
    <div class="inline-flex flex-wrap items-center justify-center gap-1.5 font-mono text-xs text-overlay1 tracking-wide">
      <span class="rounded-full bg-surface0 px-2.5 py-1">
        <strong class="text-text">{data.stats.fileCount}</strong>
        <span class="text-overlay0">/{data.limits.maxFiles}</span> files
      </span>
      <span class="rounded-full bg-surface0 px-2.5 py-1">
        <strong class="text-text">{formatFileSize(data.stats.totalBytes)}</strong>
        <span class="text-overlay0">/ {formatFileSize(data.limits.maxBytes)}</span>
      </span>
      <span
        class="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-surface0 px-2.5 py-1"
        title="usage = max(files used, storage used)"
      >
        <span
          class="absolute inset-y-0 left-0 transition-[width] duration-500 [transition-timing-function:var(--ease-out-expo)]"
          style:width="{usagePct}%"
          style:background-color="color-mix(in oklab, var(--color-accent) 22%, transparent)"
        ></span>
        <span class="relative">
          <strong class="text-text">{usagePct}%</strong>
          <span class="text-overlay0">used</span>
        </span>
      </span>
    </div>
  </section>

  <section class="mx-auto mt-7 max-w-3xl px-8">
    <Dropzone onFiles={handleFiles} {busy} isDragging={dnd.dragging} />
    {#if uploadProgress}
      <div class="mt-3 rounded-md border border-surface0 bg-mantle p-3">
        <div class="mb-2 flex items-baseline justify-between font-mono text-xs">
          <span class="truncate text-subtext1">
            {#if queue}
              <span class="text-overlay1">{queue.current} / {queue.total} ·</span>
            {/if}
            uploading <span class="text-text">{uploadingFileName}</span>…
          </span>
          <span class="ml-3 shrink-0 text-text">{uploadProgress.pct}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-surface0">
          <div
            class="h-full transition-[width] duration-150"
            style:width="{uploadProgress.pct}%"
            style:background-color="var(--color-accent)"
          ></div>
        </div>
        <div class="mt-1 font-mono text-[11px] text-overlay1">
          {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
        </div>
      </div>
    {/if}
    {#if uploadError}
      <div class="mt-3 rounded-md border border-red/30 bg-red/5 p-3 font-mono text-sm text-red">
        {uploadError}
      </div>
    {/if}
  </section>

  {#if recent.length > 0}
    <section class="mx-auto mt-14 max-w-3xl px-8">
      <div class="mb-3.5 flex items-baseline justify-between px-1 font-mono text-xs text-subtext0">
        <span class="before:text-overlay0 before:content-['//_']">recent</span>
        <span class="text-overlay1 text-[11px]">
          press <span class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]">1</span> <span class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]">2</span> <span class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]">3</span> to copy
        </span>
      </div>
      {#each recent as file, i}
        <FileRow {file} shortcutLabel={`${i + 1}`} onCopy={copyLink} delay={(i + 1) * 100} />
      {/each}
    </section>
  {/if}

  <section class="mx-auto mt-16 max-w-3xl px-8 pb-12">
    <div class="mb-3 flex items-baseline justify-between font-mono text-xs text-subtext0">
      <span>all files <span class="text-overlay0">({allFiles.length})</span></span>
    </div>
    {#if allFiles.length === 0}
      <div class="grid place-items-center rounded-md border border-dashed border-surface1 bg-mantle/40 px-6 py-14 text-center">
        <div class="font-mono text-3xl text-overlay1">∅</div>
        <p class="mt-3 font-sans text-sm text-subtext0">
          no files yet. drop one above, paste a screenshot, or press <span class="font-mono rounded border border-surface1 border-b bg-surface0 px-1 py-px text-[11px] text-text">O</span>
        </p>
        <p class="mt-1 font-mono text-xs text-overlay1">files live here for up to {data.limits.expirationDays} days, or until you delete them</p>
      </div>
    {:else}
      <FileGrid files={allFiles} onSelect={(f) => (preview = f)} />
    {/if}
  </section>
</div>


<CommandPalette
  bind:open={paletteOpen}
  onClose={() => (paletteOpen = false)}
  files={allFiles}
  onUpload={() => document.querySelector<HTMLButtonElement>('[data-pick-trigger]')?.click()}
  onCopyLast={copyLast}
  onSignOut={signOut}
/>

<FilePreviewModal
  file={preview}
  onClose={() => (preview = null)}
  onDeleted={(name) => {
    toast.flash(`✓ file deleted`);
    void invalidateAll();
  }}
/>

<KeyboardCheatsheet
  bind:open={cheatsheetOpen}
  onClose={() => (cheatsheetOpen = false)}
/>

<!-- Copy/action toast — bottom-right, above the tip strip -->
{#if toast.message}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-16 right-6 z-40 max-w-sm rounded-md border border-accent/40 px-4 py-3 font-sans text-sm text-text shadow-2xl backdrop-blur"
    style:background-color="color-mix(in oklab, var(--color-accent) 14%, var(--color-mantle))"
    transition:fly={{ y: 16, duration: 220 }}
  >
    {toast.message}
  </div>
{/if}

<!-- sticky tip ticker + theme/accent status — terminal-status-bar vibe -->
<div class="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-surface0 bg-mantle/85 px-4 py-2.5 backdrop-blur">
  <div class="flex-1 truncate text-center">
    <RotatingTip tips={TIPS} class="text-sm text-subtext0" />
  </div>
  <button
    type="button"
    onclick={() => (paletteOpen = true)}
    title="open command palette to change theme or accent"
    class="hidden shrink-0 items-center gap-2 font-mono text-xs text-overlay1 transition-colors hover:text-text sm:flex"
  >
    <span
      class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style:background-color="var(--color-accent)"
    ></span>
    <span>{theme.current} · {theme.accent}</span>
  </button>
</div>
