import { html, webComponent } from "../../../framework/web-components/index.ts";
import type { Chapter } from "./types.ts";

export type EditorWritingArea = HTMLElement & {
  readonly editor: HTMLElement | null;
  focusEditor(): void;
  selectTitle(): void;
  setChapter(chapter: Chapter): void;
};

type WritingState = {
  title: string;
};

function handleCanvasInput(this: HTMLElement, event: Event): void {
  if ((event.target as HTMLElement | null)?.id === "editor") {
    this.dispatchEvent(
      new CustomEvent("editorcontentchange", { bubbles: true, composed: true }),
    );
  }
}

webComponent("editor-writing-area")
  .defineShadow(false)
  .defineState<WritingState>({ title: "Chapter 1" })
  .defineProperty("editor", {
    get(this: HTMLElement): HTMLElement | null {
      return this.querySelector("#editor");
    },
  })
  .defineMethod("setChapter", (element) => (chapter: Chapter) => {
    element.state.title = chapter.title;
    const editor = element.$<HTMLElement>("#editor");
    if (editor) editor.innerHTML = chapter.content || "<p></p>";
  })
  .defineMethod("focusEditor", (element) => () => element.$<HTMLElement>("#editor")?.focus())
  .defineMethod(
    "selectTitle",
    (element) => () => element.$<HTMLInputElement>("#chapter-title")?.select(),
  )
  .defineRender((element) => {
    const updateTitle = (event: Event) => {
      const input = event.currentTarget as HTMLInputElement;
      element.emit("chaptertitlechange", { title: input.value });
    };

    return html`
      <section class="writing-area">
        <input id="chapter-title" .value=${element.state.title} @input=${updateTitle}
          aria-label="Chapter title">
        <editor-canvas id="editor" class="editor-canvas"></editor-canvas>
      </section>
    `;
  })
  .connectedCallback((element) => element.addEventListener("input", handleCanvasInput))
  .disconnectedCallback((element) => element.removeEventListener("input", handleCanvasInput))
  .create();
