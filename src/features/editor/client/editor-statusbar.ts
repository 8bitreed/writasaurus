import {
  defineWebComponent,
  type WebComponentElement,
} from "../../../framework/web-components/index.ts";
import { html } from "../../../framework/html/client_html_renderer.ts";
import { getWordsPerPagePreference } from "../../../lib/settings.ts";
import { editorEvents } from "./editor-events.ts";
import "./word-count.ts";

export interface EditorStatusbar extends WebComponentElement<EditorStats> {
  setStats(options: EditorStats): void;
}

export type EditorStats = {
  chapterWords: number;
  chapterChars: number;
  totalWords: number;
  wordsPerPage?: number;
};

function setStats(this: EditorStatusbar, options: EditorStats): void {
  Object.assign(this.state, {
    chapterWords: options.chapterWords,
    chapterChars: options.chapterChars,
    totalWords: options.totalWords,
    wordsPerPage: options.wordsPerPage ?? getWordsPerPagePreference(),
  });
}

function toggleSidebar(): void {
  editorEvents.emit("toggleSidebar", undefined);
}

defineWebComponent("editor-statusbar", (component) => {
  return component
    .defineStyles(/* css */ `
    :host {
      align-items: center;
      background: var(--surface);
      border-top: 1px solid var(--border);
      box-sizing: border-box;
      color: var(--muted);
      display: flex;
      font-size: 0.75rem;
      gap: 0.75rem;
      justify-content: space-between;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
      padding: 0.5rem 1rem;
      position: relative;
    }

    button {
      align-items: center;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 0.3rem;
      color: var(--text);
      display: inline-flex;
      flex-shrink: 0;
      font: inherit;
      font-size: 0.72rem;
      gap: 0.35rem;
      min-height: 1.6rem;
      padding: 0.2rem 0.5rem;
      white-space: nowrap;
    }

    button:active:not(:disabled) {
      background: var(--surface-sunken);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
      transform: translateY(1px) scale(0.98);
    }

    button:disabled {
      box-shadow: none;
      cursor: not-allowed;
      opacity: 0.45;
      transform: none;
    }

    kbd {
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: 0.25rem;
      color: var(--muted);
      font-size: 0.65rem;
      padding: 0.05rem 0.3rem;
    }

    @media (max-width: 55rem) {
      :host {
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
      }
    }
  `)
    .defineState({ chapterChars: 0, chapterWords: 0, totalWords: 0, wordsPerPage: 300 })
    .defineProperty("setStats", setStats)
    .defineRender(({ state }) => {
      const { chapterChars, chapterWords, totalWords, wordsPerPage } = state;

      return html`
        <button type="button" aria-label="Toggle chapters panel" title="Toggle chapters panel (Ctrl+B)"
          @click=${toggleSidebar}>
          Chapters <kbd>Ctrl+B</kbd>
        </button>
        <word-count
          chapter-words=${chapterWords}
          chapter-chars=${chapterChars}
          total-words=${totalWords}
          words-per-page=${wordsPerPage}
        ></word-count>
      `;
    });
});
