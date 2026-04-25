<script lang="ts">
  import QRCode from 'qrcode';
  let { value, size = 96 }: { value: string; size?: number } = $props();
  let dataUrl = $state('');

  $effect(() => {
    QRCode.toDataURL(value, {
      margin: 0,
      width: size * 2,
      color: { dark: '#cdd6f4', light: '#0000' }
    }).then((url) => (dataUrl = url));
  });
</script>

{#if dataUrl}
  <img src={dataUrl} alt="QR code" width={size} height={size} class="rounded-lg bg-mantle p-1" />
{/if}
