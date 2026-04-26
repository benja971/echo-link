/** Lightweight platform detection for shortcut display. The actual
 *  data-platform attribute is set on <html> by an inline script in
 *  app.html (see app.html) so we have it before first paint without
 *  hydration mismatch. */

export type Platform = 'mac' | 'pc';

export function getPlatform(): Platform {
  if (typeof document === 'undefined') return 'mac'; // SSR fallback
  const attr = document.documentElement.dataset.platform;
  if (attr === 'mac' || attr === 'pc') return attr;
  // Fallback if the inline script didn't run for some reason
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) return 'mac';
  return 'pc';
}

export function isMac(): boolean {
  return getPlatform() === 'mac';
}

/** The "modifier" symbol — ⌘ on macOS, "Ctrl" on PC. */
export function modKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/** Format a shortcut for display. Examples:
 *    formatShortcut('K', { mod: true })       → "⌘K"  (mac) / "Ctrl+K" (pc)
 *    formatShortcut('C', { mod: true, shift: true }) → "⌘⇧C" / "Ctrl+Shift+C"
 *    formatShortcut('T')                      → "T"
 */
export function formatShortcut(
  key: string,
  opts: { mod?: boolean; shift?: boolean; alt?: boolean } = {}
): string {
  const mac = isMac();
  const parts: string[] = [];
  if (opts.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (opts.shift) parts.push(mac ? '⇧' : 'Shift');
  if (opts.alt) parts.push(mac ? '⌥' : 'Alt');
  parts.push(key);
  return mac ? parts.join('') : parts.join('+');
}
