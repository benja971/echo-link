<!-- apps/web/src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<main class="relative z-10">
  {@render children()}
</main>
