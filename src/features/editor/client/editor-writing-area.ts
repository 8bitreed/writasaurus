import { html, webComponent } from "../../../framework/web-components/index.ts";
import { renameChapter } from "./actions.ts";
import { editorEvents } from "./editor-events.ts";
import { activeChapter, editorStore, markChanged } from "./state.ts";

export type EditorWritingArea = HTMLElement & {
  readonly editor: HTMLElement | null;
  focusEditor(): void;
  selectTitle(): void;
};

const cleanups = new WeakMap<HTMLElement, () => void>();
/** Tracks which chapter is currently mounted so typing is never interrupted. */
const mounted = new WeakMap<HTMLElement, string>();

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
  if (editor) editor.innerHTML = chapter.content || "<p></p>";
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
      renameChapter((event.currentTarget as HTMLInputElement).value);
    };
    const onEditorInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const editor = target?.closest<HTMLElement>("#editor");
      if (editor) markChanged(editor);
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
    cleanups.set(element, () => {
      unsubscribeStore();
      unsubscribeFocus();
    });
  })
  .disconnectedCallback((element) => {
    cleanups.get(element)?.();
    cleanups.delete(element);
  })
  .create();
