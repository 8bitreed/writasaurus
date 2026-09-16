import {
  html,
  repeat,
  webComponent,
  type WebComponentElement,
} from "../../../framework/web-components/index.ts";
import { addChapter, deleteChapter, selectChapter } from "./actions.ts";
import { editorEvents } from "./editor-events.ts";
import { editorStore, state } from "./state.ts";

export interface EditorSidebar extends WebComponentElement<Record<string, never>> {
  collapsed: boolean;
  collapse(): void;
  expand(): void;
  toggle(): boolean;
}

function getCollapsed(this: EditorSidebar): boolean {
  return this.classList.contains("collapsed");
}

function setCollapsed(this: EditorSidebar, value: boolean): void {
  this.classList.toggle("collapsed", value);
  this.emit("toggle", { collapsed: value });
}

function toggle(this: EditorSidebar): boolean {
  this.collapsed = !this.collapsed;
  return this.collapsed;
}

function collapse(this: EditorSidebar): void {
  this.collapsed = true;
}

function expand(this: EditorSidebar): void {
  this.collapsed = false;
}

export const editorSidebar = webComponent("editor-sidebar")
  .defineShadow(false)
  .subscribe(editorStore)
  .defineProperty("collapsed", { get: getCollapsed, set: setCollapsed })
  .defineProperty("toggle", toggle)
  .defineProperty("collapse", collapse)
  .defineProperty("expand", expand)
  .defineRender((element) => {
    const sidebar = element as unknown as EditorSidebar;
    const { chapters } = state.manuscript;
    const onSelect = (index: number) => () => {
      selectChapter(index);
      if (matchMedia("(max-width: 55rem)").matches) sidebar.collapse();
    };
    const onDelete = (index: number) => (event: Event) => {
      event.stopPropagation();
      deleteChapter(index);
    };
    const onAdd = () => {
      addChapter();
      editorEvents.emit("focusChapterTitle", undefined);
    };

    return html`
      <div class="sidebar-heading">
        <h2>Chapters</h2>
        <button type="button" class="small" @click=${onAdd}>Add</button>
      </div>
      <ol id="chapter-list">
        ${repeat(
          chapters,
          (chapter) => chapter.id,
          (chapter, index) =>
            html`
              <li class=${`chapter-item${index === state.activeChapter ? " active" : ""}`}
                @click=${onSelect(index)}>
                <span>${chapter.title}</span>
                <small>${chapter.wordCount.toLocaleString()}w</small>
                <button type="button" aria-label=${`Delete ${chapter.title}`} @click=${onDelete(
                  index,
                )}>
                  Delete
                </button>
              </li>
            `,
        )}
      </ol>
      <span id="sidebar-stats">${chapters.length} chapter${chapters.length === 1 ? "" : "s"}</span>
    `;
  })
  .create();
