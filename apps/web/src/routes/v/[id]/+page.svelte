<script lang="ts">
  import Brand from "$components/Brand.svelte";
  import ShareLinkBar from "$components/ShareLinkBar.svelte";
  import QrCode from "$components/QrCode.svelte";
  import { formatFileSize, formatExpiresIn } from "$lib/utils/format";

  let { data } = $props();
  const file = $derived(data.file);
  const fileUrl = $derived(data.fileUrl);
  const thumbUrl = $derived(data.thumbUrl);
  const shareUrl = $derived(data.shareUrl);
  const isVideo = $derived(file.mimeType.startsWith("video/"));
  const isImage = $derived(file.mimeType.startsWith("image/"));
  const isAudio = $derived(file.mimeType.startsWith("audio/"));
</script>

<svelte:head>
  <title>{file.title ?? "shared"} · echo·link</title>
  <!-- Open Graph -->
  <meta property="og:title" content={file.title ?? "shared file"} />
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

<header
  class="flex flex-wrap items-center justify-between gap-3 border-b border-surface0 px-5 py-4 sm:px-7"
>
  <Brand />
  <a
    href="/"
    class="inline-flex min-h-11 items-center text-sm text-subtext0 hover:text-text"
    >Upload a file</a
  >
</header>

<main
  id="main-content"
  class="share-page mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-12"
>
  <div
    class="share-card overflow-hidden rounded-xl border border-surface0 bg-mantle"
  >
    <div class="share-media relative aspect-video bg-crust">
      {#if isVideo}
        <!-- svelte-ignore a11y_media_has_caption — user-uploaded media; captions not available -->
        <video
          src={fileUrl}
          controls
          poster={thumbUrl ?? undefined}
          class="h-full w-full"
        ></video>
      {:else if isImage}
        <img
          src={fileUrl}
          alt={file.title ?? ""}
          class="h-full w-full object-contain"
        />
      {:else if isAudio}
        <div class="grid h-full place-items-center">
          <audio src={fileUrl} controls class="max-w-full"></audio>
        </div>
      {:else}
        <div
          class="grid h-full place-items-center break-all px-4 font-mono text-subtext0"
        >
          {file.mimeType}
        </div>
      {/if}
    </div>
    <div
      class="share-info flex flex-col gap-5 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6"
    >
      <div class="min-w-0">
        <h1
          class="mb-2 break-words text-2xl font-medium tracking-tight [overflow-wrap:anywhere]"
        >
          {file.title ?? "shared file"}
        </h1>
        <div class="share-metadata break-words font-mono text-sm text-subtext0">
          {file.mimeType}
          <span class="mx-1.5 text-subtext0">·</span>{formatFileSize(
            file.sizeBytes,
          )}
          {#if file.width && file.height}
            <span class="mx-1.5 text-subtext0">·</span
            >{file.width}×{file.height}
          {/if}
          <span class="mx-1.5 text-subtext0">·</span>{formatExpiresIn(
            file.expiresAt,
          )}
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <a
          href={fileUrl}
          download
          class="ui-button ui-button-primary inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent sm:w-auto"
        >
          Download file
        </a>
      </div>
    </div>
    <ShareLinkBar
      {fileUrl}
      url={shareUrl}
      title={file.title ?? "file"}
      mime={file.mimeType}
    />
  </div>

  <details class="device-share mt-6 border-t border-surface0 pt-2 sm:hidden">
    <summary
      class="ui-button flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-surface1 bg-mantle px-3 text-sm text-text"
    >
      Show QR code
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg
      >
    </summary>
    <div class="py-3"><QrCode value={shareUrl} size={120} /></div>
  </details>
  <div class="mt-8 hidden border-t border-surface0 pt-6 sm:block">
    <div class="mb-3 text-sm font-medium text-subtext0">
      Open on another device
    </div>
    <div class="flex"><QrCode value={shareUrl} size={120} /></div>
  </div>
</main>

<style>
  .device-share summary svg {
    transition: transform 150ms;
  }
  .device-share[open] summary svg {
    transform: rotate(180deg);
  }
  @media (max-width: 639px) {
    .share-page {
      padding-top: 16px;
      padding-bottom: 32px;
    }
    .share-card {
      border: 0;
      border-radius: 0;
      background: transparent;
      overflow: visible;
    }
    .share-media {
      border-radius: 8px;
      overflow: hidden;
      max-height: 32vh;
    }
    .share-info {
      padding: 18px 0 20px;
      gap: 18px;
    }
    .share-info h1 {
      font-size: 20px;
      line-height: 26px;
      margin-bottom: 8px;
    }
    .share-metadata {
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 20px;
    }
  }
</style>
