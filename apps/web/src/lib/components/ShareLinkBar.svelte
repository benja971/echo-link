<script lang="ts">
  import { generateVariant, type CopyVariant } from '$lib/utils/shortcut-variants';
  type Props = { url: string; title: string; mime: string };
  let { url, title, mime }: Props = $props();
  let active = $state<CopyVariant>('raw');

  async function copy() {
    const text = generateVariant(active, url, title, mime);
    await navigator.clipboard.writeText(text);
  }

  const variants: CopyVariant[] = ['raw', 'md', 'html', 'bbcode'];
</script>

<div class="flex items-center gap-4 border-t border-surface0 bg-crust px-6 py-4 font-mono text-sm">
  <button onclick={copy} class="flex-1 text-left text-text hover:text-mauve">
    <span class="text-overlay1">{new URL(url).host}/v/</span><span class="text-mauve">{new URL(url).pathname.split('/').pop()}</span>
  </button>
  <div class="flex gap-1 text-overlay1">
    {#each variants as v}
      <button
        onclick={() => (active = v)}
        class="rounded border border-surface1 px-2 py-0.5 text-[10px] uppercase tracking-wide transition-colors {active === v ? 'border-mauve bg-surface0 text-mauve' : ''}"
      >
        {v}
      </button>
    {/each}
  </div>
</div>
