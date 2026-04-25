<!-- apps/web/src/lib/components/Brand.svelte -->
<script lang="ts">
  let { size = 'md', pulsing = false }: { size?: 'sm' | 'md' | 'xl'; pulsing?: boolean } = $props();
  const sizeClass = $derived(
    { sm: 'text-sm', md: 'text-[15px]', xl: 'text-7xl md:text-8xl' }[size]
  );
  const dotPx = $derived(size === 'xl' ? 14 : size === 'md' ? 8 : 5);
</script>

<span class="inline-flex items-baseline gap-1 font-mono font-medium text-text {sizeClass} tracking-tight">
  <span>echo</span>
  <span
    class="inline-block shrink-0 rounded-full bg-mauve"
    style:width="{dotPx}px"
    style:height="{dotPx}px"
    style:animation={pulsing ? 'pulse-glow 2.4s ease-in-out infinite' : 'none'}
  ></span>
  <span>link</span>
</span>
