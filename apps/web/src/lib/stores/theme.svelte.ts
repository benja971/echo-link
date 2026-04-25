export const THEMES = ['latte', 'frappe', 'macchiato', 'mocha'] as const;
export type Theme = (typeof THEMES)[number];

export const ACCENTS = [
  'mauve',
  'peach',
  'sky',
  'teal',
  'green',
  'yellow',
  'lavender',
  'red',
  'pink',
  'blue'
] as const;
export type Accent = (typeof ACCENTS)[number];

class ThemeStore {
  current = $state<Theme>('mocha');
  accent = $state<Accent>('mauve');

  init() {
    if (typeof document === 'undefined') return;
    const storedTheme = localStorage.getItem('theme');
    const storedAccent = localStorage.getItem('accent');
    this.current = (THEMES as readonly string[]).includes(storedTheme ?? '')
      ? (storedTheme as Theme)
      : 'mocha';
    this.accent = (ACCENTS as readonly string[]).includes(storedAccent ?? '')
      ? (storedAccent as Accent)
      : 'mauve';
    document.documentElement.dataset.theme = this.current;
    document.documentElement.dataset.accent = this.accent;
  }

  /** Cycle to next theme (used by ⌘T shortcut). */
  cycle() {
    const i = THEMES.indexOf(this.current);
    this.setTheme(THEMES[(i + 1) % THEMES.length]!);
  }

  /** Back-compat alias for ⌘T. */
  toggle() {
    this.cycle();
  }

  setTheme(t: Theme) {
    this.current = t;
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
  }

  setAccent(a: Accent) {
    this.accent = a;
    document.documentElement.dataset.accent = a;
    localStorage.setItem('accent', a);
  }
}

export const theme = new ThemeStore();
