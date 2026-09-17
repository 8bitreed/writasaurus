import { html, webComponent } from "../../../framework/web-components/index.ts";
import { syncTruncationTooltip } from "../../../lib/text/text.ts";
import { commitManuscriptTitle, renameManuscript } from "./actions.ts";
import { editorStore, state } from "./state.ts";
import type { Unsubscribe } from "../../../framework/web-components/index.ts";
import "../../../shared/components/save-status.ts";

export type EditorTopbar = HTMLElement & {
  closeMenu(): void;
  focusFirstMenuItem(): void;
  toggleMenu(focusFirst?: boolean): boolean;
};

const tooltipSubscriptions = new WeakMap<HTMLElement, Unsubscribe>();

function syncTooltips(element: HTMLElement): void {
  const title = element.querySelector<HTMLInputElement>("#manuscript-title");
  const filename = element.querySelector<HTMLElement>("#filename");
  if (title) syncTruncationTooltip(title);
  if (filename) syncTruncationTooltip(filename);
}

export const editorTopbar = webComponent("editor-topbar")
  .defineShadow(false)
  .subscribe(editorStore)
  .defineState({ menuOpen: false })
  .defineMethod("focusFirstMenuItem", (element) => () => {
    element.$<HTMLElement>(".menu-item")?.focus();
  })
  .defineMethod("toggleMenu", (element) => (focusFirst = false): boolean => {
    element.state.menuOpen = !element.state.menuOpen;
    if (element.state.menuOpen && focusFirst) element.focusFirstMenuItem();
    return element.state.menuOpen;
  })
  .defineMethod("closeMenu", (element) => () => {
    element.state.menuOpen = false;
  })
  .defineRender((element) => {
    const { menuOpen } = element.state;
    const { filename } = state.manuscript;
    const title = String(state.manuscript.frontmatter.title ?? "Untitled Manuscript");
    const saveStatus = state.hasUnsavedChanges ? "unsaved" : "saved";
    const saveMessage = state.saveMessage ||
      (state.hasUnsavedChanges ? "Unsaved changes" : `Saved to ${filename}`);
    const emitAction = (
      action: "new" | "open" | "save" | "saveAsEpub" | "fullscreen" | "quit",
    ) =>
    () => element.emit("editoraction", { action });
    const updateTitle = (event: Event) => {
      renameManuscript((event.currentTarget as HTMLInputElement).value);
    };
    const commitTitle = () => commitManuscriptTitle();

    return html`
      <header class="editor-topbar">
        <div class="topbar-center">
          <input id="manuscript-title" .value=${title} @input=${updateTitle} @blur=${commitTitle}
            aria-label="Manuscript title" placeholder="Untitled Manuscript">
          <span class="topbar-meta">
            <span id="filename">${filename}</span>
            <span class="save-status-group">
              <save-status id="save-status" status=${saveStatus} message=${saveMessage} role="status"
                aria-live="polite"></save-status>
            </span>
          </span>
        </div>
        <div class="topbar-right">
          <editor-toolbar aria-label="Formatting toolbar" for="#editor"></editor-toolbar>
          <button type="button" id="menu-toggle" class="menu-toggle small" aria-label="Menu"
            title="Menu (Ctrl+M)" aria-expanded=${String(menuOpen)} aria-haspopup="true"
            @click=${element.toggleMenu}>
            <span class="hamburger-icon" aria-hidden="true"><span></span><span></span><span></span></span>
          </button>
        </div>
        <nav id="app-menu" class="app-menu" ?hidden=${!menuOpen} aria-label="Application menu">
          <button type="button" class="menu-item" @click=${emitAction("save")}>
            <span>Save</span><kbd>Ctrl+S</kbd>
          </button>
          <button type="button" class="menu-item" id="menu-save-epub" @click=${emitAction(
            "saveAsEpub",
          )}>
            <span>Save As</span>
          </button>
          <div class="menu-divider"></div>
          <button type="button" class="menu-item" id="menu-new-manuscript" @click=${emitAction(
            "new",
          )}>
            New Manuscript
          </button>
          <button type="button" class="menu-item" id="menu-open-manuscript" @click=${emitAction(
            "open",
          )}>
            Open Manuscript
          </button>
          <div class="menu-divider"></div>
          <a href="/settings" class="menu-item">Settings</a>
          <a href="/about" class="menu-item">About</a>
          ${state.isDesktop
            ? html`
              <div class="menu-divider"></div>
              <button type="button" class="menu-item" id="menu-fullscreen"
                @click=${emitAction("fullscreen")}>
                <span>Fullscreen</span><kbd>F11</kbd>
              </button>
              <button type="button" class="menu-item quit" @click=${emitAction("quit")}>
                Quit
              </button>
            `
            : ""}
        </nav>
      </header>
    `;
  })
  .connectedCallback((element) => {
    syncTooltips(element);
    // Runs after the store-driven re-render, so tooltips match the latest DOM.
    tooltipSubscriptions.set(element, editorStore.subscribe(() => syncTooltips(element)));
  })
  .disconnectedCallback((element) => {
    tooltipSubscriptions.get(element)?.();
    tooltipSubscriptions.delete(element);
  })
  .create();
