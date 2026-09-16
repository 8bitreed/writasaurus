import {
  type AttributeValue,
  registerWebComponent,
  type RuntimeComponentElement,
} from "./create-web-component.ts";
import { raw, type TemplateResult } from "./render-html.ts";
import type { Subscribable } from "./state.ts";

export type EmptyObject = Record<never, never>;

/**
 * Standard HTML attributes and data/aria attributes available on any element,
 * along with custom attributes defined on the web component.
 */
export type HtmlAttributes = {
  class?: string;
  id?: string;
  style?: string;
  title?: string;
  slot?: string;
  hidden?: boolean;
  role?: string;
  tabindex?: number | string;
  [key: `data-${string}`]: AttributeValue | undefined;
  [key: `aria-${string}`]: AttributeValue | undefined;
};

export type ComponentAttributes<A extends Record<string, AttributeValue>> =
  & HtmlAttributes
  & {
    [K in keyof A]?: A[K];
  };
export type WebComponentElement<
  State extends Record<string, unknown>,
  Attributes extends Record<string, AttributeValue> = EmptyObject,
  Methods extends object = object,
  Computed extends object = object,
> = Omit<RuntimeComponentElement, "computed" | "observedAttribute" | "state"> & Methods & {
  readonly state: State;
  readonly observedAttribute: Readonly<Attributes>;
  readonly computed: Readonly<Computed>;
};

type Render<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
  M extends object,
  C extends object,
> = (
  element: WebComponentElement<S, A, M, C>,
) => TemplateResult;
type Hook<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
  M extends object,
  C extends object,
> = (
  element: WebComponentElement<S, A, M, C>,
) => void;

export type WebComponentBuilder<
  S extends Record<string, unknown> = EmptyObject,
  A extends Record<string, AttributeValue> = EmptyObject,
  M extends object = object,
  C extends object = object,
> = {
  defineState<N extends Record<string, unknown>>(
    value: N | (() => N),
  ): WebComponentBuilder<N, A, M, C>;
  defineObservedAttributes<N extends Record<string, AttributeValue>>(
    defaults: N,
  ): WebComponentBuilder<S, A & N, M, C>;
  defineStyles(css: string | readonly string[]): WebComponentBuilder<S, A, M, C>;
  defineShadow(shadow: boolean | ShadowRootInit): WebComponentBuilder<S, A, M, C>;
  defineProperty(name: PropertyKey, value: unknown): WebComponentBuilder<S, A, M, C>;
  defineMethod<Name extends string, Method extends (...args: never[]) => unknown>(
    name: Name,
    factory: (element: WebComponentElement<S, A, M, C>) => Method,
  ): WebComponentBuilder<S, A, M & Record<Name, Method>, C>;
  defineComputed<Name extends string, Dependencies extends readonly unknown[], Value>(
    name: Name,
    dependencies: (element: WebComponentElement<S, A, M, C>) => Dependencies,
    compute: (...dependencies: Dependencies) => Value,
  ): WebComponentBuilder<S, A, M, C & Record<Name, Value>>;
  connectedCallback(callback: Hook<S, A, M, C>): WebComponentBuilder<S, A, M, C>;
  disconnectedCallback(callback: Hook<S, A, M, C>): WebComponentBuilder<S, A, M, C>;
  subscribe(...stores: readonly Subscribable[]): WebComponentBuilder<S, A, M, C>;
  defineRender(render: Render<S, A, M, C>): WebComponentBuilder<S, A, M, C>;
  create(): (attributes?: ComponentAttributes<A>) => TemplateResult;
};

function descriptor(value: unknown): PropertyDescriptor {
  return value && typeof value === "object" &&
      ["get", "set", "value", "writable"].some((key) => Object.hasOwn(value, key))
    ? value as PropertyDescriptor
    : { configurable: true, value, writable: true };
}

export function webComponent(tagName: string): WebComponentBuilder {
  let stateFactory: () => Record<string, unknown> = () => ({});
  const observedAttributes: Record<string, AttributeValue> = {};
  const styles: string[] = [];
  const properties = new Map<PropertyKey, PropertyDescriptor>();
  const methods = new Map<
    string,
    (element: RuntimeComponentElement) => (...args: never[]) => unknown
  >();
  const computed = new Map<string, {
    dependencies: (element: RuntimeComponentElement) => readonly unknown[];
    compute: (...dependencies: never[]) => unknown;
  }>();
  let shadow: boolean | ShadowRootInit = true;
  const stores: Subscribable[] = [];
  let render: ((element: RuntimeComponentElement) => TemplateResult) | undefined;
  let connected: ((element: RuntimeComponentElement) => void) | undefined;
  let disconnected: ((element: RuntimeComponentElement) => void) | undefined;

  const builder = {
    defineState(value: Record<string, unknown> | (() => Record<string, unknown>)) {
      stateFactory = () => ({ ...(typeof value === "function" ? value() : value) });
      return builder;
    },
    defineObservedAttributes(defaults: Record<string, AttributeValue>) {
      Object.assign(observedAttributes, defaults);
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
    defineComputed(
      name: string,
      dependencies: (element: RuntimeComponentElement) => readonly unknown[],
      compute: (...dependencies: never[]) => unknown,
    ) {
      computed.set(name, { dependencies, compute });
      return builder;
    },
    connectedCallback(callback: (element: RuntimeComponentElement) => void) {
      connected = callback;
      return builder;
    },
    disconnectedCallback(callback: (element: RuntimeComponentElement) => void) {
      disconnected = callback;
      return builder;
    },
    subscribe(...incoming: readonly Subscribable[]) {
      stores.push(...incoming);
      return builder;
    },
    defineRender(next: (element: RuntimeComponentElement) => TemplateResult) {
      render = next;
      return builder;
    },
    create() {
      const res = registerWebComponent({
        tagName,
        observedAttributes,
        stateFactory,
        styles,
        shadow,
        properties,
        methods,
        computed,
        stores,
        render,
        connected,
        disconnected,
      });
      // `res` is the runtime helper function that returns a string. Wrap it with
      // `raw()` so the caller receives a TemplateResult and can interpolate the
      // element directly in templates without extra escaping.
      const helper = (attributes: Record<string, AttributeValue> = {}) => raw(res(attributes));
      return helper;
    },
  };
  return builder as unknown as WebComponentBuilder;
}
