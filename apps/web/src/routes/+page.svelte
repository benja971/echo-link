<!-- apps/web/src/routes/+page.svelte -->
<script lang="ts">
  import Brand from '$components/Brand.svelte';
  import Dropzone from '$components/Dropzone.svelte';

  let { data } = $props();
  let busy = $state(false);
  let result = $state<{ shareUrl: string; title: string } | null>(null);
  let error = $state<string | null>(null);

  async function handleFile(file: File) {
    busy = true;
    error = null;
    result = null;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        error = (await res.text()) || 'upload failed';
        return;
      }
      const out = await res.json();
      result = { shareUrl: out.shareUrl, title: out.title };
      await navigator.clipboard.writeText(out.shareUrl);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>echo·link — drop a file. get a link. share anywhere.</title>
  <meta name="description" content="A personal CDN that doesn't suck. Self-hosted, keyboard-first, Catppuccin." />
</svelte:head>

<header class="flex items-center justify-between border-b border-surface0 px-7 py-4">
  <Brand />
  <nav class="flex gap-3.5 font-mono text-xs text-subtext0">
    <a href="https://github.com" class="hover:text-text">github</a>
    <a href="https://github.com" class="hover:text-text">self-host</a>
    {#if data.isAuthenticated}
      <a href="/app" class="hover:text-mauve">open app →</a>
    {:else}
      <a href="/login" class="hover:text-mauve">sign in →</a>
    {/if}
  </nav>
</header>

<section class="px-8 pt-24 pb-12 text-center">
  <div class="mb-7 font-mono text-[11px] tracking-wide text-overlay0">
    ┌─── personal cdn that doesn't suck ───┐
  </div>
  <Brand size="xl" pulsing />
  <p class="mx-auto mt-6 max-w-xl font-sans text-xl text-subtext1 tracking-tight">
    drop a file. get a link. <em class="not-italic font-medium text-mauve">share anywhere.</em>
  </p>
  <p class="mt-1 font-mono text-[11px] tracking-wider text-overlay1">
    self-hosted <span class="text-mauve">·</span> catppuccin <span class="text-mauve">·</span> keyboard-first <span class="text-mauve">·</span> open source
  </p>
</section>

<section class="mx-auto max-w-xl px-8">
  {#if data.anonEnabled}
    <Dropzone
      onFile={handleFile}
      {busy}
      title="drop a file to try it"
      sub="or click · or paste · or ⌘O"
      anonTag={`≤ ${data.anonMaxMb}mb · expires ${data.anonHours}h · no account`}
    />
  {:else}
    <div class="rounded-xl border border-surface1 bg-mantle p-8 text-center font-mono text-sm text-overlay1">
      anonymous mode is currently disabled — <a href="/login" class="text-mauve hover:underline">sign in</a> to upload.
    </div>
  {/if}

  {#if result}
    <div class="mt-4 rounded-md border border-green/30 bg-green/5 p-4 font-mono text-sm">
      <div class="text-green">✓ uploaded — link copied</div>
      <div class="mt-1 truncate text-text">{result.shareUrl}</div>
    </div>
  {/if}
  {#if error}
    <div class="mt-4 rounded-md border border-red/30 bg-red/5 p-4 font-mono text-sm text-red">
      {error}
    </div>
  {/if}
</section>

<section class="mx-auto mt-24 max-w-2xl px-8">
  <div class="grid grid-cols-[80px_1fr] gap-8 border-t border-surface0 py-9">
    <div class="pt-1.5 font-mono text-[11px] uppercase tracking-wider text-mauve before:content-['→_'] before:text-overlay1">why</div>
    <div>
      <h3 class="mb-3 text-3xl font-medium tracking-tight">file size limits everywhere.<br /><span class="text-mauve">echo·link is just a link.</span></h3>
      <p class="max-w-lg text-subtext1">Discord caps at <code class="font-mono text-sm bg-surface0 text-peach px-1.5 py-px rounded">50MB</code> free, <code class="font-mono text-sm bg-surface0 text-peach px-1.5 py-px rounded">500MB</code> Nitro. WeTransfer wants emails. Drive is overkill for a clip you just want to send to two friends.</p>
    </div>
  </div>
  <div class="grid grid-cols-[80px_1fr] gap-8 border-t border-surface0 py-9">
    <div class="pt-1.5 font-mono text-[11px] uppercase tracking-wider text-mauve before:content-['→_'] before:text-overlay1">for what</div>
    <div>
      <h3 class="mb-3 text-3xl font-medium tracking-tight">game clips. design WIPs. <span class="text-mauve">whatever.</span></h3>
      <p class="max-w-lg text-subtext1">Anything that needs to live behind a tidy URL — beautifully embedded with native players in Discord, Telegram, iMessage. Or just plain links for the rest.</p>
    </div>
  </div>
  <div class="grid grid-cols-[80px_1fr] gap-8 border-t border-surface0 py-9">
    <div class="pt-1.5 font-mono text-[11px] uppercase tracking-wider text-mauve before:content-['→_'] before:text-overlay1">what you get</div>
    <div>
      <h3 class="mb-3 text-3xl font-medium tracking-tight">a tool that <span class="text-mauve">respects you.</span></h3>
      <p class="max-w-lg text-subtext1">self-hosted, open source, keyboard-first, catppuccin theme baked in, PWA installable, QR code per file, multiple copy formats, zero ads, zero tracking.</p>
    </div>
  </div>
</section>

<footer class="mt-24 flex flex-wrap justify-between gap-4 border-t border-surface0 px-8 py-6 font-mono text-[11px] text-overlay1">
  <span>made with ☕ &nbsp;by ben</span>
  <span class="flex gap-6">
    <a href="https://github.com" class="text-subtext0 hover:text-mauve">github</a>
    <a href="https://github.com" class="text-subtext0 hover:text-mauve">self-host this</a>
    <a href="/privacy" class="text-subtext0 hover:text-mauve">privacy</a>
    <span class="text-overlay0">v2.0.0</span>
  </span>
</footer>
