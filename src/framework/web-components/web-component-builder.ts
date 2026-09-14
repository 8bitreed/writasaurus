import {
  type AttributeValue,
  registerWebComponent,
  type RuntimeComponentElement,
} from "./create-web-component.ts";
import type { TemplateResult } from "../html/client_html_renderer.ts";

export type EmptyObject = Record<PropertyKey, never>;
export type WebComponentElement<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue> = EmptyObject,
  Methods extends object = object,
> = Omit<RuntimeComponentElement, "state" | "observedAttribute"> & Methods & {
  readonly state: S;
  readonly observedAttribute: Readonly<A>;
};
type Render<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
  Methods extends object,
> = (
  element: WebComponentElement<S, A, Methods>,
) => TemplateResult;
type Hook<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
  Methods extends object,
> = (
  element: WebComponentElement<S, A, Methods>,
) => void;

export type WebComponentBuilder<
  S extends Record<string, unknown> = EmptyObject,
  A extends Record<string, AttributeValue> = EmptyObject,
  Methods extends object = object,
> = {
  defineState<N extends Record<string, unknown>>(
    value: N | (() => N),
  ): WebComponentBuilder<N, A, Methods>;
  defineObservedAttributes<N extends Record<string, AttributeValue>>(
    defaults: N,
  ): WebComponentBuilder<S, A & N, Methods>;
  defineStyles(css: string | readonly string[]): WebComponentBuilder<S, A, Methods>;
  defineShadow(shadow: boolean | ShadowRootInit): WebComponentBuilder<S, A, Methods>;
  defineProperty(name: PropertyKey, value: unknown): WebComponentBuilder<S, A, Methods>;
  defineMethod<Name extends string, Method extends (...args: never[]) => unknown>(
    name: Name,
    factory: (element: WebComponentElement<S, A, Methods>) => Method,
  ): WebComponentBuilder<S, A, Methods & Record<Name, Method>>;
  connectedCallback(callback: Hook<S, A, Methods>): WebComponentBuilder<S, A, Methods>;
  disconnectedCallback(callback: Hook<S, A, Methods>): WebComponentBuilder<S, A, Methods>;
  defineRender(render: Render<S, A, Methods>): WebComponentBuilder<S, A, Methods>;
  /** Registers the collected custom-element definition. */
  define(): CustomElementConstructor;
  /** @deprecated Use `define()` instead. */
  build(): CustomElementConstructor;
};

function descriptor(value: unknown): PropertyDescriptor {
  return value && typeof value === "object" &&
      ["get", "set", "value", "writable"].some((key) => Object.hasOwn(value, key))
    ? value as PropertyDescriptor
    : { configurable: true, value, writable: true };
}
export function createWebComponentBuilder(tagName: string): WebComponentBuilder {
  let stateFactory: () => Record<string, unknown> = () => ({});
  const attrs: Record<string, AttributeValue> = {};
  const styles: string[] = [];
  const properties = new Map<PropertyKey, PropertyDescriptor>();
  const methods = new Map<
    string,
    (element: RuntimeComponentElement) => (...args: never[]) => unknown
  >();
  let shadow: boolean | ShadowRootInit = true;
  let render: ((e: RuntimeComponentElement) => TemplateResult) | undefined;
  let connected: ((e: RuntimeComponentElement) => void) | undefined;
  let disconnected: ((e: RuntimeComponentElement) => void) | undefined;
  const builder = {
    defineState(value: Record<string, unknown> | (() => Record<string, unknown>)) {
      stateFactory = () => ({ ...(typeof value === "function" ? value() : value) });
      return builder;
    },
    defineObservedAttributes(defaults: Record<string, AttributeValue>) {
      Object.assign(attrs, defaults);
      return builder;
    },
    defineStyles(css: string | readonly string[]) {
      styles.push(...(Array.isArray(css) ? css : [css]));
      return builder;
    },
    defineShadow(value: boolean | ShadowRootInit) {
      shadow = value;
      return builder;
    },
    defineProperty(name: PropertyKey, value: unknown) {
      properties.set(name, descriptor(value));
      return builder;
    },
    defineMethod(
      name: string,
      factory: (element: RuntimeComponentElement) => (...args: never[]) => unknown,
    ) {
      methods.set(name, factory);
      return builder;
    },
    connectedCallback(callback: (e: RuntimeComponentElement) => void) {
      connected = callback;
      return builder;
    },
    disconnectedCallback(callback: (e: RuntimeComponentElement) => void) {
      disconnected = callback;
      return builder;
    },
    defineRender(next: (e: RuntimeComponentElement) => TemplateResult) {
      render = next;
      return builder;
    },
    define() {
      return registerWebComponent({
        tagName,
        observedAttributes: attrs,
        stateFactory,
        styles,
        shadow,
        properties,
        methods,
        render,
        connected,
        disconnected,
      });
    },
    build() {
      return builder.define();
    },
  };
  return builder as unknown as WebComponentBuilder;
}

/** Starts a fluent custom-element definition. */
export function createWebComponent(tagName: string): WebComponentBuilder {
  return createWebComponentBuilder(tagName);
}
export function defineWebComponent<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
>(
  tag: string,
  definition: (builder: WebComponentBuilder) => WebComponentBuilder<S, A>,
): CustomElementConstructor {
  return definition(createWebComponent(tag)).define();
}
