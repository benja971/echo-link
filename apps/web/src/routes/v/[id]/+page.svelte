<script lang="ts">
  import Brand from '$components/Brand.svelte';
  import ShareLinkBar from '$components/ShareLinkBar.svelte';
  import QrCode from '$components/QrCode.svelte';
  import { formatFileSize, formatExpiresIn } from '$lib/utils/format';

  let { data } = $props();
  const file = $derived(data.file);
  const fileUrl = $derived(data.fileUrl);
  const thumbUrl = $derived(data.thumbUrl);
  const shareUrl = $derived(data.shareUrl);
  const isVideo = $derived(file.mimeType.startsWith('video/'));
  const isImage = $derived(file.mimeType.startsWith('image/'));
  const isAudio = $derived(file.mimeType.startsWith('audio/'));
</script>

<svelte:head>
  <title>{file.title ?? 'shared'} · echo·link</title>
  <!-- Open Graph -->
  <meta property="og:title" content={file.title ?? 'shared file'} />
  <meta property="og:url" content={shareUrl} />
  <meta property="og:site_name" content="echo·link" />
  {#if isVideo}
    <meta property="og:type" content="video.other" />
    <meta property="og:video" content={fileUrl} />
    <meta property="og:video:secure_url" content={fileUrl} />
    <meta property="og:video:type" content={file.mimeType} />
    {#if file.width && file.height}
      <meta property="og:video:width" content={String(file.width)} />
      <meta property="og:video:height" content={String(file.height)} />
    {/if}
    {#if thumbUrl}
      <meta property="og:image" content={thumbUrl} />
    {/if}
    <meta name="twitter:card" content="player" />
    <meta name="twitter:player" content={fileUrl} />
    <meta name="twitter:player:width" content={String(file.width ?? 1280)} />
    <meta name="twitter:player:height" content={String(file.height ?? 720)} />
  {:else if isImage}
    <meta property="og:type" content="website" />
    <meta property="og:image" content={fileUrl} />
    {#if file.width && file.height}
      <meta property="og:image:width" content={String(file.width)} />
      <meta property="og:image:height" content={String(file.height)} />
    {/if}
    <meta name="twitter:card" content="summary_large_image" />
  {:else if isAudio}
    <meta property="og:type" content="music.song" />
    <meta property="og:audio" content={fileUrl} />
  {/if}
</svelte:head>

<header class="flex items-center justify-between border-b border-surface0 px-7 py-4">
  <Brand />
  <a href="/" class="text-xs text-subtext0 hover:text-text">create your own →</a>
</header>

<main class="mx-auto max-w-4xl px-8 py-12">
  <div class="overflow-hidden rounded-xl border border-surface0 bg-mantle">
    <div class="relative aspect-video bg-gradient-to-br from-surface1 to-crust">
      {#if isVideo}
        <!-- svelte-ignore a11y_media_has_caption — user-uploaded media; captions not available -->
        <video src={fileUrl} controls poster={thumbUrl ?? undefined} class="h-full w-full"></video>
      {:else if isImage}
        <img src={fileUrl} alt={file.title ?? ''} class="h-full w-full object-contain" />
      {:else if isAudio}
        <div class="grid h-full place-items-center">
          <audio src={fileUrl} controls></audio>
        </div>
      {:else}
        <div class="grid h-full place-items-center font-mono text-overlay1">{file.mimeType}</div>
      {/if}
    </div>
    <div class="flex items-start justify-between gap-6 p-6">
      <div class="min-w-0 flex-1">
        <h2 class="mb-2 truncate text-2xl font-medium tracking-tight">{file.title ?? 'shared file'}</h2>
        <div class="font-mono text-xs tracking-wide text-overlay1">
          {file.mimeType}
          <span class="mx-1.5 text-subtext0">·</span>{formatFileSize(file.sizeBytes)}
          {#if file.width && file.height}
            <span class="mx-1.5 text-subtext0">·</span>{file.width}×{file.height}
          {/if}
          <span class="mx-1.5 text-subtext0">·</span>{formatExpiresIn(file.expiresAt)}
        </div>
      </div>
      <a
        href={fileUrl}
        download
        class="shrink-0 rounded-md border border-surface1 bg-surface0 px-3 py-1.5 font-mono text-[11px] text-subtext1 transition-colors hover:bg-surface1 hover:text-text"
      >
        ↓ download
      </a>
    </div>
    <ShareLinkBar url={shareUrl} title={file.title ?? 'file'} mime={file.mimeType} />
  </div>

  <!-- QR · mobile-to-mobile — single centered card, no duplicate markdown
       block (the share bar now exposes all copy variants directly). -->
  <div class="mt-6 grid place-items-center rounded-md border border-surface0 bg-mantle p-5">
    <div class="mb-3 font-mono text-[10px] uppercase tracking-wider text-overlay1">qr · mobile-to-mobile</div>
    <QrCode value={shareUrl} size={140} />
  </div>
</main>
