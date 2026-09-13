import { element } from "../../lib/utilties/dom-utilities.ts";
import { applyFontPreference, getFontPreference } from "../../lib/settings.ts";
import type { EditorElements } from "./client/types.ts";
import { EditorSidebar } from "./client/components.ts";
import { parseManuscript } from "./client/data.ts";
import { state, syncChapter } from "./client/state.ts";
import { restoreHandle, restoreLocal, saveLocal, storeHandle } from "./client/storage.ts";
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
  saveButton: element<HTMLButtonElement>("#save-button"),
};

async function save(): Promise<void> {
  if (!state.hasUnsavedChanges) return;
  syncChapter(elements.editor);
  saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
  await saveToDisk(elements.editor, elements.saveStatus, false, elements.saveButton);
  if (!state.hasUnsavedChanges) {
    elements.saveButton.disabled = true;
  }
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
}

const actionCallbacks: ActionCallbacks = {
  render,
  onChanged: () => {
    state.hasUnsavedChanges = true;
    updateChangedStatus(elements.saveStatus, elements.saveButton);
  },
  onLoaded: (filename) => {
    state.hasUnsavedChanges = false;
    updateStatus(elements.saveStatus, filename, elements.saveButton);
    element("#filename").textContent = filename;
  },
};

function changed(): void {
  syncChapter(elements.editor);
  state.hasUnsavedChanges = true;
  saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
  updateChangedStatus(elements.saveStatus, elements.saveButton);
  updateStats(state.manuscript, state.activeChapter);
}

// Event Listeners
elements.editor.addEventListener("input", changed);
elements.editor.addEventListener("command", changed);

const appMenu = element<HTMLElement>("#app-menu");
const menuToggle = document.querySelector<HTMLButtonElement>("#menu-toggle");

function openMenu(): void {
  appMenu.hidden = false;
  menuToggle?.setAttribute("aria-expanded", "true");
}

function closeMenu(): void {
  appMenu.hidden = true;
  menuToggle?.setAttribute("aria-expanded", "false");
}

function toggleMenu(): void {
  if (appMenu.hidden) {
    openMenu();
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

elements.saveButton.addEventListener("click", () => {
  void save();
});

element("#save-file")?.addEventListener("click", () => {
  void save();
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
const saved = restoreLocal();
if (saved) {
  state.manuscript = saved.manuscript;
  state.activeChapter = saved.activeChapter;
  state.hasUnsavedChanges = Boolean(saved.hasUnsavedChanges);
  if (state.hasUnsavedChanges) {
    updateChangedStatus(elements.saveStatus, elements.saveButton);
  } else {
    updateStatus(elements.saveStatus, state.manuscript.filename, elements.saveButton);
  }
} else {
  state.hasUnsavedChanges = false;
  updateStatus(elements.saveStatus, undefined, elements.saveButton);
}

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

try {
  const response = await fetch("/api/editor/status");
  if (response.ok) {
    const status = await response.json();
    state.isDesktop = status.isDesktop === true;
    if (state.isDesktop) {
      document.body.classList.add("desktop-mode");
    }
    state.desktopFileLoaded = typeof status.activeFile === "string";
    if (state.desktopFileLoaded && typeof status.content === "string" && status.activeFile) {
      state.manuscript = parseManuscript(status.content, status.activeFile);
      state.activeChapter = 0;
      state.fileHandle = null;
      state.canWrite = false;
      elements.saveStatus.textContent = `Active file: ${status.activeFile}`;
      elements.saveStatus.className = "saved";
      state.hasUnsavedChanges = false;
      elements.saveButton.disabled = true;
      saveLocal(state.manuscript, state.activeChapter, state.hasUnsavedChanges);
    } else if (state.desktopFileLoaded && status.activeFile) {
      state.manuscript.filename = status.activeFile;
      element("#filename").textContent = status.activeFile;
      elements.saveStatus.textContent = `Active file: ${status.activeFile}`;
      elements.saveStatus.className = "saved";
      state.hasUnsavedChanges = false;
      elements.saveButton.disabled = true;
    }
  }
} catch {
  state.isDesktop = false;
}

applyFontPreference(getFontPreference());

if (!saved && !state.desktopFileLoaded && !sessionStorage.getItem("writasaurus-skip-welcome")) {
  globalThis.location.replace("/welcome");
}

elements.sidebar.collapse();
render();
