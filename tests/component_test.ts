import { component } from "../src/framework/component/component.ts";
import type { AttributeChange, ComponentElement } from "../src/framework/component/types.ts";

function assert(condition: boolean, message = "Assertion failed"): void {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message ? message + ": " : ""}Expected ${expectedStr}, got ${actualStr}`,
    );
  }
}

// Minimal DOM environment for unit testing in Deno CLI
class MockNode extends EventTarget {
  parentNode: MockNode | null = null;
  childNodes: MockNode[] = [];

  appendChild<T extends MockNode>(child: T): T {
    if (child instanceof MockDocumentFragment) {
      while (child.childNodes.length > 0) {
        const item = child.childNodes.shift()!;
        item.parentNode = this;
        this.childNodes.push(item);
      }
      return child;
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild<T extends MockNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  cloneNode(deep = false): MockNode {
    const copy = new (this.constructor as new () => MockNode)();
    if (deep) {
      for (const child of this.childNodes) {
        copy.appendChild(child.cloneNode(true));
      }
    }
    return copy;
  }
}

class MockDocumentFragment extends MockNode {
  override cloneNode(deep = false): MockDocumentFragment {
    const copy = new MockDocumentFragment();
    if (deep) {
      for (const child of this.childNodes) {
        copy.appendChild(child.cloneNode(true));
      }
    }
    return copy;
  }
}

class MockElement extends MockNode {
  tagName: string;
  attributes = new Map<string, string>();
  #shadowRoot: MockShadowRoot | null = null;
  #innerHTML = "";
  textContent = "";

  constructor(tagName = "div") {
    super();
    this.tagName = tagName.toUpperCase();
  }

  override cloneNode(deep = false): MockElement {
    const copy = new MockElement(this.tagName.toLowerCase());
    for (const [k, v] of this.attributes) {
      copy.setAttribute(k, v);
    }
    copy.textContent = this.textContent;
    copy.innerHTML = this.innerHTML;
    if (deep) {
      for (const child of this.childNodes) {
        copy.appendChild(child.cloneNode(true));
      }
    }
    return copy;
  }

  get innerHTML(): string {
    return this.#innerHTML;
  }

  set innerHTML(val: string) {
    this.#innerHTML = val;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    const oldValue = this.getAttribute(name);
    this.attributes.set(name, value);
    if (this instanceof MockHTMLElement && typeof this.attributeChangedCallback === "function") {
      this.attributeChangedCallback(name, oldValue, value);
    }
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string): void {
    const oldValue = this.getAttribute(name);
    this.attributes.delete(name);
    if (this instanceof MockHTMLElement && typeof this.attributeChangedCallback === "function") {
      this.attributeChangedCallback(name, oldValue, null);
    }
  }

  attachShadow(init: ShadowRootInit): MockShadowRoot {
    if (this.#shadowRoot) throw new Error("Shadow root already attached");
    this.#shadowRoot = new MockShadowRoot(this, init);
    return this.#shadowRoot;
  }

  get shadowRoot(): MockShadowRoot | null {
    return this.#shadowRoot;
  }

  querySelector<T extends Element = HTMLElement>(selector: string): T | null {
    for (const child of this.childNodes) {
      if (child instanceof MockElement) {
        if (selector.startsWith("#") && child.getAttribute("id") === selector.slice(1)) {
          return child as unknown as T;
        }
        if (selector.startsWith(".") && child.getAttribute("class") === selector.slice(1)) {
          return child as unknown as T;
        }
        if (child.tagName.toLowerCase() === selector.toLowerCase()) {
          return child as unknown as T;
        }
        const found = child.querySelector<T>(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll<T extends Element = HTMLElement>(selector: string): NodeListOf<T> {
    const results: MockElement[] = [];
    const search = (node: MockNode) => {
      for (const child of node.childNodes) {
        if (child instanceof MockElement) {
          if (
            (selector.startsWith("#") && child.getAttribute("id") === selector.slice(1)) ||
            (selector.startsWith(".") && child.getAttribute("class") === selector.slice(1)) ||
            child.tagName.toLowerCase() === selector.toLowerCase()
          ) {
            results.push(child);
          }
          search(child);
        }
      }
    };
    search(this);
    return results as unknown as NodeListOf<T>;
  }
}

function parseMockHtml(html: string, parentNode: MockNode): void {
  parentNode.childNodes = [];
  const tagMatch = html.match(/<([a-z0-9-]+)([^>]*)>(.*?)<\/\1>/i);
  if (tagMatch) {
    const [, tag, rawAttrs, text] = tagMatch;
    const el = new MockElement(tag);
    const idMatch = rawAttrs.match(/id="([^"]+)"/);
    if (idMatch) el.setAttribute("id", idMatch[1]);
    const classMatch = rawAttrs.match(/class="([^"]+)"/);
    if (classMatch) el.setAttribute("class", classMatch[1]);
    el.textContent = text;
    parentNode.appendChild(el);
  }
}

class MockShadowRoot extends MockNode {
  host: MockElement;
  mode: ShadowRootMode;
  adoptedStyleSheets: MockCSSStyleSheet[] = [];
  #innerHTML = "";

  constructor(host: MockElement, init: ShadowRootInit) {
    super();
    this.host = host;
    this.mode = init.mode;
  }

  get innerHTML(): string {
    return this.#innerHTML;
  }

  set innerHTML(html: string) {
    this.#innerHTML = html;
    parseMockHtml(html, this);
  }

  querySelector<T extends Element = HTMLElement>(selector: string): T | null {
    return MockElement.prototype.querySelector.call(this as unknown as MockElement, selector) as
      | T
      | null;
  }

  querySelectorAll<T extends Element = HTMLElement>(selector: string): NodeListOf<T> {
    return MockElement.prototype.querySelectorAll.call(
      this as unknown as MockElement,
      selector,
    ) as unknown as NodeListOf<T>;
  }
}

class MockHTMLElement extends MockElement {
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  adoptedCallback?(): void;
}

class MockTemplateElement extends MockElement {
  content = new MockDocumentFragment();

  constructor() {
    super("template");
  }

  override get innerHTML(): string {
    return super.innerHTML;
  }

  override set innerHTML(html: string) {
    super.innerHTML = html;
    parseMockHtml(html, this.content);
  }
}

class MockCSSStyleSheet {
  cssText = "";
  replaceSync(css: string): void {
    this.cssText = css;
  }
}

class MockCustomElementRegistry {
  #registry = new Map<string, CustomElementConstructor>();

  get(name: string): CustomElementConstructor | undefined {
    return this.#registry.get(name);
  }

  define(name: string, constructor: CustomElementConstructor): void {
    if (this.#registry.has(name)) {
      throw new Error(`Custom element '${name}' has already been defined`);
    }
    this.#registry.set(name, constructor);
  }
}

// Install mock DOM globals for Deno test execution
const globalAny = globalThis as unknown as Record<string, unknown>;
globalAny.Node = MockNode;
globalAny.Element = MockElement;
globalAny.HTMLElement = MockHTMLElement;
globalAny.ShadowRoot = MockShadowRoot;
globalAny.HTMLTemplateElement = MockTemplateElement;
globalAny.CSSStyleSheet = MockCSSStyleSheet;
globalAny.customElements = new MockCustomElementRegistry();
globalAny.document = {
  adoptedStyleSheets: [] as MockCSSStyleSheet[],
  createElement(tag: string) {
    if (tag.toLowerCase() === "template") return new MockTemplateElement();
    return new MockElement(tag);
  },
};

// Tests
Deno.test("component: defines and registers custom element", () => {
  const Ctor = component("test-basic", {});
  assert(Ctor !== undefined);
  assertEquals(customElements.get("test-basic"), Ctor);
});

Deno.test("component: executes onInit on construction with element passed", () => {
  let initPassedEl: ComponentElement | null = null;

  const Ctor = component("test-init", {
    onInit(el) {
      initPassedEl = el;
    },
  });

  const el = new Ctor();
  assert(initPassedEl === el);
  assert(el.root instanceof MockShadowRoot);
});

Deno.test("component: injects template and adopted stylesheet into shadow DOM", () => {
  const Ctor = component("test-shadow-assets", {
    template: /* html */ `<button id="btn">Click me</button>`,
    style: /* css */ `:host { display: block; }`,
    shadow: true,
  });

  const el = new Ctor();
  el.connectedCallback?.();

  assert(el.root instanceof MockShadowRoot);
  const shadow = el.root as unknown as MockShadowRoot;
  assertEquals(shadow.adoptedStyleSheets.length, 1);
  assertEquals(shadow.adoptedStyleSheets[0].cssText, `:host { display: block; }`);

  const btn = el.$("#btn");
  assert(btn !== null);
  assertEquals(btn!.getAttribute("id"), "btn");
});

Deno.test("component: supports light DOM (shadow: false)", () => {
  const Ctor = component("test-light-dom", {
    template: /* html */ `<span id="inner">Content</span>`,
    shadow: false,
  });

  const el = new Ctor();
  assertEquals(el.root, el);
  assertEquals(el.shadowRoot, null);

  el.connectedCallback?.();
  const inner = el.$("#inner");
  assert(inner !== null);
  assertEquals(inner!.getAttribute("id"), "inner");
});

Deno.test("component: onMounted and onUnmounted lifecycle callbacks", () => {
  let mounted = 0;
  let unmounted = 0;

  const Ctor = component("test-lifecycle", {
    onMounted(el) {
      mounted++;
      assert(el !== null);
    },
    onUnmounted(el) {
      unmounted++;
      assert(el !== null);
    },
  });

  const el = new Ctor();
  assertEquals(mounted, 0);
  assertEquals(unmounted, 0);

  el.connectedCallback?.();
  assertEquals(mounted, 1);
  assertEquals(unmounted, 0);

  el.disconnectedCallback?.();
  assertEquals(mounted, 1);
  assertEquals(unmounted, 1);
});

Deno.test("component: onAttributeChanged and onUpdate on observed attributes", () => {
  const changes: AttributeChange[] = [];
  const updates: unknown[] = [];

  const Ctor = component("test-attrs", {
    observedAttributes: ["title", "count"],
    onAttributeChanged(el, change) {
      assert(el !== null);
      changes.push(change);
    },
    onUpdate(el, detail) {
      assert(el !== null);
      updates.push(detail);
    },
  });

  const el = new Ctor();
  el.setAttribute("title", "Hello");
  el.setAttribute("count", "42");

  assertEquals(changes.length, 2);
  assertEquals(changes[0], { name: "title", oldValue: null, newValue: "Hello" });
  assertEquals(changes[1], { name: "count", oldValue: null, newValue: "42" });

  assertEquals(updates.length, 2);
});

Deno.test("component: element helpers ($$, emit, update)", () => {
  let receivedEvent: CustomEvent | null = null;
  let updateDetail: unknown = null;

  const Ctor = component("test-helpers", {
    template: `<div class="item">1</div>`,
    onUpdate(el, detail) {
      assert(el !== null);
      updateDetail = detail;
    },
  });

  const el = new Ctor();
  el.connectedCallback?.();

  el.addEventListener("custom-ping", (e) => {
    receivedEvent = e as CustomEvent;
  });

  const dispatched = el.emit("custom-ping", { message: "pong" });
  assert(dispatched);
  assert(receivedEvent !== null);
  const ev = receivedEvent as unknown as CustomEvent;
  assertEquals(ev.detail, { message: "pong" });
  assertEquals(ev.bubbles, true);
  assertEquals(ev.composed, true);

  el.update({ custom: true });
  assertEquals(updateDetail, { custom: true });

  const items = el.$$(".item");
  assertEquals(items.length, 1);
});

Deno.test("component: dynamic template function", () => {
  const Ctor = component("test-dynamic-template", {
    template(el) {
      return `<button id="dyn-btn">Dynamic for ${el.tagName}</button>`;
    },
  });

  const el = new Ctor();
  el.connectedCallback?.();

  const btn = el.$("#dyn-btn");
  assert(btn !== null);
  assertEquals(btn!.getAttribute("id"), "dyn-btn");
});

Deno.test("component: multiple stylesheets in array", () => {
  const Ctor = component("test-multi-styles", {
    style: [":host { margin: 0; }", ":host { padding: 0; }"],
  });

  const el = new Ctor();
  assert(el.root instanceof MockShadowRoot);
  const shadow = el.root as unknown as MockShadowRoot;
  assertEquals(shadow.adoptedStyleSheets.length, 2);
  assertEquals(shadow.adoptedStyleSheets[0].cssText, ":host { margin: 0; }");
  assertEquals(shadow.adoptedStyleSheets[1].cssText, ":host { padding: 0; }");
});

Deno.test("component: onAdopted lifecycle callback", () => {
  let adopted = 0;
  const Ctor = component("test-adopted", {
    onAdopted(el) {
      assert(el !== null);
      adopted++;
    },
  });

  const el = new Ctor();
  el.adoptedCallback?.();
  assertEquals(adopted, 1);
});

Deno.test("component: avoids re-registering existing custom element", () => {
  const Ctor1 = component("test-dup-reg", {});
  const Ctor2 = component("test-dup-reg", {});
  assertEquals(Ctor1, Ctor2);
});
