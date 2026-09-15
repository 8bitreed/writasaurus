import { html, webComponent } from "../../framework/web-components/index.ts";

export type SaveStatus = "" | "saved" | "unsaved";

export function setSaveStatus(element: HTMLElement, status: SaveStatus, message: string): void {
  element.setAttribute("status", status);
  element.setAttribute("message", message);
}

webComponent("save-status")
  .defineObservedAttributes({ message: "", status: "" })
  .defineStyles(/* css */ `
      :host {
        align-items: center;
        color: inherit;
        display: inline-flex;
        font-size: inherit;
        line-height: inherit;
        white-space: nowrap;
      }

      .save-status-indicator {
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
        height: 0.45rem;
        margin-right: 0.35rem;
        width: 0.45rem;
      }

      :host([status=""]) .save-status-indicator {
        display: none;
      }

      .save-status-indicator.saved {
        background-color: #86c9a3;
      }

      .save-status-indicator.unsaved {
        background-color: #e6a6c7;
      }
    `)
  .defineRender((element) => {
    const status = element.observedAttribute.status;
    const message = element.observedAttribute.message;

    return html`
      <span class=${`save-status-indicator ${status}`} aria-hidden="true"></span>
      <span>${message}</span>
    `;
  })
  .create();
