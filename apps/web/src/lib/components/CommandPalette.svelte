<!-- apps/web/src/lib/components/CommandPalette.svelte -->
<script lang="ts">
  import { modal } from "$lib/actions/modal";
  import { copyText } from "$lib/utils/clipboard";
  import type { File } from "@echo-link/db";
  import {
    theme,
    ACCENTS,
    THEMES,
    type Accent,
    type Theme,
  } from "$lib/stores/theme.svelte";
  import { toast } from "$lib/stores/toast.svelte";

  type Action = {
    id: string;
    label: string;
    badge?: string;
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
  let {
    open = $bindable(),
    onClose,
    files,
    onUpload,
    onCopyLast,
    onSignOut,
  }: Props = $props();

  let query = $state("");
  let fallbackLink = $state("");
  let activeIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (open) {
      query = "";
      fallbackLink = "";
      activeIndex = 0;
      queueMicrotask(() => inputEl?.focus());
    }
  });

  async function copyShare(file: File) {
    const url = `${window.location.origin}/v/${file.slug ?? file.id}`;
    if (await copyText(url)) {
      toast.flash(`Link copied - ${file.title ?? "file"}`);
      onClose();
    } else {
      fallbackLink = url;
    }
  }

  $effect(() => {
    void query;
    activeIndex = 0;
  });

  const actionGroup = $derived<Action[]>([
    {
      id: "upload",
      label: "Upload files",
      shortcut: "O",
      onSelect: () => {
        onUpload();
        onClose();
      },
    },
    {
      id: "copy-last",
      label: "Copy latest link",
      shortcut: "C",
      onSelect: () => {
        onCopyLast();
        onClose();
      },
    },
  ]);

  const fileMatches = $derived(
    query.length === 0
      ? []
      : files
          .filter((f) =>
            (f.title ?? f.s3Key).toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 5),
  );

  const appearanceGroup = $derived<Action[]>([
    {
      id: "theme-cycle",
      label: "Switch theme",
      badge: `current: ${theme.current}`,
      shortcut: "T",
      onSelect: () => {
        theme.cycle();
      },
    },
  ]);

  const accountGroup = $derived<Action[]>([
    {
      id: "sign-out",
      label: "Sign out",
      onSelect: () => {
        onSignOut();
      },
    },
  ]);

  const accentSwatches: Record<Accent, string> = {
    blue: "var(--color-blue)",
    teal: "var(--color-teal)",
    amber: "var(--color-yellow)",
    rose: "var(--color-red)",
  };

  const themeSwatches: Record<Theme, string> = {
    light: "#f3f4f0",
    dark: "#131316",
  };

  type Row = { type: "action"; data: Action } | { type: "file"; data: File };
  const flatRows = $derived<Row[]>([
    ...actionGroup.map((a) => ({ type: "action" as const, data: a })),
    ...fileMatches.map((f) => ({ type: "file" as const, data: f })),
    ...appearanceGroup.map((a) => ({ type: "action" as const, data: a })),
    ...accountGroup.map((a) => ({ type: "action" as const, data: a })),
  ]);

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const rowButton = target.closest<HTMLButtonElement>(
      "button[data-command-row]",
    );
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (target !== inputEl && !rowButton) return;
      e.preventDefault();
      const current = rowButton ? Number(rowButton.dataset.commandRow) : -1;
      activeIndex =
        current === -1
          ? e.key === "ArrowDown"
            ? 0
            : flatRows.length - 1
          : Math.max(
              0,
              Math.min(
                flatRows.length - 1,
                current + (e.key === "ArrowDown" ? 1 : -1),
              ),
            );
      inputEl
        ?.closest("dialog")
        ?.querySelector<HTMLButtonElement>(
          `[data-command-row="${activeIndex}"]`,
        )
        ?.focus();
    } else if (e.key === "Enter" && target === inputEl) {
      e.preventDefault();
      const row = flatRows[activeIndex];
      if (!row) return;
      if (row.type === "file") void copyShare(row.data);
      else void row.data.onSelect();
    }
  }
</script>

{#if open}
  <dialog
    use:modal={onClose}
    onkeydown={onKey}
    oncancel={(event) => {
      event.preventDefault();
      onClose();
    }}
    aria-label="Commands and account settings"
    class="cp-modal m-auto max-h-[calc(100dvh-32px)] w-[600px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-surface1 bg-mantle p-0 text-text"
  >
    <div class="flex items-center gap-3 border-b border-surface0 px-5 py-4">
      <input
        bind:this={inputEl}
        bind:value={query}
        aria-label="Search files or commands"
        placeholder="Search files, run commands…"
        class="min-w-0 flex-1 bg-transparent font-sans text-base text-text placeholder:text-overlay1 caret-accent focus:outline-none"
      />
      <button
        type="button"
        aria-label="Close commands"
        onclick={onClose}
        class="ui-button min-h-11 min-w-11 rounded border border-surface1 bg-surface0 text-sm text-subtext1"
        >Close</button
      >
    </div>

    {#if fallbackLink}
      <div class="border-b border-surface0 px-5 py-3">
        <p role="status" class="mb-2 text-sm text-subtext1">
          Copy unavailable. Select and copy this link:
        </p>
        <input
          aria-label="Share link"
          readonly
          value={fallbackLink}
          onclick={(event) => event.currentTarget.select()}
          class="min-h-11 w-full min-w-0 rounded border border-surface1 bg-surface0 px-3 text-base text-text"
        />
      </div>
    {/if}
    <div class="command-list max-h-[420px] overflow-y-auto py-2">
      {#if actionGroup.length}
        <div
          class="px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-overlay0"
        >
          actions
        </div>
        {#each actionGroup as a, i}
          <button
            type="button"
            class="ui-button grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex ===
            i
              ? 'bg-accent/10'
              : ''}"
            data-command-row={i}
            onfocus={() => (activeIndex = i)}
            onclick={() => a.onSelect()}
          >
            <span class="text-subtext1"
              >{a.label}
              {#if a.badge}<span
                  class="ml-2 font-mono text-[10px] text-overlay0"
                  >{a.badge}</span
                >{/if}</span
            >
            {#if a.shortcut}<span
                class="hidden font-mono text-[10px] text-overlay1 sm:inline"
                >{a.shortcut}</span
              >{/if}
          </button>
        {/each}
      {/if}

      {#if fileMatches.length}
        <div
          class="px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-overlay0"
        >
          files matching "{query}"
        </div>
        {#each fileMatches as f, i}
          {@const idx = actionGroup.length + i}
          <button
            type="button"
            class="ui-button grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex ===
            idx
              ? 'bg-accent/10'
              : ''}"
            data-command-row={idx}
            onfocus={() => (activeIndex = idx)}
            onclick={() => copyShare(f)}
          >
            <span class="truncate text-subtext1">{f.title ?? f.s3Key}</span>
            <span class="hidden font-mono text-[10px] text-overlay1 sm:inline"
              >↩</span
            >
          </button>
        {/each}
      {/if}

      <div
        class="px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-overlay0"
      >
        appearance
      </div>
      {#each appearanceGroup as a, i}
        {@const idx = actionGroup.length + fileMatches.length + i}
        <button
          type="button"
          class="ui-button grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex ===
          idx
            ? 'bg-accent/10'
            : ''}"
          data-command-row={idx}
          onfocus={() => (activeIndex = idx)}
          onclick={() => a.onSelect()}
        >
          <span class="text-subtext1"
            >{a.label}
            {#if a.badge}<span class="ml-2 font-mono text-[10px] text-overlay0"
                >{a.badge}</span
              >{/if}</span
          >
          {#if a.shortcut}<span
              class="hidden font-mono text-[10px] text-overlay1 sm:inline"
              >{a.shortcut}</span
            >{/if}
        </button>
      {/each}

      <div class="space-y-4 px-5 py-4">
        <div role="group" aria-label="Theme">
          <p class="mb-2 text-sm text-subtext1">Theme</p>
          <div class="flex flex-wrap gap-2">
            {#each THEMES as t}
              <button
                type="button"
                onclick={() => theme.setTheme(t)}
                aria-pressed={theme.current === t}
                class="ui-button inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm {theme.current ===
                t
                  ? 'border-accent bg-surface0 text-text'
                  : 'border-surface1 text-subtext1'}"
              >
                <span
                  aria-hidden="true"
                  class="h-4 w-4 rounded-sm border border-surface1"
                  style:background-color={themeSwatches[t]}
                ></span>
                {t === "light" ? "Light" : "Dark"}
              </button>
            {/each}
          </div>
        </div>
        <div role="group" aria-label="Accent color">
          <p class="mb-2 text-sm text-subtext1">Accent color</p>
          <div class="flex flex-wrap gap-2">
            {#each ACCENTS as a}
              <button
                type="button"
                onclick={() => theme.setAccent(a)}
                aria-pressed={theme.accent === a}
                class="ui-button inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm {theme.accent ===
                a
                  ? 'border-accent bg-surface0 text-text'
                  : 'border-surface1 text-subtext1'}"
              >
                <span
                  aria-hidden="true"
                  class="h-3 w-3 rounded-full"
                  style:background-color={accentSwatches[a]}
                ></span>
                <span class="capitalize">{a}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if accountGroup.length}
        <div
          class="px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-overlay0"
        >
          account
        </div>
        {#each accountGroup as a, i}
          {@const idx =
            actionGroup.length +
            fileMatches.length +
            appearanceGroup.length +
            i}
          <button
            type="button"
            class="ui-button grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors {activeIndex ===
            idx
              ? 'bg-accent/10'
              : ''}"
            data-command-row={idx}
            onfocus={() => (activeIndex = idx)}
            onclick={() => a.onSelect()}
          >
            <span class="text-subtext1">{a.label}</span>
          </button>
        {/each}
      {/if}
    </div>

    <div
      class="hidden justify-between border-t border-surface0 px-5 py-2.5 font-mono text-[10px] text-overlay1 sm:flex"
    >
      <span>↑ ↓ navigate</span>
      <span>↩ select &nbsp; esc close</span>
    </div>
  </dialog>
{/if}

<style>
  .cp-modal::backdrop {
    background: color-mix(in srgb, var(--color-crust) 80%, transparent);
  }
  @media (max-width: 639px) {
    .cp-modal {
      width: calc(100% - 16px);
      max-width: calc(100% - 16px);
      max-height: calc(100dvh - 16px);
    }
    .cp-modal > div:first-child {
      padding: 12px 16px;
      gap: 8px;
    }
    .command-list {
      max-height: calc(100dvh - 96px);
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }
    .command-list > button {
      min-height: 48px;
      padding-left: 16px;
      padding-right: 16px;
    }
  }
</style>
