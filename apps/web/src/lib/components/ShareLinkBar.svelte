<script lang="ts">
  import { generateVariant, type CopyVariant } from '$lib/utils/shortcut-variants';
  type Props = { url: string; title: string; mime: string };
  let { url, title, mime }: Props = $props();

  // pill = compact label shown on the button. fullLabel = tooltip text.
  const variants: { id: CopyVariant; pill: string; fullLabel: string }[] = [
    { id: 'raw', pill: 'URL', fullLabel: 'copy raw URL' },
    { id: 'md', pill: 'MD', fullLabel: 'copy markdown link' },
    { id: 'html', pill: 'HTML', fullLabel: 'copy html embed' },
    { id: 'bbcode', pill: 'BB', fullLabel: 'copy bbcode' }
  ];

  // Click any pill to copy directly in that format. Pill flashes ✓ for
  // ~1.4s — no separate "select then copy" step.
  let lastCopied = $state<CopyVariant | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyAs(v: CopyVariant) {
    const text = generateVariant(v, url, title, mime);
    await navigator.clipboard.writeText(text);
    lastCopied = v;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (lastCopied = null), 1400);
  }

  const displayHost = $derived(new URL(url).host);
  const displayPath = $derived(new URL(url).pathname.split('/').pop() ?? '');
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-surface0 bg-crust px-6 py-3 font-mono text-sm">
  <button
    type="button"
    onclick={() => copyAs('raw')}
    title="click to copy the raw URL"
    class="min-w-0 flex-1 truncate text-left text-text transition-colors hover:text-accent"
  >
    <span class="text-overlay1">{displayHost}/v/</span><span class="text-accent">{displayPath}</span>
  </button>
  <div class="flex shrink-0 gap-1.5">
    {#each variants as v (v.id)}
      <button
        type="button"
        onclick={() => copyAs(v.id)}
        title={v.fullLabel}
        class="min-w-[3.25rem] rounded border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors {lastCopied === v.id
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-surface1 text-overlay1 hover:border-accent/50 hover:bg-surface0 hover:text-text'}"
      >
        {lastCopied === v.id ? '✓' : v.pill}
      </button>
    {/each}
  </div>
</div>
