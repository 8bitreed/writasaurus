import {
  html,
  repeat,
  webComponent,
  type WebComponentElement,
} from "../../../framework/web-components/index.ts";
import type { Chapter } from "./types.ts";

export interface EditorSidebar extends WebComponentElement<Record<string, never>> {
  collapsed: boolean;
  collapse(): void;
  expand(): void;
  setChapters(chapters: readonly Chapter[], activeChapter: number): void;
  toggle(): boolean;
}

type SidebarState = {
  activeChapter: number;
  chapters: readonly Chapter[];
};

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

webComponent("editor-sidebar")
  .defineShadow(false)
  .defineState<SidebarState>({ activeChapter: 0, chapters: [] })
  .defineProperty("collapsed", { get: getCollapsed, set: setCollapsed })
  .defineProperty("toggle", toggle)
  .defineProperty("collapse", collapse)
  .defineProperty("expand", expand)
  .defineMethod(
    "setChapters",
    (element) => (chapters: readonly Chapter[], activeChapter: number) => {
      element.state.chapters = [...chapters];
      element.state.activeChapter = activeChapter;
    },
  )
  .defineRender((element) => {
    const selectChapter = (index: number) => () => element.emit("chapterselect", { index });
    const deleteChapter = (index: number) => (event: Event) => {
      event.stopPropagation();
      element.emit("chapterdelete", { index });
    };
    const chapterCount = element.state.chapters.length;

    return html`
      <div class="sidebar-heading">
        <h2>Chapters</h2>
        <button type="button" class="small" @click=${() => element.emit("chapteradd")}>Add</button>
      </div>
      <ol id="chapter-list">
        ${repeat(
          element.state.chapters,
          (chapter) => chapter.id,
          (chapter, index) =>
            html`
              <li class=${`chapter-item${index === element.state.activeChapter ? " active" : ""}`}
                @click=${selectChapter(index)}>
                <span>${chapter.title}</span>
                <small>${chapter.wordCount.toLocaleString()}w</small>
                <button type="button" aria-label=${`Delete ${chapter.title}`} @click=${deleteChapter(
                  index,
                )}>
                  Delete
                </button>
              </li>
            `,
        )}
      </ol>
      <span id="sidebar-stats">${chapterCount} chapter${chapterCount === 1 ? "" : "s"}</span>
    `;
  })
  .create();
