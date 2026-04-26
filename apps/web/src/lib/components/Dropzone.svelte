<!-- apps/web/src/lib/components/Dropzone.svelte -->
<script lang="ts">
  import { formatShortcut } from '$lib/utils/platform';

  type Props = {
    onFiles: (files: File[]) => void;
    busy?: boolean;
    title?: string;
    sub?: string;
    anonTag?: string;
    /** Allow selecting multiple files at once via the picker. */
    multiple?: boolean;
  };
  const defaultSub = $derived(
    `${formatShortcut('V', { mod: true })} to paste · drop anywhere · O to pick`
  );
  let {
    onFiles,
    busy = false,
    title = 'drop · paste · pick',
    sub,
    anonTag,
    multiple = true
  }: Props = $props();
  const subText = $derived(sub ?? defaultSub);

  let input: HTMLInputElement;

  function pick() {
    input.click();
  }

  function onChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    if (files.length > 0) onFiles(files);
    target.value = '';
  }
</script>

<button
  type="button"
  data-pick-trigger
  onclick={pick}
  disabled={busy}
  class="group relative block w-full cursor-pointer rounded-xl border border-dashed border-surface1 bg-mantle px-8 py-12 text-center transition-colors duration-150 [transition-timing-function:var(--ease-out-expo)] hover:border-accent hover:bg-base focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
>
  <div class="font-mono text-3xl text-accent transition-transform duration-150 group-hover:scale-105">[ + ]</div>
  <div class="mt-3 font-mono text-base text-text">{title}</div>
  <div class="mt-1 font-mono text-xs text-overlay1">{subText}</div>
  {#if anonTag}
    <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow/20 bg-yellow/8 px-3 py-1 font-mono text-[10px] tracking-wider text-yellow">
      <span class="grid h-3 w-3 place-items-center rounded-full bg-yellow text-[9px] font-bold text-crust">!</span>
      {anonTag}
    </div>
  {/if}
</button>

<input
  bind:this={input}
  type="file"
  hidden
  {multiple}
  accept="image/*,video/*,audio/*,application/pdf,application/zip"
  onchange={onChange}
/>
