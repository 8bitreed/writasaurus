import { html, webComponent } from "../../../framework/web-components/index.ts";

webComponent("word-count")
  .defineState(() => ({ statsIndex: 0 }))
  .defineObservedAttributes<{
    "chapter-words": number;
    "total-words": number;
    "words-per-page": number;
    "daily-words": number;
    "daily-word-goal": number;
  }>({
    "chapter-words": 0,
    "total-words": 0,
    "words-per-page": 300,
    "daily-words": 0,
    "daily-word-goal": 1500,
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
    const totalWords = element.observedAttribute["total-words"];
    const wordsPerPage = element.observedAttribute["words-per-page"];
    const dailyWords = element.observedAttribute["daily-words"];
    const dailyWordGoal = element.observedAttribute["daily-word-goal"];

    const stats = [
      `Chapter: ${chapterWords.toLocaleString()} words · ${
        (chapterWords / wordsPerPage).toFixed(1)
      } pages`,
      `Manuscript: ${totalWords.toLocaleString()} words · ${
        (totalWords / wordsPerPage).toFixed(1)
      } pages`,
      `Daily Goal: ${dailyWords.toLocaleString()} / ${dailyWordGoal.toLocaleString()} words`,
    ];
    const nextStatsIndex = (element.state.statsIndex + 1) % stats.length;

    return html`
      <button
        class="stat"
        type="button"
        aria-label="Show ${[
          "chapter",
          "manuscript",
          "daily writing goal",
        ][nextStatsIndex]} statistics"
        @click=${() => element.state.statsIndex = nextStatsIndex}
      >
        ${stats[element.state.statsIndex]}
      </button>
    `;
  })
  .create();
