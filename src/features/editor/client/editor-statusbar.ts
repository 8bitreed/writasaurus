import { component } from "../../../framework/component/component.ts";
import type { ComponentElement } from "../../../framework/component/types.ts";
import { getWordsPerPagePreference } from "../../../lib/settings.ts";

export interface EditorStatusbar extends ComponentElement {
  setStats(options: EditorStats): void;
}

export interface EditorStats {
  chapterWords: number;
  chapterChars: number;
  totalWords: number;
  wordsPerPage?: number;
}

function setStats(this: EditorStatusbar, options: EditorStats): void {
  const wordsPerPage = options.wordsPerPage ?? getWordsPerPagePreference();
  const chapterStats = this.querySelector<HTMLElement>("#chapter-stats");
  const totalStats = this.querySelector<HTMLElement>("#total-stats");

  if (chapterStats) {
    chapterStats.textContent =
      `Chapter: ${options.chapterWords} words · ${options.chapterChars} characters`;
  }
  if (totalStats) {
    totalStats.textContent = `Manuscript: ${options.totalWords.toLocaleString()} words · ${
      (options.totalWords / wordsPerPage).toFixed(1)
    } pages`;
  }
}

component("editor-statusbar", ({ defineProperty, defineShadow }) => {
  // Its controls and stat nodes are supplied by the server-rendered editor view.
  defineShadow(false);
  defineProperty("setStats", setStats);
});
