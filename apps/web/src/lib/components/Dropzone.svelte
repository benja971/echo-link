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
    /** When true, the dropzone shows a strong pulsing ring + "drop here"
     *  state — used by the parent's useDropAnywhere to highlight the
     *  target without fully overlaying the page. */
    isDragging?: boolean;
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
    multiple = true,
    isDragging = false
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
  class="group relative block w-full cursor-pointer rounded-xl border border-dashed bg-mantle px-8 py-12 text-center transition-all duration-200 [transition-timing-function:var(--ease-out-expo)] focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 {isDragging
    ? 'scale-[1.02] border-accent bg-base [animation:drop-pulse_1.2s_ease-in-out_infinite]'
    : 'border-surface1 hover:border-accent hover:bg-base'}"
  style:box-shadow={isDragging
    ? '0 0 0 4px color-mix(in oklab, var(--color-accent) 18%, transparent), 0 0 64px color-mix(in oklab, var(--color-accent) 28%, transparent)'
    : ''}
>
  <div class="font-mono text-3xl text-accent transition-transform duration-150 group-hover:scale-105">[ + ]</div>
  <div class="mt-3 font-mono text-base text-text">{isDragging ? 'drop here' : title}</div>
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
