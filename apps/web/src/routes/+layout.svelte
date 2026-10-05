<!-- apps/web/src/routes/+layout.svelte -->
<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { theme } from "$lib/stores/theme.svelte";
  onMount(() => theme.init());
  let { children } = $props();
</script>

<a
  href="#main-content"
  class="skip-link fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-accent px-4 py-3 text-on-accent focus:translate-y-0"
  >Skip to content</a
>
<div class="relative">
  {@render children()}
</div>
