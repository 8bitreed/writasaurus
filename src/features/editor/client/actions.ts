import type { WritableFileHandle } from "./types.ts";
import { chapter, parseManuscript } from "./data.ts";
import { storeHandle } from "./storage.ts";
import { editorStore, state } from "./state.ts";

export async function loadFile(
  file: File,
  handle: WritableFileHandle | null = null,
  writable = false,
): Promise<void> {
  editorStore.set({
    manuscript: parseManuscript(await file.text(), file.name),
    activeChapter: 0,
    fileHandle: handle,
    canWrite: writable,
    hasUnsavedChanges: false,
    saveMessage: "",
  });
  await storeHandle(handle);
}

export function addChapter(): void {
  editorStore.update((draft) => {
    draft.manuscript.chapters.push(
      chapter(`Chapter ${draft.manuscript.chapters.length + 1}: Untitled`, "<p></p>"),
    );
    draft.activeChapter = draft.manuscript.chapters.length - 1;
    draft.hasUnsavedChanges = true;
  });
}

export function deleteChapter(index: number): void {
  if (state.manuscript.chapters.length === 1) {
    alert("A manuscript needs one chapter.");
    return;
  }
  if (!confirm(`Delete "${state.manuscript.chapters[index]?.title}"?`)) return;
  editorStore.update((draft) => {
    draft.manuscript.chapters.splice(index, 1);
    if (index < draft.activeChapter) {
      draft.activeChapter--;
    } else if (index === draft.activeChapter) {
      draft.activeChapter = Math.min(draft.activeChapter, draft.manuscript.chapters.length - 1);
    }
    draft.hasUnsavedChanges = true;
  });
}

export function selectChapter(index: number): void {
  if (index === state.activeChapter) return;
  editorStore.set({ activeChapter: index });
}

export function renameChapter(title: string): void {
  editorStore.update((draft) => {
    const chapter = draft.manuscript.chapters[draft.activeChapter];
    if (!chapter) return;
    chapter.title = title.trim() || `Chapter ${draft.activeChapter + 1}`;
    draft.hasUnsavedChanges = true;
    draft.saveMessage = "";
  });
}

export function renameManuscript(title: string): void {
  editorStore.update((draft) => {
    draft.manuscript.frontmatter.title = title.trim() || "Untitled Manuscript";
    draft.hasUnsavedChanges = true;
    draft.saveMessage = "";
  });
}
