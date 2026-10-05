<script lang="ts">
  import { modal } from "$lib/actions/modal";
  import { formatShortcut } from "$lib/utils/platform";

  type Props = {
    open: boolean;
    onClose: () => void;
  };
  let { open = $bindable(), onClose }: Props = $props();

  // Each shortcut row may have one OR multiple key combos (e.g. ⌘1/⌘2/⌘3).
  // A "combo" is an array of token strings (the kbds inside it are joined
  // with no separator, like "Ctrl+K" → ["Ctrl+K"], or "g i" → ["g", "i"]
  // for vim-style sequences).
  type Combo = string[];
  type Group = { title: string; rows: { combos: Combo[]; label: string }[] };

  const groups = $derived<Group[]>([
    {
      title: "general",
      rows: [
        {
          combos: [[formatShortcut("K", { mod: true })]],
          label: "open the command palette",
        },
        { combos: [["?"]], label: "show this cheatsheet" },
        { combos: [["Esc"]], label: "close any open modal or overlay" },
      ],
    },
    {
      title: "workspace",
      rows: [
        { combos: [["O"]], label: "open the file picker" },
        { combos: [["T"]], label: "Switch between light and dark theme" },
        { combos: [["C"]], label: "copy the most recent file link" },
        { combos: [["1"], ["2"], ["3"]], label: "copy your recent file links" },
        {
          combos: [["drop"]],
          label: "drop a file anywhere on the page to upload",
        },
        {
          combos: [[formatShortcut("V", { mod: true })]],
          label: "paste an image (screenshots upload directly)",
        },
      ],
    },
    {
      title: "all-files grid",
      rows: [
        { combos: [["J"], ["↓"]], label: "focus next file" },
        { combos: [["K"], ["↑"]], label: "focus previous file" },
        { combos: [["↩"]], label: "open the focused file in the preview" },
        {
          combos: [["E"]],
          label: "edit the focused file (rename, set custom URL)",
        },
        { combos: [["space"]], label: "mark / unmark the focused file" },
        { combos: [["A"]], label: "mark all files" },
        {
          combos: [["C"]],
          label: "copy marked links (newline-joined), or last link",
        },
        {
          combos: [["D"]],
          label: "delete marked files (press twice within 3s)",
        },
        { combos: [["Esc"]], label: "clear focus + marked selection" },
      ],
    },
    {
      title: "in the palette",
      rows: [
        { combos: [["↑"], ["↓"]], label: "move selection up / down" },
        { combos: [["↩"]], label: "select the highlighted row" },
        { combos: [["Esc"]], label: "close the palette" },
      ],
    },
  ]);
</script>

{#if open}
  <dialog
    use:modal={onClose}
    oncancel={(event) => {
      event.preventDefault();
      onClose();
    }}
    aria-labelledby="shortcuts-title"
    class="shortcuts-modal m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-hidden rounded-xl border border-surface1 bg-mantle p-0 text-text"
  >
    <div
      class="flex items-center justify-between border-b border-surface0 px-5 py-3"
    >
      <h2 id="shortcuts-title" class="text-base font-medium text-text">
        Keyboard shortcuts
      </h2>
      <button
        onclick={onClose}
        type="button"
        aria-label="Close keyboard shortcuts"
        class="ui-button min-h-11 min-w-11 rounded border border-surface1 border-b-2 bg-surface0 px-2 py-0.5 font-mono text-xs text-overlay1"
      >
        esc
      </button>
    </div>

    <div class="max-h-[calc(100dvh-120px)] space-y-6 overflow-y-auto p-5">
      {#each groups as group}
        <div>
          <div
            class="mb-2 font-mono text-[10px] uppercase tracking-wider text-overlay0"
          >
            {group.title}
          </div>
          <ul class="space-y-2">
            {#each group.rows as row}
              <li
                class="grid grid-cols-1 sm:grid-cols-[auto_1fr] items-center gap-3"
              >
                <span class="flex shrink-0 flex-wrap items-center gap-1">
                  {#each row.combos as combo, i}
                    {#if i > 0}
                      <span class="font-mono text-[10px] text-overlay0">·</span>
                    {/if}
                    <span
                      class="rounded border border-surface1 border-b-2 bg-surface0 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-text"
                    >
                      {combo.join(" ")}
                    </span>
                  {/each}
                </span>
                <span class="text-sm text-subtext1">{row.label}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </dialog>
{/if}

<style>
  .shortcuts-modal::backdrop {
    background: color-mix(in srgb, var(--color-crust) 80%, transparent);
  }
</style>
