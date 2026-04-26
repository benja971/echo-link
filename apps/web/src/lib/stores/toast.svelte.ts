/** Tiny global toast store. One toast at a time — calling flash() while
 *  a toast is visible resets the timer with the new message. */

class ToastStore {
  message = $state<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  flash(msg: string, durationMs = 1800) {
    if (this.timer) clearTimeout(this.timer);
    this.message = msg;
    this.timer = setTimeout(() => {
      this.message = null;
      this.timer = null;
    }, durationMs);
  }

  dismiss() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.message = null;
  }
}

export const toast = new ToastStore();
