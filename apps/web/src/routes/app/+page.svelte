<!-- apps/web/src/routes/app/+page.svelte -->
<script lang="ts">
  import Brand from "$components/Brand.svelte";
  import Dropzone from "$components/Dropzone.svelte";
  import FileRow from "$components/FileRow.svelte";
  import FileGrid from "$components/FileGrid.svelte";
  import CommandPalette from "$components/CommandPalette.svelte";
  import FilePreviewModal from "$components/FilePreviewModal.svelte";
  import KeyboardCheatsheet from "$components/KeyboardCheatsheet.svelte";
  import { formatShortcut } from "$lib/utils/platform";
  import { copyText } from "$lib/utils/clipboard";
  import { deleteFiles } from "$lib/utils/delete-files";
  import { formatFileSize } from "$lib/utils/format";
  import { useDropAnywhere } from "$lib/hooks/useDropAnywhere.svelte";
  import { useClipboardPaste } from "$lib/hooks/useClipboardPaste.svelte";
  import { useShortcuts } from "$lib/hooks/useShortcuts.svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { toast } from "$lib/stores/toast.svelte";
  import { uploadErrorMessage } from "$lib/utils/errors";
  import {
    uploadFileWithProgress,
    type UploadProgress,
  } from "$lib/utils/upload-with-progress";
  import { TIPS } from "$lib/utils/tips";
  import RotatingTip from "$components/RotatingTip.svelte";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { invalidateAll } from "$app/navigation";

  let { data } = $props();

  let busy = $state(false);
  let recoverableLinks = $state<string[]>([]);
  let uploadResults = $state<{ shareUrl: string; title: string }[]>([]);
  let batchDeleteError = $state<string | null>(null);
  let uploadError = $state<string | null>(null);
  let uploadProgress = $state<UploadProgress | null>(null);
  let uploadingFileName = $state<string | null>(null);
  /** When uploading multiple files in sequence, exposes `current of total`. */
  let queue = $state<{ current: number; total: number } | null>(null);
  let paletteOpen = $state(false);
  let preview = $state<(typeof data.files)[number] | null>(null);
  let previewStartInEdit = $state(false);
  let selectedIndex = $state<number | null>(null);
  const selectedFile = $derived(
    selectedIndex !== null ? (data.files[selectedIndex] ?? null) : null,
  );

  // Multi-select set (vim/gmail style — Space toggles, A selects all)
  let markedIds = $state<Set<string>>(new Set());
  const markedCount = $derived(markedIds.size);
  const hasMarked = $derived(markedIds.size > 0);
  // Single-target edit candidate: prefer the only marked file, fall back
  // to the J/K-focused tile. Drives both the `E` shortcut and the toolbar
  // edit button. Editing isn't a batch op — visible only at count 1.
  const editTarget = $derived(
    markedCount === 1
      ? (data.files.find((f) => markedIds.has(f.id)) ?? null)
      : selectedFile,
  );

  // D-armed state for batch delete (single button slot, click-twice)
  let batchDeleteArmed = $state(false);
  let batchArmTimer: ReturnType<typeof setTimeout> | null = null;
  let batchDeleting = $state(false);

  function toggleMark(id: string) {
    if (batchDeleting) return;
    if (markedIds.has(id)) markedIds.delete(id);
    else markedIds.add(id);
    markedIds = new Set(markedIds); // trigger Svelte reactivity
  }
  function selectAll() {
    if (batchDeleting) return;
    markedIds = new Set(data.files.map((f) => f.id));
  }
  function clearMarked() {
    if (batchDeleting) return;
    markedIds = new Set();
    if (batchArmTimer) {
      clearTimeout(batchArmTimer);
      batchArmTimer = null;
    }
    batchDeleteArmed = false;
  }

  async function copyMarked() {
    const urls = data.files
      .filter((f) => markedIds.has(f.id))
      .map((f) => `${window.location.origin}/v/${f.slug ?? f.id}`);
    if (urls.length === 0) return;
    const copied = await copyText(urls.join("\n"));
    recoverableLinks = copied ? [] : urls;
    toast.flash(
      copied
        ? `${urls.length} link${urls.length === 1 ? "" : "s"} copied`
        : "Copy unavailable. Select the links below to copy manually.",
    );
  }

  async function deleteMarked() {
    if (markedIds.size === 0 || batchDeleting) return;
    if (!batchDeleteArmed) {
      batchDeleteArmed = true;
      batchArmTimer = setTimeout(() => {
        batchDeleteArmed = false;
        batchArmTimer = null;
      }, 3000);
      return;
    }
    if (batchArmTimer) {
      clearTimeout(batchArmTimer);
      batchArmTimer = null;
    }
    batchDeleteArmed = false;
    batchDeleting = true;
    const ids = Array.from(markedIds);
    batchDeleteError = null;
    const result = await deleteFiles(ids);
    const okCount = result.deletedIds.length;
    const failedIds = new Set(result.failedIds);
    markedIds = failedIds;
    if (failedIds.size > 0)
      batchDeleteError = `${failedIds.size} file${failedIds.size === 1 ? "" : "s"} could not be deleted. They remain selected. Try again.`;
    if (okCount > 0)
      toast.flash(`${okCount} file${okCount === 1 ? "" : "s"} deleted`);
    try {
      await invalidateAll();
    } catch {
      batchDeleteError =
        "Could not refresh files. Reload to see the latest deletion results.";
    } finally {
      batchDeleting = false;
    }
  }
  let cheatsheetOpen = $state(false);

  const filesPct = $derived(
    Math.min(
      100,
      Math.round((data.stats.fileCount / data.limits.maxFiles) * 100),
    ),
  );
  const bytesPct = $derived(
    Math.min(
      100,
      Math.round((data.stats.totalBytes / data.limits.maxBytes) * 100),
    ),
  );
  const usagePct = $derived(Math.max(filesPct, bytesPct));
  let recent = $derived(data.files.slice(0, 3));
  let allFiles = $derived(data.files);

  let reducedMotion = $state(false);
  onMount(() => {
    theme.init();
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reducedMotion = preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  });

  async function handleFiles(files: File[]) {
    if (files.length === 0 || busy) return;
    busy = true;
    uploadError = null;
    queue = files.length > 1 ? { current: 0, total: files.length } : null;
    const shareUrls: string[] = [];
    let okCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (queue) queue.current = i + 1;
      uploadingFileName = file.name;
      uploadProgress = { loaded: 0, total: file.size, pct: 0 };
      try {
        const result = await uploadFileWithProgress(
          file,
          "/api/upload",
          (p) => {
            uploadProgress = p;
          },
        );
        if (!result.ok) {
          const code = result.errorCode ?? `http ${result.status}`;
          const typeRecovery =
            code === "unrecognized_file_type" ||
            code.startsWith("mime_not_allowed:")
              ? " Try an image, video, audio file, PDF or ZIP."
              : "";
          uploadError = `${file.name}: ${uploadErrorMessage(code)}.${typeRecovery}${okCount > 0 ? " Completed uploads are ready to share above." : ""}`;
          break; // stop the queue on first failure
        }
        const out = result.body as { shareUrl: string; title?: string };
        shareUrls.push(out.shareUrl);
        uploadResults = [
          ...uploadResults,
          { shareUrl: out.shareUrl, title: out.title ?? file.name },
        ];
        okCount++;
      } catch {
        uploadError = `${file.name}: upload interrupted. Check your connection and try again.${okCount > 0 ? " Completed uploads are ready to share above." : ""}`;
        break;
      }
    }

    uploadProgress = null;
    uploadingFileName = null;
    queue = null;
    if (okCount > 0) {
      recoverableLinks = [];
      try {
        await invalidateAll();
      } catch {
        uploadError =
          "Files uploaded, but the collection could not refresh. Reload to see them.";
      }
      busy = false;
      const copied = await copyText(shareUrls.join("\n"));

      toast.flash(
        `${okCount} file${okCount === 1 ? "" : "s"} uploaded. ${copied ? "Links copied." : "Copy the links below manually."}`,
      );
    } else {
      busy = false;
    }
  }

  async function copyLink(file: (typeof data.files)[number]) {
    const url = `${window.location.origin}/v/${file.slug ?? file.id}`;
    const copied = await copyText(url);
    recoverableLinks = copied ? [] : [url];
    toast.flash(
      copied
        ? `Link copied: ${file.title ?? "file"}`
        : "Copy unavailable. Select the link below to copy manually.",
    );
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
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
  const anyOverlayOpen = $derived(
    paletteOpen || cheatsheetOpen || preview !== null,
  );

  function moveSelection(delta: number) {
    if (allFiles.length === 0) return;
    if (selectedIndex === null) {
      selectedIndex = delta > 0 ? 0 : allFiles.length - 1;
    } else {
      const next = Math.max(
        0,
        Math.min(allFiles.length - 1, selectedIndex + delta),
      );
      selectedIndex = next;
    }
    // scroll the selected tile into view if off-screen
    queueMicrotask(() => {
      const id = allFiles[selectedIndex!]?.id;
      if (!id) return;
      const el = document.querySelector<HTMLElement>(`[data-file-id="${id}"]`);
      el?.closest<HTMLElement>("[data-file-grid]")?.focus({
        preventScroll: true,
      });
      el?.scrollIntoView({
        block: "nearest",
        behavior: reducedMotion ? "instant" : "smooth",
      });
    });
  }

  useShortcuts(() => [
    {
      key: "k",
      meta: true,
      enabled: () => !otherOverlayOpen,
      action: () => (paletteOpen = !paletteOpen),
    },
    {
      key: "k",
      ctrl: true,
      enabled: () => !otherOverlayOpen,
      action: () => (paletteOpen = !paletteOpen),
    },
    {
      key: "?",
      enabled: () => !paletteOpen && preview === null,
      action: () => (cheatsheetOpen = !cheatsheetOpen),
    },
    {
      key: "o",
      enabled: () => !anyOverlayOpen,
      action: () =>
        document
          .querySelector<HTMLButtonElement>("[data-pick-trigger]")
          ?.click(),
    },
    { key: "t", enabled: () => !anyOverlayOpen, action: () => theme.cycle() },
    // C: copy marked files if any, else copy last
    {
      key: "c",
      enabled: () => !anyOverlayOpen,
      action: () => (hasMarked ? copyMarked() : copyLast()),
    },
    // Vim-style navigation in the all-files grid
    {
      key: "j",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen,
      action: () => moveSelection(+1),
    },
    {
      key: "k",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen,
      action: () => moveSelection(-1),
    },
    {
      key: "arrowdown",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen,
      action: () => moveSelection(+1),
    },
    {
      key: "arrowup",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen,
      action: () => moveSelection(-1),
    },
    {
      key: "enter",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen && selectedFile !== null,
      action: () => {
        if (selectedFile) {
          previewStartInEdit = false;
          preview = selectedFile;
        }
      },
    },
    // E: open in edit mode — the single marked file if one is marked,
    // else the J/K-focused tile.
    {
      key: "e",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen && editTarget !== null,
      action: () => {
        if (editTarget) {
          previewStartInEdit = true;
          preview = editTarget;
        }
      },
    },
    // Multi-select (vim/gmail style). The enabled() guard intentionally
    // does NOT require an existing focus — pressing Space with nothing
    // focused jumps to the first file AND marks it (also stops the
    // browser from default-scrolling the page).
    {
      key: " ",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen && allFiles.length > 0,
      action: () => {
        let f = selectedFile;
        if (f === null) {
          selectedIndex = 0;
          f = allFiles[0] ?? null;
        }
        if (f) toggleMark(f.id);
      },
    },
    {
      key: "a",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen && allFiles.length > 0,
      action: selectAll,
    },
    {
      key: "d",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen && hasMarked,
      action: deleteMarked,
    },
    {
      key: "escape",
      scope: "[data-file-grid]",
      enabled: () => !anyOverlayOpen && (selectedIndex !== null || hasMarked),
      action: () => {
        selectedIndex = null;
        clearMarked();
      },
    },
    ...recent.map((file, i) => ({
      key: String(i + 1),
      enabled: () => !anyOverlayOpen,
      action: () => copyLink(file),
    })),
  ]);
</script>

<svelte:head><title>echo·link · workspace</title></svelte:head>

<div class="min-h-screen pb-8">
  <header
    class="flex flex-wrap items-center justify-between gap-3 border-b border-surface0 px-4 py-3 sm:px-7 sm:py-4"
  >
    <Brand />
    <div class="flex min-w-0 items-center gap-3">
      <span class="hidden md:inline text-xs text-subtext0">
        press <span
          class="font-mono rounded border border-surface1 border-b bg-surface0 px-1 py-px text-[10px] text-text"
          >{formatShortcut("K", { mod: true })}</span
        >
        for anything ·
        <span
          class="font-mono rounded border border-surface1 border-b bg-surface0 px-1 py-px text-[10px] text-text"
          >?</span
        > for shortcuts
      </span>
      <span
        class="hidden sm:inline-flex max-w-64 truncate items-center gap-2 rounded-full bg-surface0 px-3 py-2 text-sm text-subtext1"
      >
        {data.session?.email}
      </span>
      <button
        type="button"
        onclick={() => (paletteOpen = true)}
        class="ui-button min-h-11 rounded-md border border-surface1 bg-mantle px-4 text-sm text-text"
        >Menu</button
      >
    </div>
  </header>

  <main id="main-content">
    <h1
      class="mx-auto max-w-3xl px-4 pt-5 text-2xl sm:pt-8 font-medium sm:px-8"
    >
      Your files
    </h1>
    <p class="mx-auto mt-2 max-w-3xl px-4 text-sm text-subtext1 sm:hidden">
      {data.stats.fileCount} of {data.limits.maxFiles} files · {formatFileSize(
        data.stats.totalBytes,
      )} of {formatFileSize(data.limits.maxBytes)}
    </p>
    <section class="hidden px-6 pt-6 text-center sm:block">
      <div
        class="inline-flex flex-wrap items-center justify-center gap-1.5 font-mono text-xs text-overlay1 tracking-wide"
      >
        <span class="rounded-full bg-surface0 px-2.5 py-1">
          <strong class="text-text">{data.stats.fileCount}</strong>
          <span class="text-overlay0">/{data.limits.maxFiles}</span> files
        </span>
        <span class="rounded-full bg-surface0 px-2.5 py-1">
          <strong class="text-text"
            >{formatFileSize(data.stats.totalBytes)}</strong
          >
          <span class="text-overlay0"
            >/ {formatFileSize(data.limits.maxBytes)}</span
          >
        </span>
        <span
          class="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-surface0 px-2.5 py-1"
          title="usage = max(files used, storage used)"
        >
          <span
            class="absolute inset-y-0 left-0 transition-[width] duration-500 [transition-timing-function:var(--ease-out-expo)]"
            style:width="{usagePct}%"
            style:background-color={"color-mix(in oklab, var(--color-accent) 22%, transparent)"}
          ></span>
          <span class="relative">
            <strong class="text-text">{usagePct}%</strong>
            <span class="text-overlay0">used</span>
          </span>
        </span>
      </div>
    </section>

    <section class="mx-auto mt-5 max-w-3xl px-4 sm:mt-7 sm:px-8">
      <Dropzone onFiles={handleFiles} {busy} compact />
      {#if uploadProgress}
        <div class="mt-3 rounded-md border border-surface0 bg-mantle p-3">
          <div
            class="mb-2 flex items-baseline justify-between font-mono text-xs"
          >
            <span class="truncate text-subtext1">
              {#if queue}
                <span class="text-overlay1"
                  >{queue.current} / {queue.total} ·</span
                >
              {/if}
              uploading <span class="text-text">{uploadingFileName}</span>…
            </span>
            <span class="ml-3 shrink-0 text-text">{uploadProgress.pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress.pct}
            class="h-1.5 overflow-hidden rounded-full bg-surface0"
          >
            <div
              class="h-full transition-[width] duration-150"
              style:width="{uploadProgress.pct}%"
              style:background-color={"var(--color-accent)"}
            ></div>
          </div>
          <div class="mt-1 font-mono text-[11px] text-overlay1">
            {formatFileSize(uploadProgress.loaded)} / {formatFileSize(
              uploadProgress.total,
            )}
          </div>
        </div>
      {/if}
      {#if uploadResults.length > 0}
        <section class="mt-4 space-y-3" aria-label="Uploaded files">
          <h2 class="text-base font-medium text-text" role="status">
            Ready to share
          </h2>
          {#each uploadResults as result}
            <div class="rounded-md border border-surface1 bg-mantle p-3">
              <p class="mb-2 break-words text-sm font-medium">{result.title}</p>
              <input
                aria-label={`Share link for ${result.title}`}
                readonly
                value={result.shareUrl}
                onclick={(e) => e.currentTarget.select()}
                class="min-h-11 w-full min-w-0 rounded-md border border-surface1 bg-crust px-3 text-base text-text"
              />
              <div class="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onclick={async () =>
                    toast.flash(
                      (await copyText(result.shareUrl))
                        ? "Link copied"
                        : "Copy unavailable. Select the link above to copy manually.",
                    )}
                  class="ui-button ui-button-primary min-h-11 rounded-md px-3 text-sm font-medium"
                  >Copy link</button
                >
                <a
                  href={result.shareUrl}
                  class="ui-button flex min-h-11 items-center justify-center rounded-md border border-surface1 bg-surface0 px-3 text-sm"
                  >Open file</a
                >
              </div>
            </div>
          {/each}
        </section>
      {/if}
      {#if recoverableLinks.length > 0}
        <div
          role="status"
          class="mt-3 rounded-md border border-surface1 bg-mantle p-4"
        >
          <label for="recoverable-links" class="text-sm text-text"
            >Your share links. Select and copy manually.</label
          >
          <textarea
            id="recoverable-links"
            readonly
            value={recoverableLinks.join("\n")}
            rows={Math.min(5, recoverableLinks.length + 1)}
            class="mt-2 w-full rounded border border-surface1 bg-base p-3 text-sm text-text"
            onclick={(event) => event.currentTarget.select()}
          ></textarea>
        </div>
      {/if}
      {#if uploadError}
        <div
          role="alert"
          class="mt-3 rounded-md border border-red/30 bg-red/5 p-3 break-words text-sm text-red [overflow-wrap:anywhere]"
        >
          {uploadError}
        </div>
      {/if}
    </section>

    {#if recent.length > 0}
      <section class="mx-auto mt-14 hidden max-w-3xl px-4 sm:block sm:px-8">
        <div
          class="mb-3.5 flex items-baseline justify-between px-1 font-mono text-xs text-subtext0"
        >
          <span class="before:text-overlay0 before:content-['//_']">recent</span
          >
          <span class="hidden sm:inline text-overlay1 text-[11px]">
            press <span
              class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]"
              >1</span
            >
            <span
              class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]"
              >2</span
            >
            <span
              class="rounded border border-surface1 border-b-2 bg-surface0 px-1 text-[10px]"
              >3</span
            > to copy
          </span>
        </div>
        {#each recent as file, i}
          <FileRow
            {file}
            shortcutLabel={`${i + 1}`}
            onCopy={copyLink}
            delay={(i + 1) * 100}
          />
        {/each}
      </section>
    {/if}

    <section class="mx-auto mt-7 max-w-3xl px-4 pb-8 sm:mt-16 sm:px-8 sm:pb-12">
      {#if hasMarked}
        <div
          class="sticky top-0 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/40 sm:static px-4 py-2.5 text-sm"
          style:background-color={"color-mix(in oklab, var(--color-accent) 10%, var(--color-mantle))"}
        >
          <span class="text-text">{markedCount} selected</span>
          <span
            class="grid w-full grid-cols-2 gap-2 text-overlay1 sm:flex sm:w-auto sm:flex-wrap sm:items-center"
          >
            {#if markedCount === 1 && editTarget}
              <button
                type="button"
                onclick={() => {
                  previewStartInEdit = true;
                  preview = editTarget;
                }}
                class="ui-button rounded-md border border-surface1 bg-surface0 min-h-11 px-3 py-2 text-text transition-colors"
                >Edit</button
              >
            {/if}
            <button
              type="button"
              onclick={copyMarked}
              class="ui-button rounded-md border border-surface1 bg-surface0 min-h-11 px-3 py-2 text-text transition-colors"
              >Copy links</button
            >
            <button
              type="button"
              onclick={deleteMarked}
              disabled={batchDeleting}
              class="ui-button ui-button-danger rounded-md border bg-surface0 min-h-11 px-3 py-2 transition-colors disabled:opacity-60 {batchDeleteArmed
                ? 'border-red bg-red/15 text-red '
                : 'border-surface1  text-text '}"
              >{batchDeleting
                ? "deleting…"
                : batchDeleteArmed
                  ? `Confirm delete ${markedCount}`
                  : "Delete"}</button
            >
            <button
              type="button"
              onclick={clearMarked}
              class="ui-button rounded-md border border-surface1 bg-surface0 min-h-11 px-3 py-2 text-subtext0 transition-colors"
              >Clear</button
            >
          </span>
        </div>
      {:else}
        <div
          class="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-subtext1 sm:font-mono sm:text-xs"
        >
          <span
            >Files <span class="text-subtext1">({allFiles.length})</span></span
          >
          {#if allFiles.length > 0}
            <button
              type="button"
              onclick={selectAll}
              class="ui-button min-h-11 rounded-md border border-surface1 px-3 text-text"
              >Select all</button
            >
            <span class="hidden sm:inline text-overlay1 text-[11px]">
              <span
                class="rounded border border-surface1 border-b bg-surface0 px-1 text-[10px]"
                >space</span
              >
              to mark ·
              <span
                class="rounded border border-surface1 border-b bg-surface0 px-1 text-[10px]"
                >A</span
              > select all
            </span>
          {/if}
        </div>
      {/if}
      {#if batchDeleteError}
        <p role="alert" class="mb-3 text-sm text-red">{batchDeleteError}</p>
      {/if}
      {#if allFiles.length === 0}
        <div
          class="grid place-items-center rounded-md border border-dashed border-surface1 bg-mantle/40 px-6 py-14 text-center"
        >
          <div class="font-mono text-3xl text-overlay1">∅</div>
          <p class="mt-3 font-sans text-sm text-subtext0">
            no files yet. drop one above, paste a screenshot, or press <span
              class="font-mono rounded border border-surface1 border-b bg-surface0 px-1 py-px text-[11px] text-text"
              >O</span
            >
          </p>
          <p class="mt-1 font-mono text-xs text-overlay1">
            files live here for up to {data.limits.expirationDays} days, or until
            you delete them
          </p>
        </div>
      {:else}
        <div
          class="divide-y divide-surface1 border-y border-surface1 sm:hidden"
          role="region"
          aria-label="Files"
        >
          {#each allFiles as file}
            <FileRow
              {file}
              collection
              marked={markedIds.has(file.id)}
              onToggleMark={toggleMark}
              markingDisabled={batchDeleting}
              onCopy={copyLink}
              onMore={(f) => {
                previewStartInEdit = false;
                preview = f;
              }}
            />
          {/each}
        </div>
        <div class="hidden sm:block">
          <FileGrid
            files={allFiles}
            selectedId={selectedFile?.id ?? null}
            {markedIds}
            onToggleMark={toggleMark}
            markingDisabled={batchDeleting}
            onFocus={(file) => {
              selectedIndex = allFiles.findIndex((f) => f.id === file.id);
            }}
            onSelect={(f) => {
              previewStartInEdit = false;
              preview = f;
            }}
          />
        </div>
      {/if}
    </section>
  </main>
</div>

<CommandPalette
  bind:open={paletteOpen}
  onClose={() => (paletteOpen = false)}
  files={allFiles}
  onUpload={() =>
    document.querySelector<HTMLButtonElement>("[data-pick-trigger]")?.click()}
  onCopyLast={copyLast}
  onSignOut={signOut}
/>

<FilePreviewModal
  file={preview}
  startInEdit={previewStartInEdit}
  onClose={() => {
    preview = null;
    previewStartInEdit = false;
  }}
  onDeleted={() => {
    toast.flash(`✓ file deleted`);
    void invalidateAll();
  }}
  onUpdated={(updated) => {
    toast.flash(updated.slug ? `✓ saved — /v/${updated.slug}` : `✓ saved`);
    preview = updated;
    void invalidateAll();
  }}
/>

<KeyboardCheatsheet
  bind:open={cheatsheetOpen}
  onClose={() => (cheatsheetOpen = false)}
/>

{#if dnd.dragging}
  <div class="fixed inset-0 z-50 grid place-items-center bg-base/95">
    <div class="font-mono text-xl text-accent">Drop files to upload</div>
  </div>
{/if}

<!-- Copy/action toast — bottom-right, above the tip strip -->
{#if toast.message}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-16 right-4 left-4 sm:left-auto z-40 max-w-sm rounded-md border border-accent/40 px-4 py-3 font-sans text-sm text-text shadow-2xl backdrop-blur"
    style:background-color={"color-mix(in oklab, var(--color-accent) 14%, var(--color-mantle))"}
    transition:fly={{ y: reducedMotion ? 0 : 12, duration: 150 }}
  >
    {toast.message}
  </div>
{/if}

<div
  class="mx-auto hidden max-w-3xl flex-wrap items-center gap-4 border-t sm:flex border-surface1 px-5 py-3 sm:px-8"
>
  <div class="min-w-0 flex-1">
    <RotatingTip tips={TIPS} class="text-sm text-subtext0" />
  </div>
  <button
    type="button"
    onclick={() => (paletteOpen = true)}
    title="open command palette to change theme or accent"
    class="ui-button flex min-h-11 shrink-0 items-center gap-2 text-xs text-subtext0 transition-colors"
  >
    <span
      class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style:background-color={"var(--color-accent)"}
    ></span>
    <span>Appearance</span>
  </button>
</div>
