import { webComponent } from "../../../framework/web-components/index.ts";
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
  executeEditorCommand("insertText", "\t");
  (event.currentTarget as HTMLElement).dispatchEvent(new Event("input", { bubbles: true }));
}

// This element is itself the contenteditable surface and retains server-rendered content.
webComponent("editor-canvas")
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
  })
  .create();
