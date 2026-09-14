import { html } from "../../framework/html/html.ts";
import { createView } from "../../framework/html/template.ts";
import { baseLayout } from "../../views/layouts/base-layout.ts";

type Props = {
  title: string;
};

export const editorView = createView((ctx, props: Props) => {
  return baseLayout({
    title: props.title,
    bodyClass: "editor-mode",
    scripts: html`
      <link rel="stylesheet" href="${ctx.asset("features/editor/editor.client.css")}">
      <script type="module" src="${ctx.asset("features/editor/editor.client.ts")}"></script>
    `,
    content: html`
      <header class="editor-topbar">
        <div class="topbar-center">
          <input id="manuscript-title" value="Untitled Manuscript" aria-label="Manuscript title"
            placeholder="Untitled Manuscript">
          <span class="topbar-meta">
            <span id="filename">manuscript.md</span>
            <span class="save-status-group">
              <save-status id="save-status" role="status" aria-live="polite"></save-status>
              <!-- comment out for now: <kbd class="save-hint" title="Save (Ctrl+S)">Ctrl+S</kbd>-->
            </span>
          </span>
        </div>
        <strong id="chapter-breadcrumb" hidden>Chapter 1</strong>
        <div class="topbar-right">
          <editor-toolbar aria-label="Formatting toolbar" for="#editor"></editor-toolbar>
          <button type="button" id="menu-toggle" class="menu-toggle small" aria-label="Menu"
            title="Menu (Ctrl+M)"
            aria-expanded="false" aria-haspopup="true">
            <span class="hamburger-icon" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
        <nav id="app-menu" class="app-menu" hidden aria-label="Application menu">
          <button type="button" id="save-file" class="menu-item primary">
            <span>Save</span>
            <kbd>Ctrl+S</kbd>
          </button>
          <a href="/open" class="menu-item" id="open-file">Open</a>
          <div class="menu-divider"></div>
          <a href="/settings" class="menu-item" id="settings-link">Settings</a>
          <a href="/about" class="menu-item" id="about-link">About</a>
          <div class="menu-divider"></div>
          <button type="button" id="quit-app" class="menu-item">Quit</button>
          <input id="file-input" type="file" accept=".md,.markdown,.txt" hidden>
        </nav>
      </header>

      <main class="editor-main">
        <div class="editor-workspace">
          <editor-sidebar class="editor-sidebar collapsed" id="editor-sidebar">
            <div class="sidebar-heading">
              <h2>Chapters</h2>
              <button type="button" id="add-chapter" class="small">Add</button>
            </div>
            <ol id="chapter-list"></ol>
            <span id="sidebar-stats">1 chapter</span>
          </editor-sidebar>
          <div class="editor-viewport">
            <section class="writing-area">
              <input id="chapter-title" value="Chapter " aria-label="Chapter title">
              <editor-canvas id="editor" class="editor-canvas" contenteditable="true" role="textbox"
                aria-multiline="true">
                <p>Begin the next chapter...</p>
              </editor-canvas>
            </section>
          </div>
        </div>
      </main>

      <editor-statusbar></editor-statusbar>
    `,
  });
});
