import { renderHtml } from "../html/client_html_renderer.ts";
import type {
  AttributeChange,
  AttributeChangedCallback,
  ComponentConstructor,
  ComponentDefinition,
  ComponentDefinitionApi,
  ComponentElement,
  ComponentOptions,
  ComponentRender,
  ConnectedCallback,
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
      if (sheet) sheets.push(sheet);
      else fallbackCss.push(item);
    } else if (item && typeof item === "object") {
      sheets.push(item as CSSStyleSheet);
    }
  }
  return { sheets, fallbackCss };
}

interface Definition<E extends HTMLElement> {
  readonly observedAttributes: string[];
  readonly attributeDefaults: Map<string, string>;
  readonly properties: Map<PropertyKey, PropertyDescriptor>;
  render?: ComponentRender<E>;
  connected?: ConnectedCallback<E>;
  disconnected?: ConnectedCallback<E>;
  adopted?: ConnectedCallback<E>;
  attributeChanged?: AttributeChangedCallback<E>;
  shadow?: boolean | ShadowRootInit;
  styles: StyleValue[];
}

const RESERVED_PROPERTY_NAMES = new Set([
  "constructor",
  "root",
  "observedAttribute",
  "$",
  "$$",
  "emit",
  "render",
  "update",
  "connectedCallback",
  "disconnectedCallback",
  "adoptedCallback",
  "attributeChangedCallback",
]);

/**
 * Defines and registers a lightweight custom element.
 *
 * The callback form provides declarative lifecycle registration, observed
 * attributes, and renderer-backed updates. The legacy object form remains
 * supported for existing components.
 */
export function component<E extends HTMLElement = HTMLElement>(
  tagName: string,
  definition: ComponentDefinition<E>,
): ComponentConstructor<E>;
export function component<E extends HTMLElement = HTMLElement>(
  tagName: string,
  options?: ComponentOptions<E>,
): ComponentConstructor<E>;
export function component<E extends HTMLElement = HTMLElement>(
  tagName: string,
  config: ComponentOptions<E> | ComponentDefinition<E> = {},
): ComponentConstructor<E> {
  if (typeof customElements !== "undefined") {
    const existing = customElements.get(tagName);
    if (existing) return existing as unknown as ComponentConstructor<E>;
  }

  const options = typeof config === "function" ? {} : config;
  const definition: Definition<E> = {
    observedAttributes: [...(options.observedAttributes ?? [])],
    attributeDefaults: new Map(),
    properties: new Map(),
    styles: [],
  };
  let activeElement: ComponentElement<E> | null = null;

  const withActiveElement = <T>(callback: (element: ComponentElement<E>) => T): T => {
    if (!activeElement) {
      throw new Error(
        "Component helpers are only available while a lifecycle callback is running.",
      );
    }
    return callback(activeElement);
  };

  if (typeof config === "function") {
    const api: ComponentDefinitionApi<E> = {
      get observedAttributes() {
        return definition.observedAttributes;
      },
      render: () => withActiveElement((element) => element.render()),
      $: (selector) => withActiveElement((element) => element.$(selector)),
      $$: (selector) => withActiveElement((element) => element.$$(selector)),
      connectedCallback: (callback) => {
        definition.connected = callback;
      },
      disconnectedCallback: (callback) => {
        definition.disconnected = callback;
      },
      adoptedCallback: (callback) => {
        definition.adopted = callback;
      },
      attributeChangedCallback: (callback) => {
        definition.attributeChanged = callback;
      },
      defineShadow: (shadow) => {
        definition.shadow = shadow;
      },
      defineStyles: (styles) => {
        definition.styles.push(...(Array.isArray(styles) ? styles : [styles]));
      },
      defineProperty: (name, value) => {
        if (typeof name === "string" && RESERVED_PROPERTY_NAMES.has(name)) {
          throw new Error(`Cannot redefine component property "${name}".`);
        }
        definition.properties.set(name, { configurable: true, value, writable: true });
      },
      defineObservedAttribute: (name, defaultValue) => {
        if (!definition.observedAttributes.includes(name)) definition.observedAttributes.push(name);
        definition.attributeDefaults.set(name, defaultValue);
      },
      defineRender: (render) => {
        definition.render = render;
      },
    };
    config(api);
  }

  const optionStyles = processStyles(options.style);
  const definedStyles = processStyles(definition.styles);
  const sheets = [...optionStyles.sheets, ...definedStyles.sheets];
  const fallbackCss = [...optionStyles.fallbackCss, ...definedStyles.fallbackCss];
  const observedAttrs = Object.freeze([...definition.observedAttributes]);
  const shadowConfig = definition.shadow ?? options.shadow ?? true;

  let templateElement: HTMLTemplateElement | null = null;
  if (typeof options.template === "string" && typeof document !== "undefined") {
    templateElement = document.createElement("template");
    templateElement.innerHTML = options.template;
  } else if (
    typeof HTMLTemplateElement !== "undefined" && options.template instanceof HTMLTemplateElement
  ) {
    templateElement = options.template;
  }

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
            const style = document.createElement("style");
            style.textContent = css;
            shadow.appendChild(style);
          }
        }
      } else {
        this.#root = this;
        if (
          sheets.length > 0 && typeof document !== "undefined" && "adoptedStyleSheets" in document
        ) {
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
        } else if (fallbackCss.length > 0 && typeof document !== "undefined") {
          for (const css of fallbackCss) {
            const style = document.createElement("style");
            style.textContent = css;
            this.appendChild(style);
          }
        }
      }

      for (const [name, value] of definition.attributeDefaults) {
        if (!this.hasAttribute(name)) this.setAttribute(name, value);
      }
      options.onInit?.(this as unknown as ComponentElement<E>);
    }

    get root(): ShadowRoot | this {
      return this.#root;
    }

    get observedAttribute(): Readonly<Record<string, string | null>> {
      return new Proxy({} as Record<string, string | null>, {
        get: (_target, property) =>
          typeof property === "string" ? this.getAttribute(property) : undefined,
      });
    }

    $<T extends Element = HTMLElement>(selector: string): T | null {
      return this.#root.querySelector<T>(selector);
    }

    $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T> {
      return this.#root.querySelectorAll<T>(selector);
    }

    emit<T = unknown>(name: string, detail?: T, customInit?: CustomEventInit<T>): boolean {
      return this.dispatchEvent(
        new CustomEvent<T>(name, {
          bubbles: true,
          composed: true,
          detail,
          ...customInit,
        }),
      );
    }

    render(): void {
      if (!definition.render) return;
      renderHtml(definition.render(this as unknown as ComponentElement<E>), this.#root);
    }

    update(detail?: unknown): void {
      this.render();
      options.onUpdate?.(this as unknown as ComponentElement<E>, detail);
    }

    #run<T>(callback: (element: ComponentElement<E>) => T): T {
      const previous = activeElement;
      activeElement = this as unknown as ComponentElement<E>;
      try {
        return callback(activeElement);
      } finally {
        activeElement = previous;
      }
    }

    connectedCallback(): void {
      if (!this.#mounted) {
        if (templateElement) this.#root.appendChild(templateElement.content.cloneNode(true));
        else if (typeof options.template === "function") {
          const result = options.template(this as unknown as ComponentElement<E>);
          if (typeof result === "string") this.#root.innerHTML = result;
          else if (result instanceof (globalThis.Node ?? Object)) this.#root.appendChild(result);
        }
        this.#mounted = true;
      }
      this.render();
      if (definition.connected) this.#run(definition.connected);
      options.onMounted?.(this as unknown as ComponentElement<E>);
    }

    disconnectedCallback(): void {
      if (definition.disconnected) this.#run(definition.disconnected);
      options.onUnmounted?.(this as unknown as ComponentElement<E>);
    }

    adoptedCallback(): void {
      if (definition.adopted) this.#run(definition.adopted);
      options.onAdopted?.(this as unknown as ComponentElement<E>);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
      if (oldValue === newValue) return;
      const change: AttributeChange = { name, oldValue, newValue };
      if (definition.attributeChanged) {
        this.#run((element) => definition.attributeChanged!(element, change));
      }
      options.onAttributeChanged?.(this as unknown as ComponentElement<E>, change);
      if (this.#mounted) this.render();
      options.onUpdate?.(this as unknown as ComponentElement<E>, {
        reason: "attribute",
        ...change,
      });
    }
  }

  for (const [name, descriptor] of definition.properties) {
    Object.defineProperty(DefinedComponent.prototype, name, descriptor);
  }

  if (typeof customElements !== "undefined") customElements.define(tagName, DefinedComponent);
  return DefinedComponent as unknown as ComponentConstructor<E>;
}
