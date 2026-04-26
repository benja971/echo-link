<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';

  type Props = {
    tips: string[];
    intervalMs?: number;
    /** Tailwind class for the wrapper. */
    class?: string;
  };
  let { tips, intervalMs = 7000, class: klass = '' }: Props = $props();

  let index = $state(0);

  onMount(() => {
    const timer = setInterval(() => {
      index = (index + 1) % tips.length;
    }, intervalMs);
    return () => clearInterval(timer);
  });

  // Render `<TOKEN>` segments as small kbd-styled badges. Use this syntax
  // in TIPS rather than relying on heuristic detection of bare letters.
  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderTip(t: string) {
    return t.replace(/<([^<>\s]+)>/g, (_, token: string) => {
      const safe = escapeHtml(token);
      return `<kbd class="font-mono rounded border border-surface1 border-b-2 bg-surface0 px-1.5 py-px text-xs text-text">${safe}</kbd>`;
    });
  }
</script>

<span class={klass}>
  {#key index}
    <span in:fade={{ duration: 400 }}>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html renderTip(tips[index] ?? '')}
    </span>
  {/key}
</span>
