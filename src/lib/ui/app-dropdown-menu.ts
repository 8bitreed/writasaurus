import { html, webComponent } from "../../framework/web-components/index.ts";

export interface AppDropdownMenuElement extends HTMLElement {
  open: boolean;
  toggle(): void;
  close(): void;
}

export const appDropdownMenu = webComponent("app-dropdown-menu")
  .defineObservedAttributes({
    open: false,
    placement: "bottom-start" as "bottom-start" | "bottom-end",
  })
  .defineStyles(/* css */ `
    :host {
      display: inline-block;
      position: relative;
      font-family: inherit;
      color: var(--text, #18212a);
    }

    .menu-trigger {
      display: inline-flex;
      cursor: pointer;
    }

    .menu-popover {
      background: var(--surface, #f8fbfe);
      border: 1px solid var(--border, #d5e2ec);
      border-radius: 0.5rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      box-sizing: border-box;
      display: none;
      min-width: 180px;
      padding: 0.35rem 0;
      position: absolute;
      top: 100%;
      margin-top: 4px;
      z-index: 1000;
    }

    .menu-popover.open {
      display: block;
      animation: menu-enter 0.15s ease-out;
    }

    @keyframes menu-enter {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .menu-popover.bottom-start {
      left: 0;
    }

    .menu-popover.bottom-end {
      right: 0;
    }

    ::slotted([role="menuitem"]) {
      align-items: center;
      background: transparent;
      border: none;
      box-sizing: border-box;
      color: var(--text, #18212a);
      cursor: pointer;
      display: flex;
      font-family: inherit;
      font-size: 0.9rem;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      text-align: left;
      transition: background-color 0.15s ease;
      width: 100%;
    }

    ::slotted([role="menuitem"]:hover) {
      background-color: var(--surface-sunken, #e2edf5);
    }

    ::slotted([role="menuitem"]:focus-visible) {
      background-color: var(--surface-sunken, #e2edf5);
      outline: 2px solid var(--accent, #2a6f97);
      outline-offset: -2px;
    }
  `)
  .defineProperty("open", {
    get(this: HTMLElement) {
      return this.getAttribute("open") === "true";
    },
    set(this: HTMLElement, val: boolean) {
      this.setAttribute("open", String(val));
    },
  })
  .defineMethod("toggle", (element) => () => {
    const isOpen = element.getAttribute("open") === "true";
    element.setAttribute("open", String(!isOpen));
    element.emit("toggle", { open: !isOpen });
  })
  .defineMethod("close", (element) => () => {
    element.setAttribute("open", "false");
    element.emit("close", {});
  })
  .defineRender((element) => {
    const { open, placement } = element.observedAttribute;

    const onTriggerClick = (event: Event) => {
      event.stopPropagation();
      element.toggle();
    };

    const onMenuClick = (event: Event) => {
      const target = (event.target as HTMLElement).closest('[role="menuitem"]');
      if (target) {
        element.close();
      }
    };

    return html`
      <div class="menu-trigger" @click=${onTriggerClick}>
        <slot name="trigger"></slot>
      </div>
      <div
        class=${`menu-popover ${placement} ${open ? "open" : ""}`}
        role="menu"
        @click=${onMenuClick}
      >
        <slot></slot>
      </div>
    `;
  })
  .create();
