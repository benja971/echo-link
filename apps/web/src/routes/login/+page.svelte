<!-- apps/web/src/routes/login/+page.svelte -->
<script lang="ts">
  import Brand from "$components/Brand.svelte";
  import { page } from "$app/state";
  import { readErrorCode } from "$lib/utils/errors";

  let email = $state("");
  let sent = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  // The PWA share-target endpoint redirects here with ?from=share when the
  // user invokes "Share to Echo-link" without an active session. We can't
  // resume the share automatically (file isn't stashable cross-redirect),
  // so just explain why they're here.
  const fromShare = $derived(page.url.searchParams.get("from") === "share");

  const tokenError = $derived(page.url.searchParams.get("error"));

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    error = null;
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const code = await readErrorCode(res);
        error =
          code === "invalid email" || code === "invalid_email"
            ? "Enter a valid email address."
            : code === "mail_unavailable"
              ? "Email is temporarily unavailable. Please try again."
              : res.status === 429
                ? "Too many requests. Wait a moment and try again."
                : "Could not request a sign-in link. Please try again.";
        return;
      }
      sent = true;
    } catch {
      error = "Cannot connect. Check your connection and try again.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>echo·link · sign in</title></svelte:head>

<main
  id="main-content"
  class="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-12 sm:px-8"
>
  <a
    href="/"
    class="ui-brand mb-10 inline-flex min-h-11 items-center self-start"
    ><Brand size="md" /></a
  >
  <h1 class="text-3xl font-medium tracking-tight">Sign in</h1>
  <p class="mt-3 mb-8 text-subtext0">
    Get a sign-in link by email. No password needed.
  </p>
  {#if fromShare && !sent}
    <p class="mb-6 text-sm text-subtext1">
      Sign in to share files from your device. Then share the file again from
      your gallery.
    </p>
  {/if}
  {#if tokenError && !sent}
    <p role="alert" class="mb-6 text-sm text-red">
      {tokenError === "missing_token"
        ? "This sign-in link is incomplete. Request a new one below."
        : "This sign-in link is invalid or expired. Request a new one below."}
    </p>
  {/if}
  <div role="status" aria-live="polite" aria-atomic="true">
    {#if sent}
      <h2 class="text-xl font-medium">Check your inbox</h2>
      <p class="mt-3 text-subtext1">
        Sign-in link requested for <span class="break-all text-text"
          >{email}</span
        >. If it does not arrive, check your spam folder or try again.
      </p>
    {:else if busy}
      <p class="sr-only">Requesting your sign-in link.</p>
    {/if}
  </div>
  {#if sent}
    <form onsubmit={submit} class="mt-6 space-y-3" aria-busy={busy}>
      <button
        type="submit"
        disabled={busy}
        class="ui-button ui-button-primary min-h-11 w-full rounded-md bg-accent px-4 py-3 font-medium text-on-accent disabled:opacity-60"
        >{busy ? "Requesting link…" : "Request another link"}</button
      >
      <button
        type="button"
        disabled={busy}
        onclick={() => {
          sent = false;
          error = null;
        }}
        class="ui-button min-h-11 w-full rounded-md border border-surface1 px-4 py-3 text-subtext1"
        >Use a different email</button
      >
    </form>
  {:else}
    <form onsubmit={submit} class="space-y-3" aria-busy={busy}>
      <label for="email" class="block text-sm font-medium">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        required
        bind:value={email}
        disabled={busy}
        placeholder="you@example.com"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "login-error" : undefined}
        class="min-h-11 w-full rounded-md border border-surface1 bg-mantle px-4 py-3 text-base text-text placeholder:text-subtext0 focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy}
        class="ui-button ui-button-primary min-h-11 w-full rounded-md bg-accent px-4 py-3 font-medium text-on-accent disabled:opacity-60"
        >{busy ? "Requesting link…" : "Send sign-in link"}</button
      >
    </form>
  {/if}
  <div role="alert" aria-atomic="true">
    {#if error}<p id="login-error" class="mt-4 text-sm text-red">
        {error}
      </p>{/if}
  </div>
  <a
    href="/"
    class="mt-8 inline-flex min-h-11 items-center self-start text-sm text-subtext0 hover:text-text"
    >Back to upload</a
  >
</main>
