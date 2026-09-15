import { renderHtml, type TemplateResult } from "./render-html.ts";

export type AttributeValue = string | number | boolean | null;
export type ComponentRoot = ShadowRoot | HTMLElement;

export interface RuntimeComponentElement extends HTMLElement {
  readonly root: ComponentRoot;
  readonly state: Record<string, unknown>;
  readonly observedAttribute: Readonly<Record<string, AttributeValue>>;
  readonly computed: Readonly<Record<string, unknown>>;
  render(): void;
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T>;
  emit<T>(name: string, detail?: T, options?: CustomEventInit<T>): boolean;
}

export interface WebComponentDefinition {
  tagName: string;
  observedAttributes: Readonly<Record<string, AttributeValue>>;
  stateFactory: () => Record<string, unknown>;
  styles: readonly string[];
  shadow: boolean | ShadowRootInit;
  properties: ReadonlyMap<PropertyKey, PropertyDescriptor>;
  methods: ReadonlyMap<string, (element: RuntimeComponentElement) => (...args: never[]) => unknown>;
  computed: ReadonlyMap<string, {
    dependencies: (element: RuntimeComponentElement) => readonly unknown[];
    compute: (...dependencies: never[]) => unknown;
  }>;
  render?: (element: RuntimeComponentElement) => TemplateResult;
  connected?: (element: RuntimeComponentElement) => void;
  disconnected?: (element: RuntimeComponentElement) => void;
}

function reactive(state: Record<string, unknown>, notify: () => void): Record<string, unknown> {
  return new Proxy(state, {
    set(t, p, v) {
      const old = Reflect.get(t, p);
      const ok = Reflect.set(t, p, v);
      if (ok && !Object.is(old, v)) notify();
      return ok;
    },
    deleteProperty(t, p) {
      const ok = Reflect.deleteProperty(t, p);
      if (ok) notify();
      return ok;
    },
  });
}
function parse(value: string | null, fallback: AttributeValue): AttributeValue {
  if (value === null) return fallback;
  if (typeof fallback === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return typeof fallback === "boolean" ? value !== "false" : value;
}
function sheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === "undefined" || !("replaceSync" in CSSStyleSheet.prototype)) {
    return null;
  }
  const result = new CSSStyleSheet();
  result.replaceSync(css);
  return result;
}

export function registerWebComponent(definition: WebComponentDefinition): CustomElementConstructor {
  const existing = customElements.get(definition.tagName);
  if (existing) return existing;
  const observed = Object.freeze(Object.keys(definition.observedAttributes));
  const sheets = definition.styles.map(sheet).filter((value): value is CSSStyleSheet =>
    value !== null
  );
  class DefinedWebComponent extends HTMLElement implements RuntimeComponentElement {
    static get observedAttributes(): readonly string[] {
      return observed;
    }
    readonly root: ComponentRoot;
    readonly state: Record<string, unknown>;
    readonly computed: Readonly<Record<string, unknown>>;
    #mounted = false;
    constructor() {
      super();
      this.root = definition.shadow === false ? this : this.attachShadow(
        typeof definition.shadow === "object" ? definition.shadow : { mode: "open" },
      );
      if (sheets.length && this.root instanceof ShadowRoot) this.root.adoptedStyleSheets = sheets;
      else {for (const css of definition.styles) {
          const style = document.createElement("style");
          style.textContent = css;
          this.root.append(style);
        }}
      this.state = reactive({ ...definition.stateFactory() }, () => {
        if (this.#mounted) this.render();
      });
      for (const [name, factory] of definition.methods) {
        Object.defineProperty(this, name, {
          configurable: true,
          value: factory(this),
          writable: true,
        });
      }
      const computed: Record<string, unknown> = {};
      for (const [name, computedDefinition] of definition.computed) {
        let dependencies: readonly unknown[] | undefined;
        let value: unknown;
        Object.defineProperty(computed, name, {
          enumerable: true,
          get: () => {
            const next = computedDefinition.dependencies(this);
            if (
              !dependencies || next.length !== dependencies.length ||
              next.some((item, index) => !Object.is(item, dependencies![index]))
            ) {
              dependencies = [...next];
              value = computedDefinition.compute(...next as never[]);
            }
            return value;
          },
        });
      }
      this.computed = computed;
    }
    get observedAttribute(): Readonly<Record<string, AttributeValue>> {
      return new Proxy({} as Record<string, AttributeValue>, {
        get: (_t, p) => {
          if (typeof p !== "string") return undefined;
          if (!Object.hasOwn(definition.observedAttributes, p)) {
            return this.getAttribute(p) ?? "";
          }
          return parse(this.getAttribute(p), definition.observedAttributes[p]);
        },
      });
    }
    $<T extends Element = HTMLElement>(selector: string): T | null {
      return this.root.querySelector<T>(selector);
    }
    $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T> {
      return this.root.querySelectorAll<T>(selector);
    }
    emit<T>(name: string, detail?: T, options?: CustomEventInit<T>): boolean {
      return this.dispatchEvent(
        new CustomEvent(name, { bubbles: true, composed: true, detail, ...options }),
      );
    }
    render(): void {
      if (definition.render) renderHtml(definition.render(this), this.root);
    }
    connectedCallback(): void {
      if (!this.#mounted) {
        for (const [n, v] of Object.entries(definition.observedAttributes)) {
          if (!this.hasAttribute(n) && v !== null) this.setAttribute(n, String(v));
        }
        this.#mounted = true;
      }
      this.render();
      definition.connected?.(this);
    }
    disconnectedCallback(): void {
      definition.disconnected?.(this);
    }
    attributeChangedCallback(_n: string, old: string | null, next: string | null): void {
      if (this.#mounted && old !== next) this.render();
    }
  }
  for (const [name, descriptor] of definition.properties) {
    Object.defineProperty(DefinedWebComponent.prototype, name, descriptor);
  }
  customElements.define(definition.tagName, DefinedWebComponent);
  return DefinedWebComponent;
}
