<script lang="ts">
  import {
    generateVariant,
    type CopyVariant,
  } from "$lib/utils/shortcut-variants";
  import { onMount } from "svelte";
  import { copyText } from "$lib/utils/clipboard";
  type Props = { url: string; fileUrl: string; title: string; mime: string };
  let { url, fileUrl, title, mime }: Props = $props();
  let active = $state<CopyVariant>("raw");
  let feedback = $state("");
  const variants: CopyVariant[] = ["md", "html", "bbcode"];
  let formatsOpen = $state(false);

  onMount(() => {
    const desktop = window.matchMedia("(min-width: 640px)");
    const sync = () => (formatsOpen = desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  });
  const labels = {
    raw: "Link",
    md: "Markdown",
    html: "HTML",
    bbcode: "BBCode",
  };
  const text = $derived(generateVariant(active, url, title, mime, fileUrl));

  async function copy() {
    feedback = (await copyText(text))
      ? "Copied to clipboard."
      : "Copy unavailable. Select the text above and copy it manually.";
  }
</script>

<div class="share-bar border-t border-surface0 bg-crust px-4 py-5 sm:px-6">
  <div class="share-field flex gap-2">
    <input
      aria-label="Share link in selected format"
      readonly
      value={text}
      onclick={(event) => event.currentTarget.select()}
      class="min-h-11 min-w-0 flex-1 rounded-md border border-surface1 bg-mantle px-3 py-2 font-mono text-base text-text"
    />
    <button
      type="button"
      onclick={copy}
      aria-label={`Copy ${labels[active].toLowerCase()}`}
      class="ui-button ui-button-primary min-h-11 shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent"
      ><span class="sm:hidden">Copy</span><span class="hidden sm:inline"
        >Copy {labels[active].toLowerCase()}</span
      ></button
    >
  </div>
  <div class="format-options" role="group" aria-label="Link format">
    <button
      type="button"
      onclick={() => {
        active = "raw";
        feedback = "";
      }}
      aria-pressed={active === "raw"}
      class="ui-button min-h-11 rounded-md border px-3 text-sm {active === 'raw'
        ? 'border-accent bg-surface0 text-accent'
        : 'border-surface1 text-subtext1'}">Link</button
    >
    {#if active !== "raw"}
      <span class="selected-format text-xs text-subtext1"
        >{labels[active]} selected</span
      >
    {/if}
    <details class="more-formats" bind:open={formatsOpen}>
      <summary class="min-h-11 cursor-pointer text-sm text-subtext1">
        More formats
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"><path d="m6 9 6 6 6-6" /></svg
        >
      </summary>
      <div
        class="flex flex-wrap gap-2"
        role="group"
        aria-label="More link formats"
      >
        {#each variants as v}
          <button
            type="button"
            onclick={() => {
              active = v;
              feedback = "";
            }}
            aria-pressed={active === v}
            class="ui-button min-h-11 rounded-md border px-3 text-sm {active ===
            v
              ? 'border-accent bg-surface0 text-accent'
              : 'border-surface1 text-subtext1'}">{labels[v]}</button
          >
        {/each}
      </div>
    </details>
  </div>
  <p
    role="status"
    aria-live="polite"
    class="text-sm text-subtext1"
    hidden={!feedback}
  >
    {feedback}
  </p>
</div>

<style>
  .share-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .format-options {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .more-formats {
    order: 3;
    width: 100%;
  }
  .more-formats summary {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .more-formats[open] summary svg {
    transform: rotate(180deg);
  }
  .more-formats[open] > div {
    padding-top: 4px;
  }
  @media (min-width: 640px) {
    .format-options {
      order: 0;
    }
    .share-field {
      order: 1;
    }
    .share-bar > p {
      order: 2;
    }
    .more-formats {
      display: contents;
    }
    .more-formats summary,
    .selected-format {
      display: none;
    }
    .more-formats[open] > div {
      padding-top: 0;
    }
  }
  @media (max-width: 639px) {
    .share-bar {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 0 0;
      background: transparent;
    }
    .share-bar > :global(*) {
      margin: 0;
    }
    .share-field {
      order: 0;
    }
    .format-options {
      order: 1;
    }
    .share-bar > p {
      order: 2;
    }
    .more-formats {
      order: 0;
      width: auto;
      margin-left: auto;
    }
    .more-formats[open] {
      width: 100%;
    }
    .selected-format {
      font-size: 12px;
    }
  }
</style>
