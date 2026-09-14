import type { TemplateResult } from "../html/client_html_renderer.ts";

export interface AttributeChange {
  name: string;
  oldValue: string | null;
  newValue: string | null;
}

export type ObservedAttributeValue = string | number | boolean;
export type ObservedAttributeSchema = Record<string, ObservedAttributeValue>;

type ObservedAttributeValues<Attributes extends Record<string, ObservedAttributeValue | null>> =
  Readonly<Record<string, ObservedAttributeValue | null> & Attributes>;

export type TemplateFactory<E extends HTMLElement = HTMLElement> = (
  element: ComponentElement<E>,
) => string | Node;

export type TemplateValue<E extends HTMLElement = HTMLElement> =
  | string
  | HTMLTemplateElement
  | TemplateFactory<E>;

export type StyleValue = string | CSSStyleSheet;

export interface ComponentElement<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> extends HTMLElement {
  readonly root: ShadowRoot | this;
  /**
   * Mutable per-instance component state. Defaults to an empty object.
   * Mutating plain-object or array state re-renders the component after mount.
   */
  readonly state: Record<string, unknown>;
  /** Current values of attributes declared with `defineObservedAttribute`. */
  readonly observedAttribute: ObservedAttributeValues<Attributes>;
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T>;
  emit<T = unknown>(name: string, detail?: T, options?: CustomEventInit<T>): boolean;
  /** Re-renders a component declared with `defineRender`, then invokes legacy `onUpdate`. */
  update(detail?: unknown): void;
  /** Re-renders a component declared with `defineRender`. */
  render(): void;
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  adoptedCallback?(): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
}

export type ComponentConstructor<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = {
  new (): ComponentElement<E, Attributes>;
  readonly observedAttributes: readonly string[];
  prototype: ComponentElement<E, Attributes>;
};

export type ComponentRender<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = (
  element: ComponentElement<E, Attributes>,
) => TemplateResult;

export type ConnectedCallback<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = (
  element: ComponentElement<E, Attributes>,
) => void;
export type DisconnectedCallback<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = ConnectedCallback<E, Attributes>;
export type AdoptedCallback<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = ConnectedCallback<E, Attributes>;
export type AttributeChangedCallback<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = (
  element: ComponentElement<E, Attributes>,
  change: AttributeChange,
) => void;

/**
 * Registration helpers passed to the callback form of `defineWebComponent`.
 *
 * The helpers `render`, `$`, and `$$` are bound to the element currently
 * executing a lifecycle callback, so lifecycle functions may use the concise
 * closure style shown below:
 *
 * ```ts
 * defineWebComponent("user-card", ({ connectedCallback, $, defineRender }) => {
 *   connectedCallback(() => $("button")?.focus());
 *   defineRender((element) => html`<button>${element.observedAttribute.name}</button>`);
 * });
 * ```
 */
export interface ComponentDefinitionApi<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> {
  readonly observedAttributes: readonly string[];
  render(): void;
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T>;
  connectedCallback(callback: ConnectedCallback<E, Attributes>): void;
  disconnectedCallback(callback: DisconnectedCallback<E, Attributes>): void;
  adoptedCallback(callback: AdoptedCallback<E, Attributes>): void;
  attributeChangedCallback(callback: AttributeChangedCallback<E, Attributes>): void;
  /** Configures the component's shadow root. Defaults to an open shadow root. */
  defineShadow(shadow: boolean | ShadowRootInit): void;
  /** Adds styles adopted by the component's shadow root. */
  defineStyles(styles: StyleValue | readonly StyleValue[]): void;
  /**
   * Adds a regular method or property to the custom element's prototype.
   * Lifecycle callback names remain managed by their corresponding
   * registration helpers.
   */
  defineProperty(name: PropertyKey, value: unknown): void;
  /**
   * Sets the initial mutable state for each element instance. Without this
   * call, every element receives its own empty state object. State mutations
   * re-render after mount. Pass a factory for nested or computed state.
   */
  defineState(
    initialState?: Record<string, unknown> | (() => Record<string, unknown>),
  ): void;
  defineObservedAttribute(name: string, defaultValue: ObservedAttributeValue): void;
  defineRender(render: ComponentRender<E, Attributes>): void;
}

export type ComponentDefinition<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = (
  api: ComponentDefinitionApi<E, Attributes>,
) => void;

/** Static component configuration known before individual elements are constructed. */
export interface ComponentSchema<
  Attributes extends ObservedAttributeSchema = ObservedAttributeSchema,
> {
  observedAttributes?: Attributes;
  style?: StyleValue | readonly StyleValue[];
  shadow?: boolean | ShadowRootInit;
}

/** Per-instance Composition API helpers. */
export interface ComponentSetupApi<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> {
  render(): void;
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T>;
  connectedCallback(callback: ConnectedCallback<E, Attributes>): void;
  disconnectedCallback(callback: DisconnectedCallback<E, Attributes>): void;
  adoptedCallback(callback: AdoptedCallback<E, Attributes>): void;
  attributeChangedCallback(callback: AttributeChangedCallback<E, Attributes>): void;
  defineProperty(name: PropertyKey, value: unknown): void;
  defineState<State extends Record<string, unknown>>(
    initialState: State | (() => State),
  ): State;
  defineRender(render: ComponentRender<E, Attributes>): void;
}

export type ComponentSetup<
  E extends HTMLElement = HTMLElement,
  Attributes extends Record<string, ObservedAttributeValue | null> = Record<
    string,
    ObservedAttributeValue | null
  >,
> = (element: ComponentElement<E, Attributes>, api: ComponentSetupApi<E, Attributes>) => void;

export interface ComponentOptions<E extends HTMLElement = HTMLElement> {
  /**
   * Template to inject into the element or shadow root.
   * Can be an HTML string, an HTMLTemplateElement, or a function receiving the element.
   */
  template?: TemplateValue<E>;

  /** Style to inject. Can be a CSS string, a CSSStyleSheet, or an array of them. */
  style?: StyleValue | readonly StyleValue[];

  /** Shadow DOM configuration. Defaults to an open shadow root. */
  shadow?: boolean | ShadowRootInit;
  observedAttributes?: readonly string[];
  onInit?(element: ComponentElement<E>): void;
  onMounted?(element: ComponentElement<E>): void;
  onUnmounted?(element: ComponentElement<E>): void;
  onUpdate?(element: ComponentElement<E>, detail?: unknown): void;
  onAttributeChanged?(element: ComponentElement<E>, change: AttributeChange): void;
  onAdopted?(element: ComponentElement<E>): void;
}
