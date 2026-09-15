import { webComponent, type WebComponentElement } from "../../../framework/web-components/index.ts";

export interface EditorSidebar extends WebComponentElement<Record<string, never>> {
  collapsed: boolean;
  toggle(): boolean;
  collapse(): void;
  expand(): void;
}

function getCollapsed(this: EditorSidebar): boolean {
  return this.classList.contains("collapsed");
}

function setCollapsed(this: EditorSidebar, value: boolean): void {
  this.classList.toggle("collapsed", value);
  this.emit("toggle", { collapsed: value });
}

function toggle(this: EditorSidebar): boolean {
  this.collapsed = !this.collapsed;
  return this.collapsed;
}

function collapse(this: EditorSidebar): void {
  this.collapsed = true;
}

function expand(this: EditorSidebar): void {
  this.collapsed = false;
}

// The server-rendered chapter list remains in light DOM for the editor UI.
webComponent("editor-sidebar")
  .defineShadow(false)
  .defineProperty("collapsed", { get: getCollapsed, set: setCollapsed })
  .defineProperty("toggle", toggle)
  .defineProperty("collapse", collapse)
  .defineProperty("expand", expand)
  .create();
