<script lang="ts">
  import Brand from '$components/Brand.svelte';
</script>

<svelte:head>
  <title>echo·link · privacy</title>
  <meta name="description" content="echo·link is a personal CDN. Here's what it does and doesn't do with your data." />
</svelte:head>

<header class="flex items-center justify-between border-b border-surface0 px-7 py-4">
  <a href="/" class="hover:opacity-80">
    <Brand />
  </a>
  <a href="/" class="font-mono text-xs text-subtext0 hover:text-accent">← back</a>
</header>

<main class="mx-auto max-w-2xl px-8 py-16 font-sans text-subtext1">
  <p class="mb-3 font-mono text-[11px] uppercase tracking-wider text-accent">
    → privacy
  </p>
  <h1 class="mb-10 text-4xl font-medium tracking-tight text-text">
    your stuff is your stuff.
  </h1>

  <section class="space-y-6 leading-relaxed">
    <p>
      echo·link is self-hosted, indie, and ad-free. there are no third-party trackers, no analytics
      pixels, no telemetry of any kind on this site. nothing leaks to anywhere.
    </p>

    <h2 class="mt-10 text-xl font-medium tracking-tight text-text">what we store</h2>
    <p>
      when you upload a file, we store the file itself in our object storage (S3-compatible,
      self-hosted), plus a database row with: a UUID, the file's MIME type and size, a generated
      title, an expiry timestamp, and — depending on whether you're logged in — your account ID
      <em>or</em> a salted hash of your IP (for anonymous rate-limiting only). we do not store the
      raw IP address.
    </p>
    <p>
      when you sign in, we store your email, the magic-link tokens we issue, and a long-lived
      session cookie scoped to this domain. nothing about your magic-link request leaves our
      mail server.
    </p>

    <h2 class="mt-10 text-xl font-medium tracking-tight text-text">what we don't store</h2>
    <ul class="ml-5 list-disc space-y-1.5 marker:text-accent">
      <li>your raw IP address (only a salted hash, only for anonymous uploads)</li>
      <li>browser fingerprint, device info, location</li>
      <li>any third-party cookies</li>
      <li>any analytics or tracking events</li>
    </ul>

    <h2 class="mt-10 text-xl font-medium tracking-tight text-text">expiration</h2>
    <p>
      anonymous uploads expire after 24 hours, hard. authenticated uploads expire after the
      configured window (10 days by default). expired files are deleted from both storage and
      database every night at midnight UTC.
    </p>

    <h2 class="mt-10 text-xl font-medium tracking-tight text-text">deletion</h2>
    <p>
      from <a href="/app" class="text-accent hover:underline">/app</a>, you can delete any file you
      own. the file is removed from storage and the database synchronously. there are no backups
      or soft-deletes — gone is gone.
    </p>

    <h2 class="mt-10 text-xl font-medium tracking-tight text-text">questions?</h2>
    <p>
      this is open source. you can read every line at the
      <a
        href="https://github.com"
        target="_blank"
        rel="noopener noreferrer"
        class="text-accent hover:underline">github repo</a
      >, or just self-host it.
    </p>
  </section>
</main>

<footer class="mt-24 flex flex-wrap justify-between gap-4 border-t border-surface0 px-8 py-6 font-mono text-[11px] text-overlay1">
  <span>made with ☕ &nbsp;by ben</span>
  <a href="/" class="text-subtext0 hover:text-accent">echo·link</a>
</footer>
