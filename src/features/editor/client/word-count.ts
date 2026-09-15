import { html, webComponent } from "../../../framework/web-components/index.ts";

webComponent("word-count")
  .defineState(() => ({ showChapterStats: true }))
  .defineObservedAttributes<{
    "chapter-words": number;
    "chapter-chars": number;
    "total-words": number;
    "words-per-page": number;
  }>({
    "chapter-words": 0,
    "chapter-chars": 0,
    "total-words": 0,
    "words-per-page": 300,
  })
  .defineStyles(/* css */ `
      :host {
        display: block;
        flex-shrink: 1;
        min-width: 0;
      }

      .stat {
        background: none;
        border: 0;
        color: inherit;
        cursor: pointer;
        font: inherit;
        min-width: 0;
        overflow: hidden;
        padding: 0;
        text-align: inherit;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stat:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    `)
  .defineRender((element) => {
    const chapterWords = element.observedAttribute["chapter-words"];
    const chapterChars = element.observedAttribute["chapter-chars"];
    const totalWords = element.observedAttribute["total-words"];
    const wordsPerPage = element.observedAttribute["words-per-page"];

    const showChapterStats = element.state.showChapterStats;
    const stats = showChapterStats
      ? `Chapter: ${chapterWords.toLocaleString()} words · ${chapterChars.toLocaleString()} characters`
      : `Manuscript: ${totalWords.toLocaleString()} words · ${
        (totalWords / wordsPerPage).toFixed(1)
      } pages`;

    return html`
      <button
        class="stat"
        type="button"
        aria-label="Show ${showChapterStats ? "manuscript" : "chapter"} statistics"
        @click=${() => element.state.showChapterStats = !showChapterStats}
      >
        ${stats}
      </button>
    `;
  })
  .create();
