<script lang="ts">
  import { onMount } from "svelte";
  import { isMac } from "$lib/utils/platform";
  let { tips, class: klass = "" }: { tips: string[]; class?: string } =
    $props();
  let index = $state(0);
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });
  const parts = $derived((tips[index] ?? "").split(/(<[^<>\s]+>)/g));
  function label(token: string) {
    return token
      .slice(1, -1)
      .replace(/⌘/g, mounted ? (isMac() ? "⌘" : "Ctrl+") : "Ctrl / Cmd+");
  }
</script>

<div class="flex min-w-0 items-center gap-3 {klass}">
  <span class="min-w-0 flex-1 text-sm">
    {#each parts as part}
      {#if part.startsWith("<")}
        <kbd
          class="rounded border border-surface1 bg-surface0 px-1 font-mono text-xs text-text"
          >{label(part)}</kbd
        >
      {:else}
        {part}
      {/if}
    {/each}
  </span>
  <button
    type="button"
    onclick={() => (index = (index + 1) % tips.length)}
    aria-label="Show next keyboard tip"
    class="ui-button inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-surface1 px-3 text-sm"
    >Next tip</button
  >
</div>
