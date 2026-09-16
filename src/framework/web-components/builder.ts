import { registerWebComponent } from "./web-component.ts";
import { raw } from "./render-html.ts";
import type {
  AttributeValue,
  RuntimeComponentElement,
  Subscribable,
  TemplateResult,
  WebComponentBuilder,
} from "./types.ts";

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
