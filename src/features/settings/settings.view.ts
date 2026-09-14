import { html } from "../../framework/html/html.ts";
import { createView } from "../../framework/html/template.ts";
import { baseLayout } from "../../views/layouts/base-layout.ts";

export const settingsView = createView((ctx) => {
  return baseLayout({
    title: "Settings — Writasaurus",
    bodyClass: "settings-mode",
    scripts: html`
      <link rel="stylesheet" href="${ctx.asset("features/settings/settings.client.css")}">
      <script type="module" src="${ctx.asset("features/settings/settings.client.ts")}"></script>
    `,
    content: html`
      <div class="settings-container">
        <header class="settings-header">
          <a class="brand" href="/">Writasaurus</a>
        </header>

        <main class="settings-content">
          <section class="settings-card stack">
            <h2>Settings</h2>
            <p>
              Customize your writing environment. Preferences are stored locally on this device.
            </p>

            <div class="settings-group">
              <label for="font-select" class="settings-label">
                <strong>Editor Font</strong>
                <span
                  class="settings-help">Choose the typeface used in the editor and chapter titles.</span>
              </label>

              <select id="font-select" class="settings-select">
                <optgroup label="System">
                  <option value="system" selected>System Font</option>
                </optgroup>
                <optgroup label="Serif">
                  <option value="serif">Standard Serif</option>
                  <option value="georgia">Georgia</option>
                  <option value="times">Times New Roman</option>
                  <option value="garamond">Garamond</option>
                </optgroup>
                <optgroup label="Sans-Serif">
                  <option value="sans-serif">Standard Sans-Serif</option>
                  <option value="arial">Arial</option>
                  <option value="helvetica">Helvetica</option>
                  <option value="verdana">Verdana</option>
                  <option value="trebuchet">Trebuchet MS</option>
                </optgroup>
              </select>
            </div>

            <div class="settings-preview">
              <span class="preview-label">Preview</span>
              <div id="font-preview" class="preview-box">
                <h3 class="preview-heading">Chapter One: The Horizon</h3>
                <p class="preview-body">
                  The morning sun crested the ridges, illuminating the pages of a new story.
                  Every word, sentence, and chapter will appear in your chosen typeface.
                </p>
              </div>
            </div>

            <div class="settings-group">
              <label for="words-per-page-input" class="settings-label">
                <strong>Words per Page</strong>
                <span class="settings-help">
                  Average word count used to calculate estimated page counts (default: 300).
                </span>
              </label>

              <input
                type="number"
                id="words-per-page-input"
                class="settings-input"
                min="50"
                max="2000"
                step="10"
                value="300"
              >
            </div>

            <div class="settings-status" id="settings-status" aria-live="polite"></div>

            <div class="settings-actions">
              <a href="/" class="button primary return-link"
                title="Return to Editor (Ctrl+Shift+E)">← Return to Editor</a>
            </div>
          </section>
        </main>
      </div>
    `,
  });
});
