type Theme = 'mocha' | 'latte';

class ThemeStore {
  current = $state<Theme>('mocha');

  init() {
    if (typeof document === 'undefined') return;
    const stored = localStorage.getItem('theme') as Theme | null;
    this.current = stored ?? 'mocha';
    document.documentElement.dataset.theme = this.current;
  }

  toggle() {
    this.current = this.current === 'mocha' ? 'latte' : 'mocha';
    document.documentElement.dataset.theme = this.current;
    localStorage.setItem('theme', this.current);
  }
}

export const theme = new ThemeStore();
