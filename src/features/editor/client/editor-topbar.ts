import { html, webComponent } from "../../../framework/web-components/index.ts";
import "../../../shared/components/save-status.ts";

export type EditorTopbar = HTMLElement & {
  closeMenu(): void;
  focusFirstMenuItem(): void;
  setDetails(details: {
    title: string;
    filename: string;
    saveMessage: string;
    saveStatus: "" | "saved" | "unsaved";
    isDesktop: boolean;
  }): void;
  toggleMenu(focusFirst?: boolean): boolean;
};

type TopbarState = {
  title: string;
  filename: string;
  saveMessage: string;
  saveStatus: "" | "saved" | "unsaved";
  isDesktop: boolean;
  menuOpen: boolean;
};

webComponent("editor-topbar")
  .defineShadow(false)
  .defineState<TopbarState>({
    title: "Untitled Manuscript",
    filename: "manuscript.md",
    saveMessage: "",
    saveStatus: "",
    isDesktop: false,
    menuOpen: false,
  })
  .defineMethod("setDetails", (element) => (details: Omit<TopbarState, "menuOpen">) => {
    Object.assign(element.state, details);
  })
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
    const { filename, isDesktop, menuOpen, saveMessage, saveStatus, title } = element.state;
    const emitAction = (action: "save" | "quit") => () => element.emit("editoraction", { action });
    const updateTitle = (event: Event) => {
      const input = event.currentTarget as HTMLInputElement;
      element.emit("manuscripttitlechange", { title: input.value });
    };

    return html`
      <header class="editor-topbar">
        <div class="topbar-center">
          <input id="manuscript-title" .value=${title} @input=${updateTitle}
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
          <button type="button" class="menu-item primary" @click=${emitAction("save")}>
            <span>Save</span><kbd>Ctrl+S</kbd>
          </button>
          <a href="/open" class="menu-item">Open</a>
          <div class="menu-divider"></div>
          <a href="/settings" class="menu-item">Settings</a>
          <a href="/about" class="menu-item">About</a>
          <div class="menu-divider"></div>
          ${isDesktop
            ? html`<button type="button" class="menu-item quit" @click=${
              emitAction("quit")
            }>Quit</button>`
            : ""}
        </nav>
      </header>
    `;
  })
  .create();
