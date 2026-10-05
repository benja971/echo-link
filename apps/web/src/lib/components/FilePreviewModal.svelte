<script lang="ts">
  import { modal } from "$lib/actions/modal";
  import { copyText } from "$lib/utils/clipboard";
  import type { File } from "@echo-link/db";
  import { tick, untrack } from "svelte";
  import { formatFileSize, formatExpiresIn } from "$lib/utils/format";
  import { uploadErrorMessage, readErrorCode } from "$lib/utils/errors";

  type Props = {
    file: File | null;
    onClose: () => void;
    onDeleted?: (id: string) => void;
    onUpdated?: (file: File) => void;
    /** When true, the modal opens directly in edit mode. Used by the `E`
     *  shortcut on /app to skip the extra Edit-button click. */
    startInEdit?: boolean;
  };
  let {
    file,
    onClose,
    onDeleted,
    onUpdated,
    startInEdit = false,
  }: Props = $props();

  const fileUrl = $derived(file ? `/files/${file.s3Key}` : "");
  const shareUrl = $derived(
    file && typeof window !== "undefined"
      ? `${window.location.origin}/v/${file.slug ?? file.id}`
      : "",
  );
  const isVideo = $derived(file?.mimeType.startsWith("video/") ?? false);
  const isImage = $derived(file?.mimeType.startsWith("image/") ?? false);
  const isAudio = $derived(file?.mimeType.startsWith("audio/") ?? false);

  let copied = $state(false);
  let copyFailed = $state(false);
  let openedFileId: string | null = null;
  let deleting = $state(false);
  let deleteError = $state<string | null>(null);
  let deleteArmed = $state(false);
  let armTimer: ReturnType<typeof setTimeout> | null = null;

  // Edit-mode state
  let editing = $state(false);
  let titleDraft = $state("");
  let slugDraft = $state("");
  let saving = $state(false);
  let editError = $state<string | null>(null);
  let titleInputEl: HTMLInputElement | null = $state(null);

  async function copyLink() {
    if (!shareUrl) return;
    copied = await copyText(shareUrl);
    copyFailed = !copied;
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
      const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        deleteError = body.message ?? `delete failed (${res.status})`;
        return;
      }
      const id = file.id;
      onDeleted?.(id);
      onClose();
    } catch (e) {
      deleteError = e instanceof Error ? e.message : "delete failed";
    } finally {
      deleting = false;
    }
  }

  async function enterEdit() {
    if (!file) return;
    titleDraft = file.title ?? "";
    slugDraft = file.slug ?? "";
    editError = null;
    editing = true;
    await tick();
    titleInputEl?.focus();
    titleInputEl?.select();
  }

  async function cancelEdit() {
    editing = false;
    editError = null;
    await tick();
    document.getElementById("preview-edit")?.focus();
  }

  async function saveEdit() {
    if (!file || saving) return;
    saving = true;
    editError = null;
    const patch: { title?: string | null; slug?: string | null } = {};
    const newTitle = titleDraft.trim();
    const newSlug = slugDraft.trim().toLowerCase();
    if (newTitle !== (file.title ?? ""))
      patch.title = newTitle === "" ? null : newTitle;
    if (newSlug !== (file.slug ?? ""))
      patch.slug = newSlug === "" ? null : newSlug;

    if (Object.keys(patch).length === 0) {
      await cancelEdit();
      saving = false;
      return;
    }

    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const code = await readErrorCode(res);
        editError = uploadErrorMessage(code);
        return;
      }
      const body = (await res.json()) as { file: File };
      onUpdated?.(body.file);
      await cancelEdit();
    } catch (e) {
      editError = e instanceof Error ? e.message : "save failed";
    } finally {
      saving = false;
    }
  }

  function onEditKey(e: KeyboardEvent) {
    if (!(e.target instanceof HTMLInputElement)) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void saveEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Allow Enter to submit when focus is on a single-line input
      e.preventDefault();
      void saveEdit();
    }
  }

  $effect(() => {
    const id = file?.id ?? null;
    const shouldEdit = startInEdit;
    if (id === openedFileId) return;
    openedFileId = id;
    clearArm();
    copied = false;
    copyFailed = false;
    editing = false;
    editError = null;
    deleteError = null;
    if (id && shouldEdit) untrack(() => void enterEdit());
  });

  function cancelDialog(event: Event) {
    event.preventDefault();
    if (editing) cancelEdit();
    else onClose();
  }
</script>

{#if file}
  <dialog
    use:modal={onClose}
    oncancel={cancelDialog}
    aria-label={`File preview: ${file.title ?? file.s3Key}`}
    class="preview-modal m-auto max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] rounded-xl border border-surface1 bg-mantle p-0 text-text"
  >
    <div
      class="preview-content relative flex max-h-[calc(100dvh-32px)] max-w-full flex-col overflow-y-auto"
    >
      <!-- Media area — min-h-0 + overflow-hidden lets it shrink so the
           footer/edit form below stays visible. The media element keeps
           its own max-h-[72vh] / max-w-[88vw] caps so the modal doesn't
           blow up to the video's intrinsic size. -->
      <div
        class="preview-media grid min-h-0 place-items-center overflow-hidden bg-crust"
      >
        {#if isImage}
          <img
            src={fileUrl}
            alt={file.title ?? ""}
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
          <div
            class="grid w-[min(28rem,calc(100vw-32px))] min-w-0 place-items-center px-4 py-12 sm:px-12 sm:py-16"
          >
            <svg
              aria-hidden="true"
              class="mb-4 h-10 w-10 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              ><path d="M9 18V5l11-2v13M9 7l11-2" /><ellipse
                cx="6"
                cy="18"
                rx="3"
                ry="2"
              /><ellipse cx="17" cy="16" rx="3" ry="2" /></svg
            >
            <audio src={fileUrl} controls class="w-full max-w-full"></audio>
          </div>
        {:else}
          <div
            class="grid w-[min(28rem,calc(100vw-32px))] min-w-0 place-items-center px-4 py-12 sm:px-12 sm:py-16 text-center"
          >
            <svg
              aria-hidden="true"
              class="mb-3 h-10 w-10 text-subtext1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              ><path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h8" /></svg
            >
            <p class="font-mono text-sm text-subtext0">{file.mimeType}</p>
            <a
              href={fileUrl}
              download
              class="ui-button mt-4 inline-flex items-center gap-2 rounded-md border border-surface1 bg-surface0 px-3 py-2 font-mono text-xs text-text hover:bg-surface1"
            >
              Download
            </a>
          </div>
        {/if}
      </div>

      {#if editing}
        <!-- Edit form replaces footer while editing. shrink-0 keeps the
             save/cancel row visible even when the modal hits max-h. -->
        <div
          class="preview-editor flex shrink-0 flex-col gap-3 border-t border-surface0 bg-mantle px-5 py-4"
        >
          <div class="flex flex-col gap-1">
            <label
              for="edit-title"
              class="font-mono text-[11px] uppercase tracking-wide text-overlay1"
            >
              title
            </label>
            <input
              id="edit-title"
              aria-invalid={Boolean(editError)}
              aria-describedby={editError ? "preview-edit-error" : undefined}
              bind:value={titleDraft}
              bind:this={titleInputEl}
              onkeydown={onEditKey}
              maxlength={200}
              class="min-h-11 rounded-md border border-surface1 bg-surface0 px-3 py-2 font-sans text-base text-text outline-none focus:border-accent"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label
              for="edit-slug"
              class="font-mono text-[11px] uppercase tracking-wide text-overlay1"
            >
              custom URL
            </label>
            <div
              class="flex items-stretch overflow-hidden rounded-md border border-surface1 bg-surface0 focus-within:border-accent"
            >
              <span
                class="grid place-items-center px-3 font-mono text-xs text-overlay1"
                >/v/</span
              >
              <input
                id="edit-slug"
                aria-invalid={Boolean(editError)}
                aria-describedby={editError ? "preview-edit-error" : undefined}
                bind:value={slugDraft}
                onkeydown={onEditKey}
                placeholder="leave empty to use UUID"
                maxlength={40}
                spellcheck="false"
                autocapitalize="none"
                autocorrect="off"
                class="min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-base text-text outline-none placeholder:text-overlay0"
              />
            </div>
          </div>
          <div
            class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div
              id="preview-edit-error"
              role="alert"
              class="min-w-0 flex-1 break-words text-sm text-red"
            >
              {editError ?? ""}
            </div>
            <div class="preview-actions flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onclick={cancelEdit}
                disabled={saving}
                class="ui-button inline-flex min-h-11 items-center rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-subtext1 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onclick={saveEdit}
                disabled={saving}
                class="ui-button ui-button-primary inline-flex min-h-11 items-center rounded-md border border-accent/40 px-3 py-2 text-sm text-accent transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <!-- Footer with metadata + actions -->
        <div
          class="preview-footer flex shrink-0 flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center border-t border-surface0 bg-mantle px-5 py-3"
        >
          <div class="min-w-0 flex-1">
            <div
              id="preview-title"
              class="break-words text-sm font-medium text-text"
            >
              {file.title ?? file.s3Key}
            </div>
            <div
              class="preview-metadata break-words font-mono text-xs text-overlay1"
            >
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
              {#if file.slug}
                <span class="mx-1.5 text-subtext0">·</span>
                <span class="text-accent">/v/{file.slug}</span>
              {/if}
            </div>
          </div>
          <div class="preview-actions flex shrink-0 flex-wrap gap-2">
            {#if onUpdated}
              <button
                type="button"
                id="preview-edit"
                onclick={enterEdit}
                title="rename or set a custom URL"
                class="ui-button inline-flex min-h-11 items-center rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-subtext1 transition-colors"
              >
                Edit
              </button>
            {/if}
            {#if onDeleted}
              <button
                type="button"
                onclick={onDeleteClick}
                disabled={deleting}
                title={deleteArmed
                  ? "click again within 3s to confirm"
                  : "delete this file permanently"}
                class="ui-button ui-button-danger inline-flex min-h-11 min-w-[7.5rem] items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-60 {deleteArmed
                  ? 'border-red bg-red/15 text-red '
                  : 'border-surface1 bg-surface0 text-subtext1 '}"
              >
                {#if deleting}
                  deleting…
                {:else if deleteArmed}
                  Confirm delete
                {:else}
                  Delete
                {/if}
              </button>
            {/if}
            <a
              href={fileUrl}
              download
              class="ui-button inline-flex min-h-11 items-center rounded-md border border-surface1 bg-surface0 px-3 py-2 text-sm text-subtext1 transition-colors hover:bg-surface1 hover:text-text"
            >
              Download
            </a>
            <button
              type="button"
              onclick={copyLink}
              class="ui-button ui-button-primary inline-flex min-h-11 items-center rounded-md border border-accent/40 px-3 py-2 text-sm text-accent transition-colors"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
        <p role="status" class="sr-only">{copied ? "Link copied" : ""}</p>
        {#if copyFailed}
          <div class="border-t border-surface0 px-5 py-3">
            <p role="status" class="mb-2 text-sm text-subtext1">
              Copy unavailable. Select and copy this link:
            </p>
            <input
              aria-label="Share link"
              value={shareUrl}
              readonly
              onclick={(event) => event.currentTarget.select()}
              class="min-h-11 w-full min-w-0 rounded border border-surface1 bg-surface0 px-3 text-base text-text"
            />
          </div>
        {/if}
        {#if deleteError}
          <div
            role="alert"
            class="border-t border-red/20 bg-red/5 px-5 py-2 font-mono text-xs text-red"
          >
            {deleteError}
          </div>
        {/if}
      {/if}

      <!-- Close button (top-right corner of the modal) -->
      <button
        type="button"
        aria-label="Close preview"
        data-dialog-focus
        onclick={onClose}
        class="ui-button absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-crust/70 font-mono text-sm text-subtext0 backdrop-blur transition-colors"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg
        >
      </button>
    </div>
  </dialog>
{/if}

<style>
  .preview-modal::backdrop {
    background: color-mix(in srgb, var(--color-crust) 80%, transparent);
  }
  @media (max-width: 639px) {
    .preview-modal {
      width: calc(100% - 16px);
      max-width: calc(100% - 16px);
      max-height: calc(100dvh - 16px);
    }
    .preview-content {
      width: 100%;
      max-height: calc(100dvh - 16px);
    }
    .preview-media {
      flex-shrink: 0;
      min-height: 120px;
    }
    .preview-media :global(img),
    .preview-media :global(video) {
      max-width: 100%;
      max-height: 40dvh;
    }
    .preview-media > div {
      width: 100%;
      padding: 48px 16px 24px;
    }
    .preview-footer,
    .preview-editor {
      padding: 20px 16px max(20px, env(safe-area-inset-bottom));
      gap: 20px;
    }
    #preview-title {
      font-size: 20px;
      line-height: 26px;
      margin-bottom: 8px;
      overflow-wrap: anywhere;
    }
    .preview-metadata {
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 20px;
    }
    .preview-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .preview-actions :global(button),
    .preview-actions :global(a) {
      justify-content: center;
      min-width: 0;
      min-height: 44px;
    }
    .preview-actions :global(a[download]) {
      grid-row: 1;
      grid-column: 1;
    }
    .preview-actions :global(button.ui-button-primary) {
      grid-row: 1;
      grid-column: 2;
    }
  }
</style>
