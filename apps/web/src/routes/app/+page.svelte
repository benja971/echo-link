<!-- apps/web/src/routes/app/+page.svelte -->
<script lang="ts">
  import Brand from '$components/Brand.svelte';
  import Dropzone from '$components/Dropzone.svelte';
  import FileRow from '$components/FileRow.svelte';
  import FileGrid from '$components/FileGrid.svelte';
  import CommandPalette from '$components/CommandPalette.svelte';
  import { formatFileSize } from '$lib/utils/format';
  import { useDropAnywhere } from '$lib/hooks/useDropAnywhere.svelte';
  import { useShortcuts } from '$lib/hooks/useShortcuts.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { uploadErrorMessage, readErrorCode } from '$lib/utils/errors';
  import { onMount } from 'svelte';

  let { data } = $props();

  let busy = $state(false);
  let uploadError = $state<string | null>(null);
  let paletteOpen = $state(false);
  let recent = $derived(data.files.slice(0, 3));
  let allFiles = $derived(data.files);

  onMount(() => theme.init());

  async function handleFile(file: File) {
    busy = true;
    uploadError = null;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        uploadError = uploadErrorMessage(await readErrorCode(res));
        return;
      }
      const out = await res.json();
      await navigator.clipboard.writeText(out.shareUrl);
      window.location.reload();
    } catch (e) {
      uploadError = e instanceof Error ? e.message : 'upload failed — network error';
    } finally {
      busy = false;
    }
  }

  function copyLink(file: typeof data.files[number]) {
    navigator.clipboard.writeText(`${window.location.origin}/v/${file.id}`);
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  function copyLast() {
    if (recent[0]) copyLink(recent[0]);
  }

  const dnd = useDropAnywhere(handleFile, () => !busy);

  useShortcuts(() => [
    { key: 'k', meta: true, action: () => (paletteOpen = !paletteOpen) },
    { key: 'k', ctrl: true, action: () => (paletteOpen = !paletteOpen) },
    { key: 'o', meta: true, action: () => document.querySelector<HTMLButtonElement>('[data-pick-trigger]')?.click() },
    { key: 't', meta: true, action: () => theme.toggle() },
    ...recent.map((file, i) => ({
      key: String(i + 1),
      meta: true,
      action: () => copyLink(file)
    }))
  ]);
</script>

<svelte:head><title>echo·link · workspace</title></svelte:head>

<div class="min-h-screen">
  <header class="flex items-center justify-between border-b border-surface0 px-7 py-4">
    <Brand />
    <div class="flex items-center gap-3">
      <span class="text-sm text-subtext0">
        press <span class="font-mono rounded border border-surface1 border-b-2 bg-surface0 px-1.5 py-0.5 text-xs text-text">⌘K</span> for anything
      </span>
      <span class="inline-flex items-center gap-2 rounded-full bg-surface0 px-3 py-1 font-mono text-xs text-subtext1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-green before:[box-shadow:0_0_6px_var(--color-green)]">
        {data.session?.email}
      </span>
    </div>
  </header>

  <section class="px-6 pt-8 text-center">
    <div class="inline-flex gap-1.5 font-mono text-xs text-overlay1 tracking-wide">
      <span class="rounded-full bg-surface0 px-2.5 py-1"><strong class="text-text">{data.stats.fileCount}</strong> files</span>
      <span class="rounded-full bg-surface0 px-2.5 py-1"><strong class="text-text">{formatFileSize(data.stats.totalBytes)}</strong></span>
    </div>
  </section>

  <section class="mx-auto mt-7 max-w-3xl px-8">
    <Dropzone onFile={handleFile} {busy} />
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
          press <span class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]">⌘1</span><span class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]">‒</span><span class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]">3</span> to copy
        </span>
      </div>
      {#each recent as file, i}
        <FileRow {file} shortcutLabel={`⌘${i + 1}`} onCopy={copyLink} delay={(i + 1) * 100} />
      {/each}
    </section>
  {/if}

  <section class="mx-auto mt-16 max-w-3xl px-8 pb-12">
    <div class="mb-3 flex items-baseline justify-between font-mono text-xs text-subtext0">
      <span>all files <span class="text-overlay0">({allFiles.length})</span></span>
    </div>
    <FileGrid files={allFiles} />
  </section>
</div>

{#if dnd.dragging}
  <div class="fixed inset-0 z-50 grid place-items-center bg-base/80 backdrop-blur">
    <div class="font-mono text-xl text-accent">[ drop to upload ]</div>
  </div>
{/if}

<CommandPalette
  bind:open={paletteOpen}
  onClose={() => (paletteOpen = false)}
  files={allFiles}
  onUpload={() => document.querySelector<HTMLButtonElement>('[data-pick-trigger]')?.click()}
  onCopyLast={copyLast}
  onSignOut={signOut}
/>
