import { html, webComponent } from "../../../framework/web-components/index.ts";
import {
  applyFontPreference,
  getFontPreference,
  getWordsPerPagePreference,
} from "../../../lib/settings.ts";
import { syncTruncationTooltip } from "../../../lib/text/text.ts";
import type { ActionCallbacks } from "./actions.ts";
import { addChapter, deleteChapter, loadFile, selectChapter } from "./actions.ts";
import { parseManuscript } from "./data.ts";
import { executeEditorCommand } from "./editor-commands.ts";
import { editorEvents } from "./editor-events.ts";
import type { EditorSidebar } from "./editor-sidebar.ts";
import type { EditorStatusbar } from "./editor-statusbar.ts";
import type { EditorTopbar } from "./editor-topbar.ts";
import type { EditorWritingArea } from "./editor-writing-area.ts";
import { hasWritePermission, saveToDisk } from "./fileio.ts";
import { state, syncChapter } from "./state.ts";
import {
  restoreHandle,
  restoreLocal,
  saveLocal,
  shouldSkipWelcome,
  storeHandle,
} from "./storage.ts";

import "./editor-canvas.ts";
import "./editor-sidebar.ts";
import "./editor-statusbar.ts";
import "./editor-toolbar.ts";
import "./editor-topbar.ts";
import "./editor-writing-area.ts";

type EditorApp = HTMLElement & { refresh(replaceWritingArea?: boolean): void };
type EventWithDetail<T> = Event & { detail: T };
const cleanups = new WeakMap<HTMLElement, () => void>();

function parts(element: HTMLElement): {
  sidebar: EditorSidebar;
  statusbar: EditorStatusbar;
  topbar: EditorTopbar;
  writingArea: EditorWritingArea;
} {
  const sidebar = element.querySelector<EditorSidebar>("editor-sidebar");
  const statusbar = element.querySelector<EditorStatusbar>("editor-statusbar");
  const topbar = element.querySelector<EditorTopbar>("editor-topbar");
  const writingArea = element.querySelector<EditorWritingArea>("editor-writing-area");
  if (!sidebar || !statusbar || !topbar || !writingArea) {
    throw new Error("Editor UI did not render.");
  }
  return { sidebar, statusbar, topbar, writingArea };
}

function refresh(this: EditorApp, replaceWritingArea = true): void {
  const { sidebar, statusbar, topbar, writingArea } = parts(this);
  const chapter = state.manuscript.chapters[state.activeChapter];
  if (!chapter) return;

  sidebar.setChapters(state.manuscript.chapters, state.activeChapter);
  if (replaceWritingArea) writingArea.setChapter(chapter);
  statusbar.setStats({
    chapterWords: chapter.wordCount,
    chapterChars: chapter.charCount,
    totalWords: state.manuscript.chapters.reduce((total, item) => total + item.wordCount, 0),
    wordsPerPage: getWordsPerPagePreference(),
  });
  topbar.setDetails({
    title: String(state.manuscript.frontmatter.title ?? "Untitled Manuscript"),
    filename: state.manuscript.filename,
    saveStatus: state.hasUnsavedChanges ? "unsaved" : "saved",
    saveMessage: state.hasUnsavedChanges
      ? "Unsaved changes"
      : `Saved to ${state.manuscript.filename}`,
    isDesktop: state.isDesktop,
  });
  syncTruncationTooltip(topbar.querySelector<HTMLInputElement>("#manuscript-title")!);
  syncTruncationTooltip(topbar.querySelector<HTMLElement>("#filename")!);
}

async function save(element: EditorApp): Promise<void> {
  if (!state.hasUnsavedChanges) return;
  const { topbar, writingArea } = parts(element);
  const editor = writingArea.editor;
  const saveStatus = topbar.querySelector<HTMLElement>("#save-status");
  if (!editor || !saveStatus) return;
  syncChapter(editor);
  saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
  await saveToDisk(editor, saveStatus, false);
  element.refresh();
}

async function quit(element: EditorApp): Promise<void> {
  if (
    state.hasUnsavedChanges &&
    confirm("You have unsaved changes. Do you want to save before closing?")
  ) {
    await save(element);
    if (state.hasUnsavedChanges) return;
  }
  if (state.hasUnsavedChanges) return;
  if (state.isDesktop) {
    try {
      await fetch("/api/editor/exit", { method: "POST", headers: { origin: location.origin } });
    } catch {
      // The native app may already be closing.
    }
  } else {
    globalThis.close();
  }
}

function markChanged(element: EditorApp): void {
  const editor = parts(element).writingArea.editor;
  if (!editor) return;
  syncChapter(editor);
  state.hasUnsavedChanges = true;
  saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
  element.refresh(false);
}

async function initialize(element: EditorApp): Promise<void> {
  state.fileHandle = await restoreHandle();
  if (state.fileHandle) {
    try {
      state.canWrite = await hasWritePermission(state.fileHandle, false);
    } catch {
      state.fileHandle = null;
      state.canWrite = false;
      await storeHandle(null);
    }
  }

  let opened = false;
  try {
    const response = await fetch("/api/editor/status");
    if (response.ok) {
      const status = await response.json();
      state.isDesktop = status.isDesktop === true;
      if (
        state.isDesktop && typeof status.activeFile === "string" &&
        typeof status.content === "string"
      ) {
        state.manuscript = parseManuscript(status.content, status.activeFile);
        state.activeChapter = 0;
        state.fileHandle = null;
        state.canWrite = false;
        state.hasUnsavedChanges = false;
        state.desktopFileLoaded = true;
        saveLocal(state.manuscript, state.activeChapter, false);
        opened = true;
      }
    }
  } catch {
    state.isDesktop = false;
  }

  if (!opened) {
    state.desktopFileLoaded = false;
    const saved = restoreLocal();
    if (saved) {
      state.manuscript = saved.manuscript;
      state.activeChapter = saved.activeChapter;
      state.hasUnsavedChanges = Boolean(saved.hasUnsavedChanges);
      opened = true;
    }
  }

  applyFontPreference(getFontPreference());
  if (!opened && !shouldSkipWelcome()) {
    location.replace("/welcome");
    return;
  }
  parts(element).sidebar.collapse();
  element.refresh();
}

webComponent("editor-app")
  .defineShadow(false)
  .defineMethod("refresh", (element) => (replaceWritingArea = true) => {
    refresh.call(element as unknown as EditorApp, replaceWritingArea);
  })
  .defineRender(() =>
    html`
      <editor-topbar></editor-topbar>
      <main class="editor-main">
        <div class="editor-workspace">
          <editor-sidebar class="editor-sidebar collapsed"></editor-sidebar>
          <div class="editor-viewport">
            <editor-writing-area></editor-writing-area>
          </div>
        </div>
      </main>
      <editor-statusbar></editor-statusbar>
    `
  )
  .connectedCallback((element) => {
    const app = element as unknown as EditorApp;
    const callbacks: ActionCallbacks = { render: () => app.refresh() };
    const onContent = () => markChanged(app);
    const onChapterTitle = (event: Event) => {
      const title = (event as EventWithDetail<{ title: string }>).detail.title.trim();
      const chapter = state.manuscript.chapters[state.activeChapter];
      if (!chapter) return;
      chapter.title = title || `Chapter ${state.activeChapter + 1}`;
      markChanged(app);
    };
    const onManuscriptTitle = (event: Event) => {
      const title = (event as EventWithDetail<{ title: string }>).detail.title.trim();
      state.manuscript.frontmatter.title = title || "Untitled Manuscript";
      markChanged(app);
    };
    const onAdd = () => {
      const { writingArea } = parts(app);
      if (!writingArea.editor) return;
      syncChapter(writingArea.editor);
      addChapter(callbacks);
      writingArea.selectTitle();
    };
    const onDelete = (event: Event) => {
      const { index } = (event as EventWithDetail<{ index: number }>).detail;
      const { writingArea } = parts(app);
      if (!writingArea.editor) return;
      syncChapter(writingArea.editor);
      deleteChapter(index, callbacks);
    };
    const onSelect = (event: Event) => {
      const { index } = (event as EventWithDetail<{ index: number }>).detail;
      const { sidebar, writingArea } = parts(app);
      if (!writingArea.editor) return;
      syncChapter(writingArea.editor);
      selectChapter(index, callbacks);
      if (matchMedia("(max-width: 55rem)").matches) sidebar.collapse();
    };
    const onAction = (event: Event) => {
      const { action } = (event as EventWithDetail<{ action: "save" | "quit" }>).detail;
      parts(app).topbar.closeMenu();
      if (action === "save") void save(app);
      else void quit(app);
    };
    const onDocumentClick = (event: MouseEvent) => {
      if (!parts(app).topbar.contains(event.target as Node | null)) parts(app).topbar.closeMenu();
    };
    const onCommand = editorEvents.on("command", ({ command, target, value }) => {
      const editor = app.querySelector<HTMLElement>(target);
      if (!editor) return;
      executeEditorCommand(command, value);
      editor.focus();
      markChanged(app);
    });
    const onToggleSidebar = editorEvents.on("toggleSidebar", () => parts(app).sidebar.toggle());
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "b") {
        event.preventDefault();
        parts(app).sidebar.toggle();
      } else if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save(app);
      } else if (modifier && event.key === ",") {
        event.preventDefault();
        location.href = "/settings";
      } else if (modifier && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        parts(app).writingArea.focusEditor();
      } else if (event.key === "Escape") {
        parts(app).topbar.closeMenu();
      } else if (modifier && event.key.toLowerCase() === "m") {
        event.preventDefault();
        parts(app).topbar.toggleMenu(true);
      }
    };
    const onDragOver = (event: DragEvent) => event.preventDefault();
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file && /\.(?:md|markdown|txt)$/i.test(file.name)) {
        void loadFile(file, null, false, callbacks);
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    app.addEventListener("editorcontentchange", onContent);
    app.addEventListener("chaptertitlechange", onChapterTitle);
    app.addEventListener("manuscripttitlechange", onManuscriptTitle);
    app.addEventListener("chapteradd", onAdd);
    app.addEventListener("chapterdelete", onDelete);
    app.addEventListener("chapterselect", onSelect);
    app.addEventListener("editoraction", onAction);
    document.addEventListener("click", onDocumentClick);
    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("dragover", onDragOver);
    globalThis.addEventListener("drop", onDrop);
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    cleanups.set(app, () => {
      onCommand();
      onToggleSidebar();
      app.removeEventListener("editorcontentchange", onContent);
      app.removeEventListener("chaptertitlechange", onChapterTitle);
      app.removeEventListener("manuscripttitlechange", onManuscriptTitle);
      app.removeEventListener("chapteradd", onAdd);
      app.removeEventListener("chapterdelete", onDelete);
      app.removeEventListener("chapterselect", onSelect);
      app.removeEventListener("editoraction", onAction);
      document.removeEventListener("click", onDocumentClick);
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("dragover", onDragOver);
      globalThis.removeEventListener("drop", onDrop);
      globalThis.removeEventListener("beforeunload", onBeforeUnload);
    });
    void initialize(app);
  })
  .disconnectedCallback((element) => cleanups.get(element)?.())
  .create();
