<!-- apps/web/src/lib/components/CommandPalette.svelte -->
<script lang="ts">
  import type { File } from '@echo-link/db';
  import { theme, ACCENTS, THEMES, type Accent, type Theme } from '$lib/stores/theme.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  type Action = {
    id: string;
    label: string;
    badge?: string;
    icon?: string;
    shortcut?: string;
    onSelect: () => void | Promise<void>;
  };

  type Props = {
    open: boolean;
    onClose: () => void;
    files: File[];
    onUpload: () => void;
    onCopyLast: () => void;
    onSignOut: () => void;
  };
  let { open = $bindable(), onClose, files, onUpload, onCopyLast, onSignOut }: Props = $props();

  let query = $state('');
  let activeIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (open) {
      query = '';
      activeIndex = 0;
      queueMicrotask(() => inputEl?.focus());
    }
  });

  function copyShare(file: File) {
    navigator.clipboard.writeText(`${window.location.origin}/v/${file.id}`);
    toast.flash(`✓ link copied — ${file.title ?? 'file'}`);
    onClose();
  }

  const actionGroup = $derived<Action[]>([
    { id: 'upload', label: 'upload a file', badge: 'drop · paste · pick', icon: '↑', shortcut: 'O', onSelect: () => { onUpload(); onClose(); } },
    { id: 'copy-last', label: 'copy last link', icon: '⎘', shortcut: 'C', onSelect: () => { onCopyLast(); onClose(); } }
  ]);

  const fileMatches = $derived(
    query.length === 0
      ? []
      : files
          .filter((f) => (f.title ?? f.s3Key).toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
  );

  const appearanceGroup = $derived<Action[]>([
    {
      id: 'theme-cycle',
      label: 'cycle theme',
      badge: `current: ${theme.current}`,
      icon: '◐',
      shortcut: 'T',
      onSelect: () => { theme.cycle(); }
    }
  ]);

  const accountGroup = $derived<Action[]>([
    { id: 'sign-out', label: 'sign out', icon: '⊘', onSelect: () => { onSignOut(); } }
  ]);

  // Visual swatch hex per accent (mocha values — other flavors look similar but slightly different)
  const accentSwatches: Record<Accent, string> = {
    mauve: '#cba6f7',
    peach: '#fab387',
    sky: '#89dceb',
    teal: '#94e2d5',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    lavender: '#b4befe',
    red: '#f38ba8',
    pink: '#f5c2e7',
    blue: '#89b4fa'
  };

  // Each theme's `base` color, used as the swatch
  const themeSwatches: Record<Theme, string> = {
    latte: '#eff1f5',
    frappe: '#303446',
    macchiato: '#24273a',
    mocha: '#1e1e2e'
  };

  type Row = { type: 'action'; data: Action } | { type: 'file'; data: File };
  const flatRows = $derived<Row[]>([
    ...actionGroup.map((a) => ({ type: 'action' as const, data: a })),
    ...fileMatches.map((f) => ({ type: 'file' as const, data: f })),
    ...appearanceGroup.map((a) => ({ type: 'action' as const, data: a })),
    ...accountGroup.map((a) => ({ type: 'action' as const, data: a }))
  ]);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(flatRows.length - 1, activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = flatRows[activeIndex];
      if (!row) return;
      if (row.type === 'file') copyShare(row.data);
      else row.data.onSelect();
    }
  }
</script>

{#if open}
  <button
    type="button"
    aria-label="close command palette"
    class="fixed inset-0 z-40 cursor-default bg-crust/70 backdrop-blur-md"
    onclick={onClose}
  ></button>

  <div
    role="dialog"
    aria-modal="true"
    class="cp-modal fixed inset-x-0 top-24 z-50 mx-auto w-[600px] max-w-[calc(100%-32px)] origin-top overflow-hidden rounded-xl border border-surface1 bg-mantle"
    style="animation: cp-pop 0.32s var(--ease-out-expo);"
  >
    <div class="flex items-center gap-3 border-b border-surface0 px-5 py-4">
      <span class="font-mono text-base text-accent">›</span>
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={onKey}
        placeholder="search files, run commands…"
        class="flex-1 bg-transparent font-sans text-base text-text placeholder:text-overlay1 caret-accent focus:outline-none"
      />
      <span class="rounded border border-surface1 border-b-2 bg-surface0 px-1.5 py-0.5 font-mono text-[10px] text-overlay1">esc</span>
    </div>

    <div class="max-h-[420px] overflow-y-auto py-2">
      {#if actionGroup.length}
        <div class="px-5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-overlay0">actions</div>
        {#each actionGroup as a, i}
          <button
            type="button"
            class="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex === i ? 'bg-accent/10' : ''}"
            onclick={() => a.onSelect()}
          >
            <span class="font-mono text-overlay1">{a.icon}</span>
            <span class="text-subtext1">{a.label} {#if a.badge}<span class="ml-2 font-mono text-[10px] text-overlay0">{a.badge}</span>{/if}</span>
            {#if a.shortcut}<span class="font-mono text-[10px] text-overlay1">{a.shortcut}</span>{/if}
          </button>
        {/each}
      {/if}

      {#if fileMatches.length}
        <div class="px-5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-overlay0">files matching "{query}"</div>
        {#each fileMatches as f, i}
          {@const idx = actionGroup.length + i}
          <button
            type="button"
            class="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex === idx ? 'bg-accent/10' : ''}"
            onclick={() => copyShare(f)}
          >
            <span class="font-mono text-peach">{f.mimeType.startsWith('video/') ? '▶' : f.mimeType.startsWith('image/') ? '▢' : '○'}</span>
            <span class="truncate text-subtext1">{f.title ?? f.s3Key}</span>
            <span class="font-mono text-[10px] text-overlay1">↩</span>
          </button>
        {/each}
      {/if}

      <div class="px-5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-overlay0">appearance</div>
      {#each appearanceGroup as a, i}
        {@const idx = actionGroup.length + fileMatches.length + i}
        <button
          type="button"
          class="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex === idx ? 'bg-accent/10' : ''}"
          onclick={() => a.onSelect()}
        >
          <span class="font-mono text-overlay1">{a.icon}</span>
          <span class="text-subtext1">{a.label} {#if a.badge}<span class="ml-2 font-mono text-[10px] text-overlay0">{a.badge}</span>{/if}</span>
          {#if a.shortcut}<span class="font-mono text-[10px] text-overlay1">{a.shortcut}</span>{/if}
        </button>
      {/each}

      <!-- Theme + accent swatch pickers (click-only, not in keyboard flow) -->
      <div class="grid grid-cols-[24px_1fr] items-start gap-3 px-5 py-2.5 text-sm">
        <span class="pt-1.5 font-mono text-overlay1">◐</span>
        <div>
          <div class="mb-1.5 text-subtext1">flavor <span class="ml-2 font-mono text-[10px] text-overlay0">latte · frappe · macchiato · mocha</span></div>
          <div class="flex flex-wrap gap-1.5">
            {#each THEMES as t}
              <button
                type="button"
                onclick={() => theme.setTheme(t)}
                title={t}
                aria-label={`set theme to ${t}`}
                aria-pressed={theme.current === t}
                class="group relative h-6 w-6 rounded-md border-2 transition-all hover:scale-110 {theme.current === t ? 'border-text scale-110' : 'border-surface0'}"
                style:background-color={themeSwatches[t]}
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-[24px_1fr] items-start gap-3 px-5 py-2.5 text-sm">
        <span class="pt-1.5 font-mono text-overlay1">●</span>
        <div>
          <div class="mb-1.5 text-subtext1">accent <span class="ml-2 font-mono text-[10px] text-overlay0">click to switch · saved locally</span></div>
          <div class="flex flex-wrap gap-1.5">
            {#each ACCENTS as a}
              <button
                type="button"
                onclick={() => theme.setAccent(a)}
                title={a}
                aria-label={`set accent to ${a}`}
                aria-pressed={theme.accent === a}
                class="group relative h-6 w-6 rounded-full border-2 transition-all hover:scale-110 {theme.accent === a ? 'border-text scale-110' : 'border-surface0'}"
                style:background-color={accentSwatches[a]}
              ></button>
            {/each}
          </div>
        </div>
      </div>

      {#if accountGroup.length}
        <div class="px-5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-overlay0">account</div>
        {#each accountGroup as a, i}
          {@const idx = actionGroup.length + fileMatches.length + appearanceGroup.length + i}
          <button
            type="button"
            class="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex === idx ? 'bg-accent/10' : ''}"
            onclick={() => a.onSelect()}
          >
            <span class="font-mono text-overlay1">{a.icon}</span>
            <span class="text-subtext1">{a.label}</span>
          </button>
        {/each}
      {/if}
    </div>

    <div class="flex justify-between border-t border-surface0 px-5 py-2.5 font-mono text-[10px] text-overlay1">
      <span>↑ ↓ navigate</span>
      <span>↩ select &nbsp; esc close</span>
    </div>
  </div>
{/if}

<style>
  @keyframes cp-pop {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }
  .cp-modal {
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--color-accent) 16%, transparent),
      0 24px 64px rgba(0, 0, 0, 0.6),
      0 0 80px color-mix(in oklab, var(--color-accent) 10%, transparent);
  }
</style>
