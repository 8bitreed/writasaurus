export interface AttributeChange {
  name: string;
  oldValue: string | null;
  newValue: string | null;
}

export type TemplateFactory<E extends HTMLElement = HTMLElement> = (
  element: ComponentElement<E>,
) => string | Node;

export type TemplateValue<E extends HTMLElement = HTMLElement> =
  | string
  | HTMLTemplateElement
  | TemplateFactory<E>;

export type StyleValue = string | CSSStyleSheet;

export interface ComponentElement<E extends HTMLElement = HTMLElement> extends HTMLElement {
  readonly root: ShadowRoot | this;
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): NodeListOf<T>;
  emit<T = unknown>(name: string, detail?: T, options?: CustomEventInit<T>): boolean;
  update(detail?: unknown): void;
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  adoptedCallback?(): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
}

export type ComponentConstructor<E extends HTMLElement = HTMLElement> = {
  new (): ComponentElement<E>;
  readonly observedAttributes: readonly string[];
  prototype: ComponentElement<E>;
};

export interface ComponentOptions<E extends HTMLElement = HTMLElement> {
  /**
   * Template to inject into the element or shadow root.
   * Can be an HTML string, an HTMLTemplateElement, or a function receiving the element.
   */
  template?: TemplateValue<E>;

  /**
   * Style to inject. Can be a CSS string, a CSSStyleSheet, or an array of them.
   */
  style?: StyleValue | readonly StyleValue[];

  /**
   * Shadow DOM configuration:
   * - `true`: Attach shadow root with mode: "open"
   * - `false`: Use light DOM (no shadow root)
   * - ShadowRootInit object (e.g. `{ mode: "open", delegatesFocus: true }`)
   * Defaults to `true`.
   */
  shadow?: boolean | ShadowRootInit;

  /**
   * List of observed attribute names.
   */
  observedAttributes?: readonly string[];

  /**
   * Lifecycle: called when the custom element instance is created in the constructor.
   */
  onInit?(element: ComponentElement<E>): void;

  /**
   * Lifecycle: called when the custom element is connected to the DOM,
   * after styles and templates have been injected.
   */
  onMounted?(element: ComponentElement<E>): void;

  /**
   * Lifecycle: called when the custom element is disconnected from the DOM.
   */
  onUnmounted?(element: ComponentElement<E>): void;

  /**
   * Lifecycle: called when an observed attribute changes or when element.update(...) is invoked.
   */
  onUpdate?(element: ComponentElement<E>, detail?: unknown): void;

  /**
   * Lifecycle: called specifically when an observed attribute changes.
   */
  onAttributeChanged?(element: ComponentElement<E>, change: AttributeChange): void;

  /**
   * Lifecycle: called when the custom element is adopted into a new document.
   */
  onAdopted?(element: ComponentElement<E>): void;
}
