<script lang="ts">
  import { theme } from "$lib/stores/theme.svelte";
  let { value, size = 96 }: { value: string; size?: number } = $props();
  let dataUrl = $state("");

  $effect(() => {
    void theme.current;
    const lightTheme = document.documentElement.dataset.theme === "light";
    const styles = getComputedStyle(document.documentElement);
    const foreground = styles.getPropertyValue("--color-text").trim();
    const background = styles.getPropertyValue("--color-mantle").trim();
    let cancelled = false;
    const qrValue = value;
    const width = size * 2;
    async function generate() {
      const { default: QRCode } = await import("qrcode");
      const url = await QRCode.toDataURL(qrValue, {
        margin: 4,
        width,
        color: {
          dark: lightTheme ? foreground : background,
          light: lightTheme ? background : foreground,
        },
      });
      if (!cancelled) dataUrl = url;
    }
    void generate().catch(() => {
      if (!cancelled) dataUrl = "";
    });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if dataUrl}
  <img
    src={dataUrl}
    alt="Scan to open this shared file"
    width={size}
    height={size}
    class="rounded-md"
  />
{/if}
