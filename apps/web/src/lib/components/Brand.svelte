<!-- apps/web/src/lib/components/Brand.svelte -->
<script lang="ts">
  let { size = 'md', pulsing = false }: { size?: 'sm' | 'md' | 'xl'; pulsing?: boolean } = $props();
  const sizeClass = $derived({ sm: 'text-sm', md: 'text-base', xl: 'text-7xl md:text-8xl' }[size]);
</script>

<span class="inline-flex items-baseline gap-1 font-mono {sizeClass} tracking-tight">
  <span>echo</span>
  <span
    class="block rounded-full bg-mauve"
    style:width={size === 'xl' ? '14px' : size === 'md' ? '6px' : '4px'}
    style:height={size === 'xl' ? '14px' : size === 'md' ? '6px' : '4px'}
    style:animation={pulsing ? 'pulse-glow 2.4s ease-in-out infinite' : 'none'}
  ></span>
  <span>link</span>
</span>
