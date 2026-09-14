import { defineWebComponent } from "../../../framework/web-components/index.ts";
import { executeEditorCommand } from "./editor-commands.ts";

function handlePaste(event: Event): void {
  const clipboardEvent = event as ClipboardEvent;
  clipboardEvent.preventDefault();
  executeEditorCommand("insertText", clipboardEvent.clipboardData?.getData("text/plain") ?? "");
}

function handleKeyDown(event: Event): void {
  const keyboardEvent = event as KeyboardEvent;
  if (keyboardEvent.key !== "Tab") return;

  keyboardEvent.preventDefault();
  // A raw tab character collapses to a single space under normal CSS whitespace rules.
  executeEditorCommand("insertText", "\u00A0\u00A0\u00A0\u00A0");
  (event.currentTarget as HTMLElement).dispatchEvent(new Event("input", { bubbles: true }));
}

defineWebComponent("editor-canvas", (component) => {
  // This element is itself the contenteditable surface and retains server-rendered content.
  return component
    .defineShadow(false)
    .connectedCallback((canvas) => {
      if (!canvas.hasAttribute("contenteditable")) canvas.setAttribute("contenteditable", "true");
      if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "textbox");
      if (!canvas.hasAttribute("aria-multiline")) canvas.setAttribute("aria-multiline", "true");
      canvas.addEventListener("paste", handlePaste);
      canvas.addEventListener("keydown", handleKeyDown);
    })
    .disconnectedCallback((canvas) => {
      canvas.removeEventListener("paste", handlePaste);
      canvas.removeEventListener("keydown", handleKeyDown);
    });
});
