type Theme = 'mocha' | 'latte';

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
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const storedAccent = localStorage.getItem('accent') as Accent | null;
    this.current = storedTheme === 'latte' ? 'latte' : 'mocha';
    this.accent = storedAccent && (ACCENTS as readonly string[]).includes(storedAccent) ? storedAccent : 'mauve';
    document.documentElement.dataset.theme = this.current;
    document.documentElement.dataset.accent = this.accent;
  }

  toggle() {
    this.current = this.current === 'mocha' ? 'latte' : 'mocha';
    document.documentElement.dataset.theme = this.current;
    localStorage.setItem('theme', this.current);
  }

  setAccent(a: Accent) {
    this.accent = a;
    document.documentElement.dataset.accent = a;
    localStorage.setItem('accent', a);
  }
}

export const theme = new ThemeStore();
