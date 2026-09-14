import { defineWebComponent } from "../../../framework/component/component.ts";
import { html } from "../../../framework/html/client_html_renderer.ts";

defineWebComponent(
  "word-count",
  {
    observedAttributes: {
      "chapter-words": 0,
      "chapter-chars": 0,
      "total-words": 0,
      "words-per-page": 300,
    },
    style: /* css */ `
      :host {
        align-items: center;
        display: flex;
        flex-shrink: 1;
        gap: 0.5rem;
        min-width: 0;
      }

      .stat {
        flex-shrink: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .divider {
        color: var(--muted);
        font-size: 0.6rem;
      }
    `,
  },
  (_element, { defineRender }) => {
    defineRender((element) => {
      const chapterWords = element.observedAttribute["chapter-words"];
      const chapterChars = element.observedAttribute["chapter-chars"];
      const totalWords = element.observedAttribute["total-words"];
      const wordsPerPage = element.observedAttribute["words-per-page"];

      return html`
        <span class="stat">Chapter: ${chapterWords.toLocaleString()} words · ${chapterChars
          .toLocaleString()} characters</span>
        <span class="divider" aria-hidden="true">|</span>
        <span class="stat">Manuscript: ${totalWords
          .toLocaleString()} words · ${(totalWords / wordsPerPage).toFixed(1)} pages</span>
      `;
    });
  },
);
