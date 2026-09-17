export type FontOption =
  | "alegreya"
  | "system"
  | "serif"
  | "georgia"
  | "times"
  | "garamond"
  | "sans-serif"
  | "arial"
  | "helvetica"
  | "verdana"
  | "trebuchet";

export interface FontDefinition {
  id: FontOption;
  name: string;
  category: "system" | "serif" | "sans";
  family: string;
}

export const FONT_OPTIONS: FontDefinition[] = [
  {
    id: "alegreya",
    name: "Alegreya",
    category: "serif",
    family:
      '"Alegreya", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: "system",
    name: "System Font",
    category: "system",
    family:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: "serif",
    name: "Standard Serif",
    category: "serif",
    family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    id: "georgia",
    name: "Georgia",
    category: "serif",
    family: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "times",
    name: "Times New Roman",
    category: "serif",
    family: '"Times New Roman", Times, Georgia, serif',
  },
  {
    id: "garamond",
    name: "Garamond",
    category: "serif",
    family: 'Garamond, "Baskerville", "Times New Roman", serif',
  },
  {
    id: "sans-serif",
    name: "Standard Sans-Serif",
    category: "sans",
    family:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "arial",
    name: "Arial",
    category: "sans",
    family: "Arial, Helvetica, sans-serif",
  },
  {
    id: "helvetica",
    name: "Helvetica",
    category: "sans",
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    id: "verdana",
    name: "Verdana",
    category: "sans",
    family: "Verdana, Geneva, sans-serif",
  },
  {
    id: "trebuchet",
    name: "Trebuchet MS",
    category: "sans",
    family: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
  },
];

export const FONT_MAP: Record<FontOption, FontDefinition> = Object.fromEntries(
  FONT_OPTIONS.map((f) => [f.id, f]),
) as Record<FontOption, FontDefinition>;

export const DEFAULT_FONT: FontOption = "alegreya";
export const SETTINGS_KEY = "writasaurus-settings-font";

export const DEFAULT_WORDS_PER_PAGE = 300;
export const SETTINGS_WORDS_PER_PAGE_KEY = "writasaurus-settings-words-per-page";

export function getFontPreference(): FontOption {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved && saved in FONT_MAP) {
      return saved as FontOption;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return DEFAULT_FONT;
}

export function saveFontPreference(font: FontOption): void {
  try {
    localStorage.setItem(SETTINGS_KEY, font);
  } catch (err) {
    console.warn("Could not save font preference", err);
  }
}

export function applyFontPreference(font: FontOption): void {
  const definition = FONT_MAP[font] ?? FONT_MAP[DEFAULT_FONT];
  if (typeof document !== "undefined") {
    document.documentElement.dataset.font = definition.id;
    document.documentElement.style.setProperty("--editor-font", definition.family);
  }
}

export function getWordsPerPagePreference(): number {
  try {
    const saved = localStorage.getItem(SETTINGS_WORDS_PER_PAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return DEFAULT_WORDS_PER_PAGE;
}

export function saveWordsPerPagePreference(wordsPerPage: number): void {
  try {
    if (Number.isFinite(wordsPerPage) && wordsPerPage > 0) {
      localStorage.setItem(
        SETTINGS_WORDS_PER_PAGE_KEY,
        String(Math.round(wordsPerPage)),
      );
    }
  } catch (err) {
    console.warn("Could not save words per page preference", err);
  }
}
