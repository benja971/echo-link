export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const ACCENTS = ["blue", "teal", "amber", "rose"] as const;
export type Accent = (typeof ACCENTS)[number];

class ThemeStore {
  current = $state<Theme>("light");
  accent = $state<Accent>("blue");

  init() {
    if (typeof document === "undefined") return;
    const { dataset } = document.documentElement;
    this.current = dataset.theme === "dark" ? "dark" : "light";
    this.accent = (ACCENTS as readonly string[]).includes(dataset.accent ?? "")
      ? (dataset.accent as Accent)
      : "blue";
    dataset.theme = this.current;
    dataset.accent = this.accent;
  }

  cycle() {
    this.setTheme(this.current === "light" ? "dark" : "light");
  }

  toggle() {
    this.cycle();
  }

  setTheme(t: Theme) {
    this.current = t;
    document.documentElement.dataset.theme = t;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", t === "light" ? "#f3f4f0" : "#131316");
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }

  setAccent(a: Accent) {
    this.accent = a;
    document.documentElement.dataset.accent = a;
    try {
      localStorage.setItem("accent", a);
    } catch {}
  }
}

export const theme = new ThemeStore();
