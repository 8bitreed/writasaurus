import type {
  AttributeChange,
  ComponentConstructor,
  ComponentElement,
  ComponentOptions,
  StyleValue,
} from "./types.ts";

export type * from "./types.ts";

function createStyleSheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  }
  return null;
}

function processStyles(
  style: StyleValue | readonly StyleValue[] | undefined,
): { sheets: CSSStyleSheet[]; fallbackCss: string[] } {
  if (!style) return { sheets: [], fallbackCss: [] };

  const styleArray = Array.isArray(style) ? style : [style];
  const sheets: CSSStyleSheet[] = [];
  const fallbackCss: string[] = [];

  for (const item of styleArray) {
    if (typeof item === "string") {
      const sheet = createStyleSheet(item);
      if (sheet) {
        sheets.push(sheet);
      } else {
        fallbackCss.push(item);
      }
    } else if (item && typeof item === "object") {
      sheets.push(item as CSSStyleSheet);
    }
  }

  return { sheets, fallbackCss };
}

/**
 * Defines and registers a lightweight custom web component with automatic
 * template stamping, style injection, lifecycle hooks, and element helpers.
 */
export function component<E extends HTMLElement = HTMLElement>(
  tagName: string,
  options: ComponentOptions<E> = {},
): ComponentConstructor<E> {
  const { sheets, fallbackCss } = processStyles(options.style);
  const observedAttrs = Object.freeze([...(options.observedAttributes ?? [])]);
  const shadowConfig = options.shadow ?? true;

  let templateElement: HTMLTemplateElement | null = null;
  if (typeof options.template === "string" && typeof document !== "undefined") {
    templateElement = document.createElement("template");
    templateElement.innerHTML = options.template;
  } else if (
    typeof HTMLTemplateElement !== "undefined" &&
    options.template instanceof HTMLTemplateElement
  ) {
    templateElement = options.template;
  }

  // Fallback base HTMLElement class for environments where HTMLElement is defined
  const BaseElement = (globalThis.HTMLElement ?? class {}) as unknown as typeof HTMLElement;

  class DefinedComponent extends BaseElement implements ComponentElement<E> {
    static get observedAttributes(): readonly string[] {
      return observedAttrs;
    }

    #root: ShadowRoot | this;
    #mounted = false;

    constructor() {
      super();

      if (shadowConfig !== false) {
        const init: ShadowRootInit = typeof shadowConfig === "object"
          ? shadowConfig
          : { mode: "open" };
        const shadow = this.attachShadow(init);
        this.#root = shadow;

        if (sheets.length > 0 && "adoptedStyleSheets" in shadow) {
          shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, ...sheets];
        } else if (fallbackCss.length > 0 && typeof document !== "undefined") {
          for (const css of fallbackCss) {
            const styleEl = document.createElement("style");
            styleEl.textContent = css;
            shadow.appendChild(styleEl);
          }
        }
      } else {
        this.#root = this;

        if (
          sheets.length > 0 && typeof document !== "undefined" && "adoptedStyleSheets" in document
        ) {
          const docSheets = document.adoptedStyleSheets;
          for (const sheet of sheets) {
            if (!docSheets.includes(sheet)) {
              document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
            }
          }
        } else if (fallbackCss.length > 0 && typeof document !== "undefined") {
          for (const css of fallbackCss) {
            const styleEl = document.createElement("style");
            styleEl.textContent = css;
            this.appendChild(styleEl);
          }
        }
      }

      options.onInit?.(this as unknown as ComponentElement<E>);
    }

    get root(): ShadowRoot | this {
      return this.#root;
    }

    $<T extends Element = HTMLElement>(selector: string): T | null {
      return this.#root.querySelector<T>(selector);
    }

    $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T> {
      return this.#root.querySelectorAll<T>(selector);
    }

    emit<T = unknown>(name: string, detail?: T, customInit?: CustomEventInit<T>): boolean {
      const event = new CustomEvent<T>(name, {
        bubbles: true,
        composed: true,
        detail,
        ...customInit,
      });
      return this.dispatchEvent(event);
    }

    update(detail?: unknown): void {
      options.onUpdate?.(this as unknown as ComponentElement<E>, detail);
    }

    connectedCallback(): void {
      if (!this.#mounted) {
        if (templateElement) {
          this.#root.appendChild(templateElement.content.cloneNode(true));
        } else if (typeof options.template === "function") {
          const result = options.template(this as unknown as ComponentElement<E>);
          if (typeof result === "string") {
            if (this.#root instanceof (globalThis.ShadowRoot ?? Object)) {
              this.#root.innerHTML = result;
            } else {
              this.#root.innerHTML = result;
            }
          } else if (result instanceof (globalThis.Node ?? Object)) {
            this.#root.appendChild(result);
          }
        }
        this.#mounted = true;
      }

      options.onMounted?.(this as unknown as ComponentElement<E>);
    }

    disconnectedCallback(): void {
      options.onUnmounted?.(this as unknown as ComponentElement<E>);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
      if (oldValue !== newValue) {
        const change: AttributeChange = { name, oldValue, newValue };
        options.onAttributeChanged?.(this as unknown as ComponentElement<E>, change);
        options.onUpdate?.(this as unknown as ComponentElement<E>, {
          reason: "attribute",
          ...change,
        });
      }
    }

    adoptedCallback(): void {
      options.onAdopted?.(this as unknown as ComponentElement<E>);
    }
  }

  if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
    customElements.define(tagName, DefinedComponent);
  }

  return DefinedComponent as unknown as ComponentConstructor<E>;
}
