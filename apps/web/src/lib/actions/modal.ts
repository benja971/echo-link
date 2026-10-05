export function modal(node: HTMLDialogElement, onClose: () => void) {
  const previousFocus = document.activeElement;
  node.showModal();
  node.querySelector<HTMLElement>("[data-dialog-focus]")?.focus();
  function dismissBackdrop(event: MouseEvent) {
    if (event.target !== node) return;
    const rect = node.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      onClose();
    }
  }
  function keepFocus(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      node.querySelectorAll<HTMLElement>(
        "button, a[href], input, select, textarea, summary, audio[controls], video[controls], [tabindex]",
      ),
    ).filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(":disabled, [hidden]") &&
        !element.closest("[inert]") &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (
      !node.contains(active) ||
      (event.shiftKey ? active === first : active === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
  node.addEventListener("keydown", keepFocus);
  node.addEventListener("click", dismissBackdrop);
  return {
    destroy() {
      node.removeEventListener("click", dismissBackdrop);
      node.removeEventListener("keydown", keepFocus);
      node.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    },
  };
}
