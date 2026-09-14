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
> = Omit<RuntimeComponentElement, "state" | "observedAttribute"> & {
  readonly state: S;
  readonly observedAttribute: Readonly<A>;
};
type Render<S extends Record<string, unknown>, A extends Record<string, AttributeValue>> = (
  element: WebComponentElement<S, A>,
) => TemplateResult;
type Hook<S extends Record<string, unknown>, A extends Record<string, AttributeValue>> = (
  element: WebComponentElement<S, A>,
) => void;

export type WebComponentBuilder<
  S extends Record<string, unknown> = EmptyObject,
  A extends Record<string, AttributeValue> = EmptyObject,
> = {
  defineState<N extends Record<string, unknown>>(value: N | (() => N)): WebComponentBuilder<N, A>;
  defineObservedAttributes<N extends Record<string, AttributeValue>>(
    defaults: N,
  ): WebComponentBuilder<S, A & N>;
  defineStyles(css: string | readonly string[]): WebComponentBuilder<S, A>;
  defineShadow(shadow: boolean | ShadowRootInit): WebComponentBuilder<S, A>;
  defineProperty(name: PropertyKey, value: unknown): WebComponentBuilder<S, A>;
  connectedCallback(callback: Hook<S, A>): WebComponentBuilder<S, A>;
  disconnectedCallback(callback: Hook<S, A>): WebComponentBuilder<S, A>;
  defineRender(render: Render<S, A>): WebComponentBuilder<S, A>;
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
    build() {
      return registerWebComponent({
        tagName,
        observedAttributes: attrs,
        stateFactory,
        styles,
        shadow,
        properties,
        render,
        connected,
        disconnected,
      });
    },
  };
  return builder as unknown as WebComponentBuilder;
}
export function defineWebComponent<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
>(
  tag: string,
  definition: (builder: WebComponentBuilder) => WebComponentBuilder<S, A>,
): CustomElementConstructor {
  return definition(createWebComponentBuilder(tag)).build();
}
