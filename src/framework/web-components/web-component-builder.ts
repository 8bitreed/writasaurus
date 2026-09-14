import {
  type AttributeValue,
  registerWebComponent,
  type RuntimeComponentElement,
} from "./create-web-component.ts";
import type { TemplateResult } from "../html/client_html_renderer.ts";

export type EmptyObject = Record<PropertyKey, never>;

export type WebComponentElement<
  State extends Record<string, unknown>,
  Attributes extends Record<string, AttributeValue> = EmptyObject,
> = Omit<RuntimeComponentElement, "observedAttribute" | "state"> & {
  readonly state: State;
  readonly observedAttribute: Readonly<Attributes>;
};

export type WebComponentBuilder<
  State extends Record<string, unknown> = EmptyObject,
  Attributes extends Record<string, AttributeValue> = EmptyObject,
> = {
  defineState<NextState extends Record<string, unknown>>(
    initialState: NextState | (() => NextState),
  ): WebComponentBuilder<NextState, Attributes>;
  defineObservedAttributes<NextAttributes extends Record<string, AttributeValue>>(
    defaults: NextAttributes,
  ): WebComponentBuilder<State, Attributes & NextAttributes>;
  defineStyles(css: string | readonly string[]): WebComponentBuilder<State, Attributes>;
  defineRender(
    render: (element: WebComponentElement<State, Attributes>) => TemplateResult,
  ): WebComponentBuilder<State, Attributes>;
  build(): CustomElementConstructor;
};

export function createWebComponentBuilder(tagName: string): WebComponentBuilder {
  let stateFactory: () => Record<string, unknown> = () => ({});
  const observedAttributes: Record<string, AttributeValue> = {};
  const styles: string[] = [];
  let render: ((element: RuntimeComponentElement) => TemplateResult) | undefined;

  const builder = {
    defineState(initialState: Record<string, unknown> | (() => Record<string, unknown>)) {
      stateFactory = () => {
        const state = typeof initialState === "function" ? initialState() : initialState;
        return { ...state };
      };
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
    defineRender(nextRender: (element: RuntimeComponentElement) => TemplateResult) {
      render = nextRender as unknown as (element: RuntimeComponentElement) => TemplateResult;
      return builder;
    },
    build() {
      return registerWebComponent({ tagName, observedAttributes, stateFactory, styles, render });
    },
  };

  return builder as unknown as WebComponentBuilder;
}

export function defineWebComponent<
  State extends Record<string, unknown>,
  Attributes extends Record<string, AttributeValue>,
>(
  tagName: string,
  definition: (builder: WebComponentBuilder) => WebComponentBuilder<State, Attributes>,
): CustomElementConstructor {
  return definition(createWebComponentBuilder(tagName)).build();
}
