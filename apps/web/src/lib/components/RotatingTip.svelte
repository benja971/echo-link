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
    title="Next tip"
    class="ui-button grid h-11 w-11 shrink-0 place-items-center rounded-md border border-surface1"
  >
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg
    >
  </button>
</div>
