import {
  applyFontPreference,
  type FontOption,
  getFontPreference,
  saveFontPreference,
} from "../../lib/settings.ts";

const fontSelect = document.querySelector<HTMLSelectElement>("#font-select");
const status = document.querySelector<HTMLElement>("#settings-status");

const currentFont = getFontPreference();
applyFontPreference(currentFont);

if (fontSelect) {
  fontSelect.value = currentFont;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  fontSelect.addEventListener("change", () => {
    const selected = fontSelect.value as FontOption;
    saveFontPreference(selected);
    applyFontPreference(selected);

    if (status) {
      status.textContent = "Font preference saved.";
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        status.textContent = "";
      }, 2500);
    }
  });
}
