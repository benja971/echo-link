<!-- apps/web/src/routes/login/+page.svelte -->
<script lang="ts">
  import Brand from '$components/Brand.svelte';
  import { uploadErrorMessage, readErrorCode } from '$lib/utils/errors';

  let email = $state('');
  let sent = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        error = uploadErrorMessage(await readErrorCode(res));
        return;
      }
      sent = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'network error — try again';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>echo·link · sign in</title></svelte:head>

<div class="grid min-h-screen place-items-center px-6">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center"><Brand size="md" /></div>
    {#if sent}
      <div class="rounded-md border border-accent/30 bg-accent/5 p-6 text-center font-mono text-sm">
        <div class="text-accent">→ check your inbox</div>
        <div class="mt-2 text-subtext1">we sent a sign-in link to <span class="text-text">{email}</span></div>
      </div>
    {:else}
      <form onsubmit={submit} class="space-y-3">
        <input
          type="email"
          required
          bind:value={email}
          placeholder="you@somewhere.com"
          class="w-full rounded-md border border-surface1 bg-mantle px-4 py-3 font-mono text-sm text-text placeholder:text-overlay1 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          class="w-full rounded-md bg-accent px-4 py-3 font-mono text-sm font-medium text-crust transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? '…' : 'send magic link →'}
        </button>
        {#if error}
          <div class="rounded-md border border-red/30 bg-red/5 p-3 font-mono text-xs text-red">{error}</div>
        {/if}
      </form>
    {/if}
  </div>
</div>
