import { renderHtml, type TemplateResult } from "./render-html.ts";

export type AttributeValue = string | number | boolean;

export interface RuntimeComponentElement extends HTMLElement {
  readonly root: ShadowRoot;
  readonly state: Record<string, unknown>;
  readonly observedAttribute: Readonly<Record<string, AttributeValue>>;
  render(): void;
}

export interface WebComponentDefinition {
  tagName: string;
  observedAttributes: Readonly<Record<string, AttributeValue>>;
  stateFactory: () => Record<string, unknown>;
  styles: readonly string[];
  render?: (element: RuntimeComponentElement) => TemplateResult;
}

function createReactiveState(
  state: Record<string, unknown>,
  render: () => void,
): Record<string, unknown> {
  return new Proxy(state, {
    set(target, property, value) {
      const previous = Reflect.get(target, property);
      const updated = Reflect.set(target, property, value);
      if (updated && !Object.is(previous, value)) render();
      return updated;
    },
    deleteProperty(target, property) {
      const deleted = Reflect.deleteProperty(target, property);
      if (deleted) render();
      return deleted;
    },
  });
}

function parseAttribute(value: string | null, fallback: AttributeValue): AttributeValue {
  if (value === null) return fallback;
  if (typeof fallback === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  if (typeof fallback === "boolean") return value !== "false";
  return value;
}

function createStyleSheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === "undefined" || !("replaceSync" in CSSStyleSheet.prototype)) {
    return null;
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

/** Registers a browser custom element from a fully collected builder definition. */
export function registerWebComponent(definition: WebComponentDefinition): CustomElementConstructor {
  const existing = customElements.get(definition.tagName);
  if (existing) return existing;

  const observedAttributes = Object.freeze(Object.keys(definition.observedAttributes));
  const sheets = definition.styles.map(createStyleSheet).filter((sheet): sheet is CSSStyleSheet =>
    sheet !== null
  );

  class DefinedWebComponent extends HTMLElement implements RuntimeComponentElement {
    static get observedAttributes(): readonly string[] {
      return observedAttributes;
    }

    readonly root: ShadowRoot;
    readonly state: Record<string, unknown>;
    #mounted = false;

    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
      if (sheets.length > 0) this.root.adoptedStyleSheets = sheets;
      else {
        for (const css of definition.styles) {
          const style = document.createElement("style");
          style.textContent = css;
          this.root.append(style);
        }
      }
      this.state = createReactiveState({ ...definition.stateFactory() }, () => {
        if (this.#mounted) this.render();
      });
    }

    get observedAttribute(): Readonly<Record<string, AttributeValue>> {
      return new Proxy({} as Record<string, AttributeValue>, {
        get: (_target, property) => {
          if (typeof property !== "string") return undefined;
          const fallback = definition.observedAttributes[property];
          return fallback === undefined
            ? this.getAttribute(property) ?? ""
            : parseAttribute(this.getAttribute(property), fallback);
        },
      });
    }

    render(): void {
      if (definition.render) renderHtml(definition.render(this), this.root);
    }

    connectedCallback(): void {
      if (!this.#mounted) {
        for (const [name, defaultValue] of Object.entries(definition.observedAttributes)) {
          if (!this.hasAttribute(name)) this.setAttribute(name, String(defaultValue));
        }
        this.#mounted = true;
      }
      this.render();
    }

    attributeChangedCallback(
      _name: string,
      oldValue: string | null,
      newValue: string | null,
    ): void {
      if (this.#mounted && oldValue !== newValue) this.render();
    }
  }

  customElements.define(definition.tagName, DefinedWebComponent);
  return DefinedWebComponent;
}
