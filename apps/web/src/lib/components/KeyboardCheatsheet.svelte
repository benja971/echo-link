<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { formatShortcut } from '$lib/utils/platform';

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
      title: 'general',
      rows: [
        { combos: [[formatShortcut('K', { mod: true })]], label: 'open the command palette' },
        { combos: [['?']], label: 'show this cheatsheet' },
        { combos: [['Esc']], label: 'close any open modal or overlay' }
      ]
    },
    {
      title: 'workspace',
      rows: [
        { combos: [['O']], label: 'open the file picker' },
        { combos: [['T']], label: 'cycle theme (latte → frappe → macchiato → mocha)' },
        { combos: [['1'], ['2'], ['3']], label: 'copy your recent file links' },
        {
          combos: [['drop']],
          label: 'drop a file anywhere on the page to upload'
        },
        {
          combos: [[formatShortcut('V', { mod: true })]],
          label: 'paste an image (screenshots upload directly)'
        }
      ]
    },
    {
      title: 'in the palette',
      rows: [
        { combos: [['↑'], ['↓']], label: 'move selection up / down' },
        { combos: [['↩']], label: 'select the highlighted row' },
        { combos: [['Esc']], label: 'close the palette' }
      ]
    }
  ]);

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (open && e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if open}
  <button
    type="button"
    aria-label="close cheatsheet"
    class="fixed inset-0 z-50 cursor-default bg-crust/70 backdrop-blur-md"
    onclick={onClose}
    transition:fade={{ duration: 180 }}
  ></button>

  <div
    role="dialog"
    aria-modal="true"
    class="pointer-events-none fixed inset-0 z-50 grid place-items-center p-6"
  >
    <div
      class="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-surface1 bg-mantle shadow-2xl"
      transition:scale={{ duration: 220, start: 0.96, opacity: 0 }}
    >
      <div class="flex items-center justify-between border-b border-surface0 px-5 py-3">
        <span class="font-mono text-sm text-text">keyboard shortcuts</span>
        <button
          onclick={onClose}
          class="rounded border border-surface1 border-b-2 bg-surface0 px-2 py-0.5 font-mono text-xs text-overlay1 hover:text-text"
        >
          esc
        </button>
      </div>

      <div class="max-h-[70vh] space-y-6 overflow-y-auto p-5">
        {#each groups as group}
          <div>
            <div class="mb-2 font-mono text-[10px] uppercase tracking-wider text-overlay0">
              {group.title}
            </div>
            <ul class="space-y-2">
              {#each group.rows as row}
                <li class="grid grid-cols-[auto_1fr] items-center gap-3">
                  <span class="flex shrink-0 items-center gap-1">
                    {#each row.combos as combo, i}
                      {#if i > 0}
                        <span class="font-mono text-[10px] text-overlay0">·</span>
                      {/if}
                      <span class="rounded border border-surface1 border-b-2 bg-surface0 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-text">
                        {combo.join(' ')}
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
    </div>
  </div>
{/if}
