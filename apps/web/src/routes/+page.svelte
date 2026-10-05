<!-- apps/web/src/routes/+page.svelte -->
<script lang="ts">
  import Brand from "$components/Brand.svelte";
  import Dropzone from "$components/Dropzone.svelte";
  import { uploadErrorMessage } from "$lib/utils/errors";
  import { useDropAnywhere } from "$lib/hooks/useDropAnywhere.svelte";
  import { useClipboardPaste } from "$lib/hooks/useClipboardPaste.svelte";
  import {
    uploadFileWithProgress,
    type UploadProgress,
  } from "$lib/utils/upload-with-progress";
  import { formatFileSize } from "$lib/utils/format";
  import { copyText } from "$lib/utils/clipboard";

  let { data } = $props();
  let busy = $state(false);
  let results = $state<{ shareUrl: string; title: string }[]>([]);
  let copyStatus = $state("");
  let error = $state<string | null>(null);
  let progress = $state<UploadProgress | null>(null);
  let progressFileName = $state<string | null>(null);
  let queue = $state<{ current: number; total: number } | null>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0 || busy) return;
    busy = true;
    error = null;
    copyStatus = "";
    queue = files.length > 1 ? { current: 0, total: files.length } : null;
    const uploaded: { shareUrl: string; title: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (queue) queue.current = i + 1;
      progressFileName = file.name;
      progress = { loaded: 0, total: file.size, pct: 0 };
      try {
        const res = await uploadFileWithProgress(file, "/api/upload", (p) => {
          progress = p;
        });
        if (!res.ok) {
          error = `${file.name}: ${uploadErrorMessage(res.errorCode ?? `http ${res.status}`)}. Any earlier uploads are listed below.`;
          break;
        }
        const out = res.body as { shareUrl: string; title?: string };
        const result = {
          shareUrl: out.shareUrl,
          title: out.title ?? file.name,
        };
        uploaded.push(result);
        results = [...results, result];
      } catch (e) {
        error =
          "Upload interrupted. Check your connection and try again. Completed files are listed below.";
        break;
      }
    }

    progress = null;
    progressFileName = null;
    queue = null;
    busy = false;

    if (uploaded.length === 1) await copyLink(uploaded[0]!.shareUrl);
  }

  async function copyLink(url: string) {
    copyStatus = (await copyText(url))
      ? "Link copied."
      : "Could not copy automatically. Select the link and copy it manually.";
  }

  const dnd = useDropAnywhere(handleFiles, () => !busy);
  useClipboardPaste(handleFiles, () => !busy);
</script>

<svelte:head>
  <title>Echo Link - share a file</title>
  <meta
    name="description"
    content="Upload a file and get a link to share. Self-hosted file sharing with previews and automatic expiration."
  />
</svelte:head>

<header
  class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 sm:py-5"
>
  <a
    href="/"
    aria-label="Echo Link home"
    class="ui-brand inline-flex min-h-11 items-center"><Brand /></a
  >
  <nav aria-label="Main navigation" class="flex items-center gap-4 text-sm">
    <a
      href={data.isAuthenticated ? "/app" : "/login"}
      class="ui-button inline-flex min-h-11 items-center gap-3 rounded-md border border-surface1 bg-mantle px-4 font-medium"
    >
      {data.isAuthenticated ? "Your files" : "Sign in"}
      <span aria-hidden="true">↗</span>
    </a>
  </nav>
</header>

<main id="main-content" class="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
  <div
    class="grid gap-5 pt-5 pb-8 sm:gap-8 sm:pt-16 sm:pb-16 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16"
  >
    <section aria-labelledby="upload-title" class="lg:pt-8">
      <h1
        id="upload-title"
        class="text-[2rem] leading-tight font-medium tracking-[-0.025em] sm:text-[clamp(2.5rem,6vw,4.5rem)] sm:leading-[1.05] sm:tracking-[-0.035em]"
      >
        Share a file.
      </h1>
      <p class="mt-2 text-base text-subtext1 sm:hidden">
        Upload a file. Get a link to share.
      </p>
      <p
        class="mt-5 hidden max-w-sm text-lg leading-relaxed text-subtext1 sm:block"
      >
        Upload it here. Send the link.<br />Your recipient can preview or
        download it.
      </p>
      <p class="mt-6 hidden text-sm text-subtext1 sm:block">
        {data.isAuthenticated
          ? "Upload a file here, or open Your files to manage your uploads."
          : data.anonEnabled
            ? "Try it without an account, or sign in to manage your files."
            : "Sign in to upload and manage your files."}
      </p>
    </section>

    <section aria-label="Upload and share files" class="min-w-0">
      {#if data.anonEnabled || data.isAuthenticated}
        <Dropzone
          onFiles={handleFiles}
          {busy}
          title="Choose files"
          sub="Drop files here or paste an image"
        />
        {#if !data.isAuthenticated}
          <p class="mt-4 text-center text-sm text-subtext1">
            Up to {data.anonMaxMb} MB per file · Available for {data.anonHours} hours
          </p>
        {/if}
      {:else}
        <div class="rounded-lg border border-surface1 bg-mantle p-6">
          <p class="text-subtext1">
            Anonymous uploads are disabled on this instance.
          </p>
          <a
            href="/login"
            class="ui-button ui-button-primary mt-4 inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-medium text-on-accent"
            >Sign in to upload</a
          >
        </div>
      {/if}

      {#if progress}
        <div class="mt-5 rounded-md border border-surface1 bg-mantle p-4">
          <p role="status" class="mb-3 break-words text-sm">
            Uploading {progressFileName}{queue
              ? ` (${queue.current} of ${queue.total})`
              : ""}
          </p>
          <div class="mb-2 flex justify-between text-sm tabular-nums">
            <span
              >{formatFileSize(progress.loaded)} / {formatFileSize(
                progress.total,
              )}</span
            ><span>{progress.pct}%</span>
          </div>
          <progress
            aria-label="Upload progress"
            max="100"
            value={progress.pct}
            class="h-2 w-full accent-accent"
          ></progress>
        </div>
      {/if}
      {#if error}
        <p
          role="alert"
          class="mt-4 rounded-md border border-red/30 bg-red/5 p-4 text-sm text-red"
        >
          {error}
        </p>
      {/if}
      {#if results.length > 0}
        <section class="mt-6 space-y-3" aria-label="Uploaded files">
          <h2 class="text-lg font-medium" role="status">
            {results.length} file{results.length === 1 ? "" : "s"} ready to share
          </h2>
          {#each results as result, i}
            <div class="rounded-md border border-surface1 bg-mantle p-4">
              <p class="mb-3 break-words text-sm font-medium">{result.title}</p>
              <label for={`uploaded-link-${i}`} class="sr-only"
                >Share link for {result.title}</label
              >
              <input
                id={`uploaded-link-${i}`}
                readonly
                value={result.shareUrl}
                onclick={(e) => e.currentTarget.select()}
                class="min-h-11 w-full min-w-0 rounded border border-surface1 bg-crust px-3 text-base text-text"
              />
              <div class="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onclick={() => copyLink(result.shareUrl)}
                  class="ui-button ui-button-primary min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-on-accent"
                  >Copy link</button
                >
                <a
                  href={result.shareUrl}
                  class="inline-flex min-h-11 items-center px-2 text-sm text-accent"
                  >Open file ↗</a
                >
              </div>
            </div>
          {/each}
          <p role="status" class="break-words text-sm text-subtext1">
            {copyStatus}
          </p>
        </section>
      {/if}
    </section>
  </div>

  <section
    aria-labelledby="sharing-details"
    class="border-t border-surface1 pt-5 sm:pt-8"
  >
    <h2 id="sharing-details" class="mb-4 text-lg font-medium">
      Before you share
    </h2>
    <dl class="grid gap-5 text-sm leading-relaxed md:grid-cols-3 md:gap-10">
      <div>
        <dt class="mb-2 font-medium">Files, with a preview</dt>
        <dd class="text-subtext1">
          Images, video and audio can be viewed in the browser. PDFs and
          archives are available to download.
        </dd>
      </div>
      <div>
        <dt class="mb-2 font-medium">Links are access</dt>
        <dd class="text-subtext1">
          Anyone with the link can open your file. Share it only with the people
          you want to give access to.
        </dd>
      </div>
      <div>
        <dt class="mb-2 font-medium">Available for a limited time</dt>
        <dd class="text-subtext1">
          Files expire automatically. Sign in to see your files, rename them or
          delete them before they expire.
        </dd>
      </div>
    </dl>
  </section>
</main>

{#if dnd.dragging}
  <div class="fixed inset-0 z-50 grid place-items-center bg-base/95 p-6">
    <p
      class="rounded-lg border-2 border-dashed border-accent p-8 text-xl font-medium text-accent"
    >
      Drop files to upload
    </p>
  </div>
{/if}

<footer
  class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-surface1 px-5 py-5 text-sm text-subtext1 sm:px-8"
>
  <span>Echo Link · Self-hosted file sharing</span>
  <div class="flex flex-wrap gap-5">
    <a
      href="https://github.com/benja971/echo-link"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 items-center hover:text-text"
      >Source &amp; self-hosting ↗</a
    >
    <a href="/privacy" class="inline-flex min-h-11 items-center hover:text-text"
      >Privacy</a
    >
  </div>
</footer>
