export type Unsubscribe = () => void;

/** Anything a component can subscribe to for re-render notifications. */
export interface Subscribable {
  subscribe(listener: () => void): Unsubscribe;
}

export interface Store<T extends object = Record<string, unknown>> extends Subscribable {
  /** Reactive state. Assigning a top-level property notifies subscribers. */
  readonly state: T;
  /** Registers a listener and returns its unsubscribe function. */
  subscribe(listener: () => void): Unsubscribe;
  /** Applies a partial update, notifying subscribers once. */
  set(partial: Partial<T>): void;
  /** Mutates state (including nested values), notifying subscribers once. */
  update(mutate: (state: T) => void): void;
}

/** Result of tagging a template literal with {@link html}. */
export interface TemplateResult {
  readonly strings: TemplateStringsArray;
  readonly values: readonly unknown[];
  readonly __isTemplateResult: true;
}

export interface RepeatEntry {
  readonly key: unknown;
  readonly value: TemplateResult;
}

/** Result of calling {@link repeat}; recognized specially by `renderHtml`. */
export interface RepeatResult {
  readonly entries: readonly RepeatEntry[];
  readonly __isRepeatResult: true;
}

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
  stores?: readonly Subscribable[];
  connected?: (element: RuntimeComponentElement) => void;
  disconnected?: (element: RuntimeComponentElement) => void;
}

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

export type Render<
  S extends Record<string, unknown>,
  A extends Record<string, AttributeValue>,
  M extends object,
  C extends object,
> = (
  element: WebComponentElement<S, A, M, C>,
) => TemplateResult;

export type Hook<
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
