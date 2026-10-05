<!-- apps/web/src/lib/components/Dropzone.svelte -->
<script lang="ts">
  type Props = {
    onFiles: (files: File[]) => void;
    busy?: boolean;
    compact?: boolean;
    title?: string;
    sub?: string;
    anonTag?: string;
    /** Allow selecting multiple files at once via the picker. */
    multiple?: boolean;
  };
  let {
    onFiles,
    busy = false,
    compact = false,
    title = "Choose files",
    sub,
    anonTag,
    multiple = true,
  }: Props = $props();
  const subText = $derived(sub ?? "Drop files here or paste an image");

  let input: HTMLInputElement;

  function pick() {
    input.click();
  }

  function onChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    if (files.length > 0) onFiles(files);
    target.value = "";
  }
</script>

<button
  type="button"
  data-pick-trigger
  class:dropzone-compact={compact}
  onclick={pick}
  disabled={busy}
  aria-label={busy ? "Uploading files" : title}
  class="group flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed border-overlay1 bg-mantle px-5 py-5 text-center transition-colors duration-150 disabled:cursor-wait disabled:opacity-70 sm:min-h-72 sm:px-8 sm:py-8"
>
  <svg
    aria-hidden="true"
    width="32"
    height="40"
    viewBox="0 0 32 40"
    fill="none"
    class="mb-3 h-8 w-6 text-subtext1 sm:mb-5 sm:h-10 sm:w-8"
  >
    <path
      d="M6 1h13l12 12v25H1V1h5Zm13 0v12h12M16 31V19m-5 5 5-5 5 5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
  <div class="dropzone-content flex flex-col items-center">
    <span
      class="ui-button ui-button-primary inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 text-base font-medium text-on-accent"
      >{busy ? "Uploading…" : title}</span
    >
    <span class="mt-3 text-sm text-subtext1 sm:hidden">Tap to select files</span
    >
    <span class="mt-4 hidden text-sm text-subtext1 sm:block">{subText}</span>
    {#if anonTag}
      <span class="mt-5 text-sm text-subtext1">{anonTag}</span>
    {/if}
  </div>
</button>

<input
  bind:this={input}
  type="file"
  hidden
  {multiple}
  accept="image/*,video/*,audio/*,application/pdf,application/zip"
  onchange={onChange}
/>

<style>
  @media (max-width: 639px) {
    .dropzone-compact {
      min-height: 88px;
      flex-direction: row;
      justify-content: center;
      gap: 16px;
      padding: 12px 16px;
    }
    .dropzone-compact > svg {
      flex-shrink: 0;
      margin: 0;
    }
    .dropzone-compact .dropzone-content {
      flex: 1;
      align-items: stretch;
    }
    .dropzone-compact .dropzone-content > span {
      margin-top: 4px;
    }
    .dropzone-compact .dropzone-content > span:first-child {
      margin-top: 0;
    }
  }
</style>
