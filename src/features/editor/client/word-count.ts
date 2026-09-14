import { defineWebComponent } from "../../../framework/component/component.ts";
import { html } from "../../../framework/html/client_html_renderer.ts";

function numberAttribute(value: string | null, fallback: number): number {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isFinite(number) ? number : fallback;
}

defineWebComponent("word-count", ({ defineObservedAttribute, defineRender, defineStyles }) => {
  defineStyles(/* css */ `
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
  `);
  defineObservedAttribute("chapter-words", "0");
  defineObservedAttribute("chapter-chars", "0");
  defineObservedAttribute("total-words", "0");
  defineObservedAttribute("words-per-page", "300");

  defineRender((element) => {
    const chapterWords = numberAttribute(element.observedAttribute["chapter-words"], 0);
    const chapterChars = numberAttribute(element.observedAttribute["chapter-chars"], 0);
    const totalWords = numberAttribute(element.observedAttribute["total-words"], 0);
    const wordsPerPage = numberAttribute(element.observedAttribute["words-per-page"], 300);

    return html`
      <span class="stat">Chapter: ${chapterWords.toLocaleString()} words · ${chapterChars
        .toLocaleString()} characters</span>
      <span class="divider" aria-hidden="true">|</span>
      <span class="stat">Manuscript: ${totalWords
        .toLocaleString()} words · ${(totalWords / wordsPerPage).toFixed(1)} pages</span>
    `;
  });
});
