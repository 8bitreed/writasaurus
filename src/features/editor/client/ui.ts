import { element } from "../../../lib/utilties/dom-utilities.ts";
import { getWordsPerPagePreference } from "../../../lib/settings.ts";
import { setSaveStatus } from "./save-status.ts";
import type { EditorElements, Manuscript } from "./types.ts";

export function render(
  manuscript: Manuscript,
  activeChapter: number,
  elements: EditorElements,
  onChapterSelect: (index: number) => void,
  onChapterDelete: (index: number) => void,
): void {
  const current = manuscript.chapters[activeChapter];
  if (!current) return;
  elements.manuscriptTitle.value = String(manuscript.frontmatter.title ?? "Untitled Manuscript");
  elements.chapterTitle.value = current.title;
  elements.editor.innerHTML = current.content || "<p></p>";
  element("#filename").textContent = manuscript.filename;
  element("#chapter-breadcrumb").textContent = current.title;
  elements.chapterList.replaceChildren(...manuscript.chapters.map((item, index) => {
    const row = document.createElement("li");
    row.className = `chapter-item${index === activeChapter ? " active" : ""}`;
    const label = document.createElement("span");
    label.textContent = item.title;
    const words = document.createElement("small");
    words.textContent = `${item.wordCount.toLocaleString()}w`;
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.ariaLabel = `Delete ${item.title}`;
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      onChapterDelete(index);
    });
    row.append(label, words, remove);
    row.addEventListener("click", () => {
      if (index === activeChapter) return;
      onChapterSelect(index);
    });
    return row;
  }));
  updateStats(manuscript, activeChapter);
}

export function updateStats(manuscript: Manuscript, activeChapter: number): void {
  const current = manuscript.chapters[activeChapter];
  const wordsPerPage = getWordsPerPagePreference();
  const currentWords = current?.wordCount ?? 0;
  const total = manuscript.chapters.reduce((sum, item) => sum + item.wordCount, 0);
  element("#chapter-stats").textContent = `Chapter: ${currentWords.toLocaleString()} words · ${
    (currentWords / wordsPerPage).toFixed(1)
  } pages`;
  element("#total-stats").textContent = `Manuscript: ${total.toLocaleString()} words · ${
    (total / wordsPerPage).toFixed(1)
  } pages`;
  element("#sidebar-stats").textContent = `${manuscript.chapters.length} chapter${
    manuscript.chapters.length === 1 ? "" : "s"
  }`;
}

export function updateStatus(
  saveStatus: HTMLElement,
  filename?: string,
): void {
  setSaveStatus(saveStatus, "saved", filename ? `Saved to ${filename}` : "Saved");
}

export function updateChangedStatus(
  saveStatus: HTMLElement,
): void {
  setSaveStatus(saveStatus, "unsaved", "Unsaved changes");
}
