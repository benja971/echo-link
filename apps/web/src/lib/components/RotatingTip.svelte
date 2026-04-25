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

  // Render `⌘X` / `⌘N` / `⇧` segments as small kbd-styled badges.
  function renderTip(t: string) {
    return t.replace(
      /(⌘[A-Z0-9]|⌘V|⌘O|⌘K|⌘T|⌘1|⌘2|⌘3|⇧|↩|esc)/g,
      '<kbd class="font-mono rounded border border-surface1 border-b-2 bg-surface0 px-1.5 py-px text-xs text-text">$1</kbd>'
    );
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
