import { html, webComponent } from "../../../framework/web-components/index.ts";
import { renameChapter } from "./actions.ts";
import { normalizeEditorBlocks } from "./editor-normalize.ts";
import { editorEvents } from "./editor-events.ts";
import { activeChapter, editorStore, markChanged } from "./state.ts";
import { editorHistory } from "./history.ts";

export type EditorWritingArea = HTMLElement & {
  readonly editor: HTMLElement | null;
  focusEditor(): void;
  selectTitle(): void;
};

const cleanups = new WeakMap<HTMLElement, () => void>();
/** Tracks which chapter is currently mounted so typing is never interrupted. */
const mounted = new WeakMap<HTMLElement, string>();
/** Debounce timers for capturing history at word boundaries */
const historyTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Loads the active chapter into the DOM. Content and title are written
 * imperatively (rather than bound in the template) so re-renders triggered by
 * unrelated store changes cannot move the caret while the writer is typing.
 */
function mountChapter(element: HTMLElement): void {
  const chapter = activeChapter();
  if (!chapter || mounted.get(element) === chapter.id) return;
  mounted.set(element, chapter.id);
  const title = element.querySelector<HTMLInputElement>("#chapter-title");
  const editor = element.querySelector<HTMLElement>("#editor");
  if (title) title.value = chapter.title;
  if (editor) {
    editor.innerHTML = chapter.content || "<p></p>";
    normalizeEditorBlocks(editor);
  }
}

/**
 * Debounced history capture. Records state after user stops typing for 300ms.
 * Groups consecutive edits (typing a word, adding spaces, etc.) as single undo actions.
 */
function scheduleHistoryCapture(
  element: HTMLElement,
  content: string,
  title: string,
): void {
  const existingTimer = historyTimers.get(element);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    editorHistory.push(content, title);
    historyTimers.delete(element);
  }, 300);

  historyTimers.set(element, timer);
}

export const editorWritingArea = webComponent("editor-writing-area")
  .defineShadow(false)
  .defineProperty("editor", {
    get(this: HTMLElement): HTMLElement | null {
      return this.querySelector("#editor");
    },
  })
  .defineMethod("focusEditor", (element) => () => element.$<HTMLElement>("#editor")?.focus())
  .defineMethod(
    "selectTitle",
    (element) => () => element.$<HTMLInputElement>("#chapter-title")?.select(),
  )
  .defineRender(() => {
    const onTitleInput = (event: Event) => {
      const input = event.currentTarget as HTMLInputElement;
      const writingArea = input.closest("editor-writing-area") as HTMLElement | null;
      const editor = writingArea?.querySelector<HTMLElement>("#editor");
      renameChapter(input.value);
      if (editor && writingArea) {
        scheduleHistoryCapture(writingArea, editor.innerHTML, input.value);
      }
    };
    const onEditorInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const editor = target?.closest<HTMLElement>("#editor");
      const writingArea = editor?.closest("editor-writing-area") as HTMLElement | null;
      if (editor && writingArea) {
        const title = writingArea.querySelector<HTMLInputElement>("#chapter-title")?.value || "";
        scheduleHistoryCapture(writingArea, editor.innerHTML, title);
        markChanged(editor);
      }
    };

    return html`
      <section class="writing-area" @input=${onEditorInput}>
        <input id="chapter-title" @input=${onTitleInput} aria-label="Chapter title">
        <editor-canvas id="editor" class="editor-canvas"></editor-canvas>
      </section>
    `;
  })
  .connectedCallback((element) => {
    const area = element as unknown as EditorWritingArea;
    mountChapter(element);
    const unsubscribeStore = editorStore.subscribe(() => mountChapter(element));
    const unsubscribeFocus = editorEvents.on("focusChapterTitle", () => area.selectTitle());
    const unsubscribeUndo = editorEvents.on("undo", () => {
      const existingTimer = historyTimers.get(element);
      if (existingTimer) clearTimeout(existingTimer);
      historyTimers.delete(element);

      const entry = editorHistory.undo();
      if (!entry) return;
      const editor = area.editor;
      const title = element.querySelector<HTMLInputElement>("#chapter-title");
      if (editor) {
        editor.innerHTML = entry.content;
        normalizeEditorBlocks(editor);
      }
      if (title) title.value = entry.title;
      markChanged(editor);
    });
    const unsubscribeRedo = editorEvents.on("redo", () => {
      const existingTimer = historyTimers.get(element);
      if (existingTimer) clearTimeout(existingTimer);
      historyTimers.delete(element);

      const entry = editorHistory.redo();
      if (!entry) return;
      const editor = area.editor;
      const title = element.querySelector<HTMLInputElement>("#chapter-title");
      if (editor) {
        editor.innerHTML = entry.content;
        normalizeEditorBlocks(editor);
      }
      if (title) title.value = entry.title;
      markChanged(editor);
    });
    cleanups.set(element, () => {
      const existingTimer = historyTimers.get(element);
      if (existingTimer) clearTimeout(existingTimer);
      historyTimers.delete(element);
      unsubscribeStore();
      unsubscribeFocus();
      unsubscribeUndo();
      unsubscribeRedo();
    });
  })
  .disconnectedCallback((element) => {
    cleanups.get(element)?.();
    cleanups.delete(element);
  })
  .create();
