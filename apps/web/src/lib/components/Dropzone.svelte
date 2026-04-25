<!-- apps/web/src/lib/components/Dropzone.svelte -->
<script lang="ts">
  type Props = {
    onFile: (file: File) => void;
    busy?: boolean;
    title?: string;
    sub?: string;
    anonTag?: string;
  };
  let { onFile, busy = false, title = 'drop · paste · pick', sub = '⌘O to pick · ⌘V to paste · drop anywhere', anonTag }: Props = $props();

  let input: HTMLInputElement;

  function pick() {
    input.click();
  }

  function onChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (file) onFile(file);
    target.value = '';
  }
</script>

<button
  type="button"
  data-pick-trigger
  onclick={pick}
  disabled={busy}
  class="group relative block w-full cursor-pointer rounded-xl border border-dashed border-surface1 bg-mantle px-8 py-12 text-center transition-colors duration-150 [transition-timing-function:var(--ease-out-expo)] hover:border-mauve hover:bg-base focus-visible:border-mauve focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
>
  <div class="font-mono text-3xl text-mauve transition-transform duration-150 group-hover:scale-105">[ + ]</div>
  <div class="mt-3 font-mono text-base text-text">{title}</div>
  <div class="mt-1 font-mono text-xs text-overlay1">{sub}</div>
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
  accept="image/*,video/*,audio/*,application/pdf,application/zip"
  onchange={onChange}
/>
