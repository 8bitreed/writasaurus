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
  ComponentSchema,
  ComponentSetup,
  ComponentSetupApi,
  ConnectedCallback,
  ObservedAttributeSchema,
  ObservedAttributeValue,
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

function isReactiveStateObject(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
}

function parseObservedAttribute(
  value: string | null,
  defaultValue: ObservedAttributeValue | undefined,
): ObservedAttributeValue | null {
  if (defaultValue === undefined) return value;
  if (value === null) return defaultValue;
  if (typeof defaultValue === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : defaultValue;
  }
  if (typeof defaultValue === "boolean") return value !== "false";
  return value;
}

function isPropertyDescriptor(value: unknown): value is PropertyDescriptor {
  if (value === null || typeof value !== "object") return false;
  return ["configurable", "enumerable", "get", "set", "value", "writable"].some((key) =>
    Object.hasOwn(value, key)
  );
}

function createReactiveState(
  initialState: Record<string, unknown>,
  onChange: () => void,
): Record<string, unknown> {
  const proxies = new WeakMap<object, object>();

  const wrap = <Value>(value: Value): Value => {
    if (!isReactiveStateObject(value)) return value;
    const existing = proxies.get(value);
    if (existing) return existing as Value;

    const proxy = new Proxy(value, {
      get(target, property, receiver) {
        return wrap(Reflect.get(target, property, receiver));
      },
      set(target, property, nextValue) {
        const previousValue = Reflect.get(target, property);
        const updated = Reflect.set(target, property, nextValue);
        if (updated && !Object.is(previousValue, nextValue)) onChange();
        return updated;
      },
      deleteProperty(target, property) {
        const deleted = Reflect.deleteProperty(target, property);
        if (deleted) onChange();
        return deleted;
      },
    });
    proxies.set(value, proxy);
    return proxy as Value;
  };

  return wrap(initialState);
}

interface Definition<E extends HTMLElement> {
  readonly observedAttributes: string[];
  readonly attributeDefaults: Map<string, ObservedAttributeValue>;
  readonly properties: Map<PropertyKey, PropertyDescriptor>;
  createState: () => Record<string, unknown>;
  render?: ComponentRender<E>;
  connected?: ConnectedCallback<E>;
  disconnected?: ConnectedCallback<E>;
  adopted?: ConnectedCallback<E>;
  attributeChanged?: AttributeChangedCallback<E>;
  shadow?: boolean | ShadowRootInit;
  styles: StyleValue[];
  setup?: ComponentSetup<E>;
}

const RESERVED_PROPERTY_NAMES = new Set([
  "constructor",
  "root",
  "state",
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
export function defineWebComponent<
  Attributes extends ObservedAttributeSchema,
  E extends HTMLElement = HTMLElement,
>(
  tagName: string,
  schema: ComponentSchema<Attributes>,
  setup: ComponentSetup<E, Attributes>,
): ComponentConstructor<E, Attributes>;

export function defineWebComponent<E extends HTMLElement = HTMLElement>(
  tagName: string,
  definition: ComponentDefinition<E>,
): ComponentConstructor<E>;
export function defineWebComponent<E extends HTMLElement = HTMLElement>(
  tagName: string,
  options?: ComponentOptions<E>,
): ComponentConstructor<E>;
export function defineWebComponent<E extends HTMLElement = HTMLElement>(
  tagName: string,
  schemaOrConfig:
    | ComponentOptions<E>
    | ComponentDefinition<E>
    | ComponentSchema<ObservedAttributeSchema> = {},
  instanceSetup?: ComponentSetup<E>,
): ComponentConstructor<E> {
  if (typeof customElements !== "undefined") {
    const existing = customElements.get(tagName);
    if (existing) return existing as unknown as ComponentConstructor<E>;
  }

  const schema = instanceSetup
    ? schemaOrConfig as ComponentSchema<ObservedAttributeSchema>
    : undefined;
  const definitionCallback = !instanceSetup && typeof schemaOrConfig === "function"
    ? schemaOrConfig
    : undefined;
  const options: ComponentOptions<E> = schema || typeof schemaOrConfig === "function"
    ? {}
    : schemaOrConfig as ComponentOptions<E>;
  const definition: Definition<E> = {
    observedAttributes: schema
      ? Object.keys(schema.observedAttributes ?? {})
      : [...(options.observedAttributes ?? [])],
    attributeDefaults: new Map(schema ? Object.entries(schema.observedAttributes ?? {}) : []),
    properties: new Map(),
    createState: () => ({}),
    styles: [],
    setup: instanceSetup,
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

  if (definitionCallback) {
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
        definition.properties.set(
          name,
          isPropertyDescriptor(value) ? value : { configurable: true, value, writable: true },
        );
      },
      defineState: (initialState) => {
        if (typeof initialState === "function") {
          definition.createState = () => ({ ...initialState() });
        } else {
          definition.createState = () => ({ ...initialState });
        }
      },
      defineObservedAttribute: (name, defaultValue) => {
        if (!definition.observedAttributes.includes(name)) definition.observedAttributes.push(name);
        definition.attributeDefaults.set(name, defaultValue);
      },
      defineRender: (render) => {
        definition.render = render;
      },
    };
    definitionCallback(api);
  }

  const optionStyles = processStyles(schema?.style ?? options.style);
  const definedStyles = processStyles(definition.styles);
  const sheets = [...optionStyles.sheets, ...definedStyles.sheets];
  const fallbackCss = [...optionStyles.fallbackCss, ...definedStyles.fallbackCss];
  const observedAttrs = Object.freeze([...definition.observedAttributes]);
  const shadowConfig = definition.shadow ?? schema?.shadow ?? options.shadow ?? true;

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
    #state: Record<string, unknown>;
    #render?: ComponentRender<E>;
    #connected?: ConnectedCallback<E>;
    #disconnected?: ConnectedCallback<E>;
    #adopted?: ConnectedCallback<E>;
    #attributeChanged?: AttributeChangedCallback<E>;

    constructor() {
      super();
      this.#state = this.#reactiveState(definition.createState());
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

      this.#configureInstance();
      options.onInit?.(this as unknown as ComponentElement<E>);
    }

    #reactiveState(initialState: Record<string, unknown>): Record<string, unknown> {
      return createReactiveState(initialState, () => {
        if (this.#mounted) this.render();
      });
    }

    #configureInstance(): void {
      if (!definition.setup) return;
      const api: ComponentSetupApi<E> = {
        render: () => this.render(),
        $: (selector) => this.$(selector),
        $$: (selector) => this.$$(selector),
        connectedCallback: (callback) => this.#connected = callback,
        disconnectedCallback: (callback) => this.#disconnected = callback,
        adoptedCallback: (callback) => this.#adopted = callback,
        attributeChangedCallback: (callback) => this.#attributeChanged = callback,
        defineProperty: (name, value) => {
          if (typeof name === "string" && RESERVED_PROPERTY_NAMES.has(name)) {
            throw new Error(`Cannot redefine component property "${name}".`);
          }
          Object.defineProperty(
            this,
            name,
            isPropertyDescriptor(value) ? value : { configurable: true, value, writable: true },
          );
        },
        defineState: (initialState) => {
          const value = typeof initialState === "function" ? initialState() : initialState;
          this.#state = this.#reactiveState(value);
          return this.#state as typeof value;
        },
        defineRender: (render) => this.#render = render,
      };
      definition.setup(this as unknown as ComponentElement<E>, api);
    }

    get root(): ShadowRoot | this {
      return this.#root;
    }

    get state(): Record<string, unknown> {
      return this.#state;
    }

    get observedAttribute(): Readonly<Record<string, ObservedAttributeValue | null>> {
      return new Proxy({} as Record<string, string | null>, {
        get: (_target, property) => {
          if (typeof property !== "string") return undefined;
          return parseObservedAttribute(
            this.getAttribute(property),
            definition.attributeDefaults.get(property),
          );
        },
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
      const render = this.#render ?? definition.render;
      if (!render) return;
      renderHtml(render(this as unknown as ComponentElement<E>), this.#root);
      if (typeof customElements !== "undefined") customElements.upgrade(this.#root);
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
        for (const [name, value] of definition.attributeDefaults) {
          if (!this.hasAttribute(name)) this.setAttribute(name, String(value));
        }
        if (templateElement) this.#root.appendChild(templateElement.content.cloneNode(true));
        else if (typeof options.template === "function") {
          const result = options.template(this as unknown as ComponentElement<E>);
          if (typeof result === "string") this.#root.innerHTML = result;
          else if (result instanceof (globalThis.Node ?? Object)) this.#root.appendChild(result);
        }
        this.#mounted = true;
      }
      this.render();
      if (this.#connected) this.#run(this.#connected);
      if (definition.connected) this.#run(definition.connected);
      options.onMounted?.(this as unknown as ComponentElement<E>);
    }

    disconnectedCallback(): void {
      if (this.#disconnected) this.#run(this.#disconnected);
      if (definition.disconnected) this.#run(definition.disconnected);
      options.onUnmounted?.(this as unknown as ComponentElement<E>);
    }

    adoptedCallback(): void {
      if (this.#adopted) this.#run(this.#adopted);
      if (definition.adopted) this.#run(definition.adopted);
      options.onAdopted?.(this as unknown as ComponentElement<E>);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
      if (oldValue === newValue) return;
      const change: AttributeChange = { name, oldValue, newValue };
      if (this.#attributeChanged) {
        this.#run((element) => this.#attributeChanged!(element, change));
      }
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
