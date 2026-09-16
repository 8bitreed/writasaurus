import type { Manuscript, WritableFileHandle } from "./types.ts";
import { serialize } from "./data.ts";
import { storeHandle } from "./storage.ts";
import { editorStore, markSaved, state } from "./state.ts";

const filePicker = globalThis as unknown as {
  showSaveFilePicker?: (options: object) => Promise<WritableFileHandle>;
  showOpenFilePicker?: (options: object) => Promise<WritableFileHandle[]>;
};

const MARKDOWN_TYPES = [{
  description: "Markdown",
  accept: {
    "text/markdown": [".md", ".markdown"],
    "text/plain": [".txt"],
  },
}];

export async function hasWritePermission(
  handle: WritableFileHandle,
  request: boolean,
): Promise<boolean> {
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return request && (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function writeFile(
  handle: WritableFileHandle,
  manuscript: Manuscript,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(serialize(manuscript));
  await writable.close();
  markSaved();
}

export function download(manuscript: Manuscript): void {
  const url = URL.createObjectURL(new Blob([serialize(manuscript)], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = manuscript.filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  markSaved(`Exported to ${manuscript.filename}`);
}

export async function saveToDisk(saveAs = false): Promise<void> {
  if (state.isDesktop) {
    try {
      const response = await fetch("/api/editor/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: serialize(state.manuscript),
          filename: state.manuscript.filename,
          saveAs: saveAs || !state.desktopFileLoaded,
        }),
      });
      if (response.status === 204) return;
      if (!response.ok) throw new Error(`Disk save failed: ${response.status}`);
      const result = await response.json();
      editorStore.update((draft) => {
        draft.manuscript.filename = result.name;
        draft.desktopFileLoaded = true;
        draft.hasUnsavedChanges = false;
        draft.saveMessage = "";
      });
      return;
    } catch (error) {
      console.error("Desktop save failed:", error);
      editorStore.set({ saveMessage: "Save failed" });
    }
  }

  if (state.fileHandle) {
    try {
      const canWrite = await hasWritePermission(state.fileHandle, true);
      editorStore.set({ canWrite });
      if (canWrite) {
        await writeFile(state.fileHandle, state.manuscript);
        return;
      }
    } catch (error) {
      console.warn("The previous file handle is no longer writable.", error);
      editorStore.set({ fileHandle: null, canWrite: false });
      await storeHandle(null);
    }
  }

  if (!filePicker.showSaveFilePicker) {
    download(state.manuscript);
    return;
  }

  try {
    const handle = await filePicker.showSaveFilePicker({
      suggestedName: state.manuscript.filename,
      types: MARKDOWN_TYPES,
    });
    editorStore.update((draft) => {
      draft.fileHandle = handle;
      draft.canWrite = true;
      draft.manuscript.filename = handle.name;
    });
    await storeHandle(handle);
    await writeFile(handle, state.manuscript);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.warn("Native save picker failed; using a download instead.", error);
    download(state.manuscript);
  }
}

export async function openFile(
  fileInput: HTMLInputElement,
  onLoaded: (file: File, handle: WritableFileHandle | null, writable: boolean) => Promise<void>,
): Promise<void> {
  if (state.isDesktop) {
    try {
      const response = await fetch("/api/editor/open", { method: "POST" });
      if (response.status === 204) return;
      if (!response.ok) throw new Error(`File open failed: ${response.status}`);
      const result = await response.json();
      editorStore.set({ desktopFileLoaded: true });
      await onLoaded(new File([result.content], result.name), null, false);
      return;
    } catch (error) {
      console.error("Desktop open failed:", error);
      alert("The manuscript could not be opened.");
      return;
    }
  }

  if (!filePicker.showOpenFilePicker) {
    fileInput.click();
    return;
  }

  try {
    const handles = await filePicker.showOpenFilePicker({
      types: MARKDOWN_TYPES,
      multiple: false,
    });
    const handle = handles[0];
    if (handle) {
      const writable = await hasWritePermission(handle, true);
      await onLoaded(await handle.getFile(), handle, writable);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.warn("Native open picker failed; using the upload picker instead.", error);
    fileInput.click();
  }
}
