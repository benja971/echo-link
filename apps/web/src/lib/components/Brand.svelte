<!-- apps/web/src/lib/components/Brand.svelte -->
<script lang="ts">
  let { size = "md" }: { size?: "sm" | "md" | "xl" } = $props();
  const sizeClass = $derived(
    { sm: "text-sm", md: "text-[15px]", xl: "text-[clamp(2.75rem,10vw,6rem)]" }[
      size
    ],
  );
  const dotPx = $derived(size === "xl" ? 14 : size === "md" ? 8 : 5);
</script>

<span
  class="inline-flex items-center gap-1.5 font-mono font-medium text-text {sizeClass} tracking-tight"
>
  <span>echo</span>
  <span
    class="inline-block shrink-0 rounded-full"
    style:width="{dotPx}px"
    style:height="{dotPx}px"
    style:background-color="var(--color-accent)"
    aria-hidden="true"
  ></span>
  <span>link</span>
</span>
