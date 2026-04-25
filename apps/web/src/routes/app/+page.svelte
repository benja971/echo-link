<!-- apps/web/src/routes/app/+page.svelte -->
<script lang="ts">
  import Brand from '$components/Brand.svelte';
  import Dropzone from '$components/Dropzone.svelte';
  import FileRow from '$components/FileRow.svelte';
  import FileGrid from '$components/FileGrid.svelte';
  import { formatFileSize } from '$lib/utils/format';
  import { useDropAnywhere } from '$lib/hooks/useDropAnywhere.svelte';

  let { data } = $props();

  let busy = $state(false);
  let recent = $derived(data.files.slice(0, 3));
  let allFiles = $derived(data.files);

  async function handleFile(file: File) {
    busy = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        console.error('upload failed', await res.text());
        return;
      }
      const out = await res.json();
      await navigator.clipboard.writeText(out.shareUrl);
      // refresh page data
      window.location.reload();
    } finally {
      busy = false;
    }
  }

  function copyLink(file: typeof data.files[number]) {
    navigator.clipboard.writeText(`${window.location.origin}/v/${file.id}`);
  }

  const dnd = useDropAnywhere(handleFile, () => !busy);
</script>

<svelte:head><title>echo·link · workspace</title></svelte:head>

<div class="min-h-screen">
  <header class="flex items-center justify-between border-b border-surface0 px-7 py-4">
    <Brand />
    <div class="flex items-center gap-3">
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
    <div class="font-mono text-xl text-mauve">[ drop to upload ]</div>
  </div>
{/if}
