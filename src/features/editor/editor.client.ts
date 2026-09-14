import { element } from "../../lib/utilties/dom-utilities.ts";
import { applyFontPreference, getFontPreference } from "../../lib/settings.ts";
import { registerReturnToEditorShortcut } from "../../lib/shortcuts.ts";
import { syncTruncationTooltip } from "../../lib/text/text.ts";
import type { EditorElements } from "./client/types.ts";
// Imported for its side effect of registering the custom elements used on this page
// (editor-sidebar, editor-canvas, etc.) via customElements.define(). `EditorSidebar` is
// only referenced as a type below, so a plain named import would be tree-shaken away by
// the bundler, silently dropping the registration and leaving the elements un-upgraded.
import "./client/components.ts";
import "./client/editor-toolbar.ts";
import "./client/save-status.ts";
import type { EditorSidebar } from "./client/components.ts";
import { parseManuscript } from "./client/data.ts";
import { executeEditorCommand } from "./client/editor-commands.ts";
import { editorEvents } from "./client/editor-events.ts";
import { state, syncChapter } from "./client/state.ts";
import {
  restoreHandle,
  restoreLocal,
  saveLocal,
  shouldSkipWelcome,
  storeHandle,
} from "./client/storage.ts";
import { render as renderUi, updateChangedStatus, updateStats, updateStatus } from "./client/ui.ts";
import { hasWritePermission, saveToDisk } from "./client/fileio.ts";
import {
  type ActionCallbacks,
  addChapter,
  deleteChapter,
  loadFile,
  selectChapter,
} from "./client/actions.ts";

const elements: EditorElements = {
  editor: element("#editor"),
  chapterList: element("#chapter-list"),
  sidebar: element<EditorSidebar>("#editor-sidebar"),
  chapterTitle: element<HTMLInputElement>("#chapter-title"),
  manuscriptTitle: element<HTMLInputElement>("#manuscript-title"),
  fileInput: element<HTMLInputElement>("#file-input"),
  saveStatus: element("#save-status"),
};

const filenameEl = element("#filename");

// Only shows a native tooltip when the title/filename text is actually
// truncated by the `text-overflow: ellipsis` CSS on these elements.
function syncTitleTooltips(): void {
  syncTruncationTooltip(elements.manuscriptTitle);
  syncTruncationTooltip(filenameEl);
}

globalThis.addEventListener("resize", syncTitleTooltips);

async function save(): Promise<void> {
  if (!state.hasUnsavedChanges) return;
  syncChapter(elements.editor);
  saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
  await saveToDisk(elements.editor, elements.saveStatus, false);
}

async function quit(): Promise<void> {
  if (state.hasUnsavedChanges) {
    const shouldSave = confirm("You have unsaved changes. Do you want to save before closing?");
    if (shouldSave) {
      await save();
      if (state.hasUnsavedChanges) {
        return;
      }
    }
  }
  if (state.isDesktop) {
    try {
      await fetch("/api/editor/exit", {
        method: "POST",
        headers: { origin: globalThis.location.origin },
      });
    } catch {
      // ignore
    }
  } else {
    globalThis.close();
  }
}

function render(): void {
  renderUi(
    state.manuscript,
    state.activeChapter,
    elements,
    (index) => selectChapter(index, elements.editor, elements.sidebar, actionCallbacks),
    (index) => deleteChapter(index, elements.editor, actionCallbacks),
  );
  syncTitleTooltips();
}

const actionCallbacks: ActionCallbacks = {
  render,
  onChanged: () => {
    state.hasUnsavedChanges = true;
    updateChangedStatus(elements.saveStatus);
  },
  onLoaded: (filename) => {
    state.hasUnsavedChanges = false;
    updateStatus(elements.saveStatus, filename);
    filenameEl.textContent = filename;
    syncTitleTooltips();
  },
};

function changed(): void {
  syncChapter(elements.editor);
  state.hasUnsavedChanges = true;
  saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
  updateChangedStatus(elements.saveStatus);
  updateStats(state.manuscript, state.activeChapter);
}

editorEvents.on("command", ({ command, target, value }) => {
  const editor = document.querySelector<HTMLElement>(target);
  if (!editor) return;

  executeEditorCommand(command, value);
  editor.focus();
  changed();
});

// Event Listeners
elements.editor.addEventListener("input", changed);

const appMenu = element<HTMLElement>("#app-menu");
const menuToggle = document.querySelector<HTMLButtonElement>("#menu-toggle");

function focusFirstMenuItem(): void {
  const firstItem = appMenu.querySelector<HTMLElement>(".menu-item");
  firstItem?.focus();
}

function openMenu(focusFirst = false): void {
  appMenu.hidden = false;
  menuToggle?.setAttribute("aria-expanded", "true");
  if (focusFirst) {
    focusFirstMenuItem();
  }
}

function closeMenu(): void {
  appMenu.hidden = true;
  menuToggle?.setAttribute("aria-expanded", "false");
}

function toggleMenu(focusFirst = false): void {
  if (appMenu.hidden) {
    openMenu(focusFirst);
  } else {
    closeMenu();
  }
}

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu();
});

document.addEventListener("click", (event) => {
  const target = event.target as Node | null;
  if (!appMenu.hidden && !appMenu.contains(target) && !menuToggle?.contains(target)) {
    closeMenu();
  }
});

appMenu.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest(".menu-item")) {
    closeMenu();
  }
});

elements.manuscriptTitle.addEventListener("input", () => {
  state.manuscript.frontmatter.title = elements.manuscriptTitle.value.trim() ||
    "Untitled Manuscript";
  syncTitleTooltips();
  changed();
});

elements.chapterTitle.addEventListener("input", () => {
  const current = state.manuscript.chapters[state.activeChapter];
  if (!current) return;
  current.title = elements.chapterTitle.value.trim() || `Chapter ${state.activeChapter + 1}`;
  element("#chapter-breadcrumb").textContent = current.title;
  changed();
});

element("#add-chapter").addEventListener("click", () => {
  addChapter(elements.editor, elements.chapterTitle, actionCallbacks);
});

const sidebarToggle = element("#sidebar-toggle");

sidebarToggle.addEventListener("click", () => {
  elements.sidebar.toggle();
});

// Toggle sidebar with Ctrl+B
globalThis.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "b") {
    event.preventDefault();
    elements.sidebar.toggle();
  }
});

element("#save-file")?.addEventListener("click", () => {
  void save();
});

element("#quit-app")?.addEventListener("click", () => {
  void quit();
});

elements.fileInput.addEventListener("change", () => {
  const file = elements.fileInput.files?.[0];
  if (file) void loadFile(file, null, false, actionCallbacks);
  elements.fileInput.value = "";
});

globalThis.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
  }
});

globalThis.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    event.preventDefault();
    globalThis.location.href = "/settings";
  }
});

// Toggle hamburger menu with Ctrl+M
globalThis.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "m") {
    event.preventDefault();
    if (appMenu.hidden) {
      openMenu(true);
    } else {
      closeMenu();
      menuToggle?.focus();
    }
  } else if (event.key === "Escape" && !appMenu.hidden) {
    event.preventDefault();
    closeMenu();
    menuToggle?.focus();
  }
});

// Return to editor canvas with Ctrl+Shift+E
registerReturnToEditorShortcut(() => {
  closeMenu();
  elements.editor.focus();
});

declare global {
  var writasaurus: {
    save?: () => void;
    open?: () => void;
    settings?: () => void;
    about?: () => void;
    quit?: () => Promise<void>;
  } | undefined;
}

globalThis.writasaurus = {
  save: () => void save(),
  open: () => {
    globalThis.location.href = "/open";
  },
  settings: () => {
    globalThis.location.href = "/settings";
  },
  about: () => {
    globalThis.location.href = "/about";
  },
  quit: () => quit(),
};

globalThis.addEventListener("beforeunload", (event) => {
  if (state.hasUnsavedChanges) {
    event.preventDefault();
    event.returnValue = "";
  }
});

globalThis.addEventListener("dragover", (event) => event.preventDefault());
globalThis.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file && /\.(?:md|markdown|txt)$/i.test(file.name)) {
    void loadFile(file, null, false, actionCallbacks);
  }
});

// Initialization
//
// The active manuscript always comes from a fresh source on load: the desktop app's
// active file on disk when running as desktop, or the sessionStorage cache when
// re-entering the same browser tab (e.g. a dev-mode reload). We never fall back to a
// manuscript that was persisted from a previous, separate app session.
function showInitError(context: string, error: unknown): void {
  console.error(`[writasaurus] Editor initialization failed during "${context}".`, error);
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;background:#7f1d1d;color:#fff;" +
    "padding:8px 12px;font:12px/1.4 monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;";
  const message = error instanceof Error ? (error.stack || error.message) : String(error);
  banner.textContent = `Editor init error (${context}): ${message}`;
  document.body.prepend(banner);
}

try {
  state.fileHandle = await restoreHandle();
  if (state.fileHandle) {
    try {
      state.canWrite = await hasWritePermission(state.fileHandle, false);
    } catch (error) {
      console.warn("The stored file handle is no longer available.", error);
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
      if (state.isDesktop) {
        document.body.classList.add("desktop-mode");
      }
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
        saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
        opened = true;
      }
    }
  } catch (error) {
    console.warn("Could not reach the desktop status API, or could not parse its content.", error);
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

  if (opened) {
    element("#filename").textContent = state.manuscript.filename;
    syncTitleTooltips();
    if (state.hasUnsavedChanges) {
      updateChangedStatus(elements.saveStatus);
    } else {
      updateStatus(elements.saveStatus, state.manuscript.filename);
    }
  } else {
    state.hasUnsavedChanges = false;
    updateStatus(elements.saveStatus, undefined);
  }

  applyFontPreference(getFontPreference());

  if (!opened && !shouldSkipWelcome()) {
    globalThis.location.replace("/welcome");
  }

  elements.sidebar.collapse();
  render();

  if (opened && !state.manuscript.chapters[state.activeChapter]) {
    showInitError(
      "render",
      new Error(
        `Manuscript "${state.manuscript.filename}" loaded but has no chapter at index ` +
          `${state.activeChapter} (chapters: ${state.manuscript.chapters.length}). ` +
          `The editor content area was left blank.`,
      ),
    );
  }
} catch (error) {
  showInitError("startup", error);
}
