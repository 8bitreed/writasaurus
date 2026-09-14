import { assert, assertEquals } from "jsr:@std/assert@^1";
import { html, renderHtml, repeat } from "../src/framework/html/client_html_renderer.ts";

// Minimal DOM environment sufficient for exercising ClientHtmlRenderer without a browser.
class MockNode {
  parentNode: MockNode | null = null;
  childNodes: MockNode[] = [];
  ownerDocument: MockDocument;
  nodeType = 1;

  constructor(ownerDocument: MockDocument) {
    this.ownerDocument = ownerDocument;
  }

  insertBefore<T extends MockNode>(node: T, ref: MockNode | null): T {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    if (ref === null) {
      this.childNodes.push(node);
    } else {
      const idx = this.childNodes.indexOf(ref);
      this.childNodes.splice(idx === -1 ? this.childNodes.length : idx, 0, node);
    }
    return node;
  }

  appendChild<T extends MockNode>(node: T): T {
    return this.insertBefore(node, null);
  }

  removeChild<T extends MockNode>(node: T): T {
    const idx = this.childNodes.indexOf(node);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
    return node;
  }
}

class MockText extends MockNode {
  override nodeType = 3;
  data: string;
  constructor(ownerDocument: MockDocument, data: string) {
    super(ownerDocument);
    this.data = data;
  }
}

class MockElement extends MockNode {
  tagName: string;
  attributes = new Map<string, string>();
  listeners = new Map<string, Set<EventListener>>();
  props: Record<string, unknown> = {};

  constructor(ownerDocument: MockDocument, tagName: string) {
    super(ownerDocument);
    this.tagName = tagName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  toggleAttribute(name: string, force: boolean): void {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
  }
  addEventListener(name: string, listener: EventListener): void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
  }
  removeEventListener(name: string, listener: EventListener): void {
    this.listeners.get(name)?.delete(listener);
  }
}

class MockDocument {
  createElement(tag: string): MockElement {
    return new MockElement(this, tag);
  }
  createTextNode(data: string): MockText {
    return new MockText(this, data);
  }
}

function textOf(node: MockNode): string {
  if (node instanceof MockText) return node.data;
  if (node instanceof MockElement) return node.childNodes.map(textOf).join("");
  return "";
}

function makeContainer(): MockElement {
  const doc = new MockDocument();
  return doc.createElement("div");
}

Deno.test("renderHtml: renders static and dynamic text content", () => {
  const container = makeContainer();
  // deno-lint-ignore no-explicit-any
  renderHtml(html`<p>Hello, ${"World"}!</p>`, container as any);
  const p = container.childNodes[0] as MockElement;
  assertEquals(p.tagName, "p");
  assertEquals(textOf(p), "Hello, World!");
});

Deno.test("renderHtml: reuses text node in place on update (no node churn)", () => {
  const container = makeContainer();
  const render = (value: string) =>
    renderHtml(
      html`<span>${value}</span>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render("first");
  const span = container.childNodes[0] as MockElement;
  const textNode = span.childNodes[0] as MockText;
  assertEquals(textNode.data, "first");

  render("second");
  assert(container.childNodes[0] === span, "element should be reused");
  assert(span.childNodes[0] === textNode, "text node should be reused, not replaced");
  assertEquals(textNode.data, "second");
});

Deno.test("renderHtml: attribute, property, boolean, and event bindings", () => {
  const container = makeContainer();
  let clicked = 0;
  const handler = () => clicked++;
  // deno-fmt-ignore
  const render = (cls: string, disabled: boolean, hidden: boolean) =>
    renderHtml(
      html`<button class="${cls}" .disabled="${disabled}" ?hidden="${hidden}" @click="${handler}">Go</button>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render("btn", false, true);
  const button = container.childNodes[0] as MockElement;
  assertEquals(button.attributes.get("class"), "btn");
  assert(button.attributes.has("hidden"), "boolean attribute should be present when truthy");
  assert(
    button.listeners.get("click")?.has(handler as unknown as EventListener),
    "listener attached",
  );

  render("btn2", true, false);
  assertEquals(button.attributes.get("class"), "btn2");
  assert(!button.attributes.has("hidden"), "boolean attribute removed when falsy");
  assert(clicked === 0, "handler should not fire on its own");
});

Deno.test("renderHtml: array of items updates positionally and trims extras", () => {
  const container = makeContainer();
  const render = (items: string[]) =>
    renderHtml(
      html`<ul>${items.map((item) => html`<li>${item}</li>`)}</ul>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render(["a", "b", "c"]);
  const ul = container.childNodes[0] as MockElement;
  assertEquals(ul.childNodes.map(textOf), ["a", "b", "c"]);

  render(["a", "x"]);
  assertEquals(ul.childNodes.map(textOf), ["a", "x"]);

  render(["a", "x", "y", "z"]);
  assertEquals(ul.childNodes.map(textOf), ["a", "x", "y", "z"]);
});

Deno.test("repeat: reorders by moving existing DOM nodes, not recreating them", () => {
  const container = makeContainer();
  const render = (ids: string[]) =>
    renderHtml(
      html`<ul>${repeat(ids, (id) => id, (id) => html`<li>${id}</li>`)}</ul>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render(["a", "b", "c"]);
  const ul = container.childNodes[0] as MockElement;
  const [liA, liB, liC] = ul.childNodes as MockElement[];
  assertEquals(ul.childNodes.map(textOf), ["a", "b", "c"]);

  render(["c", "a", "b"]);
  assertEquals(ul.childNodes.map(textOf), ["c", "a", "b"]);
  // Same element instances, just reordered — proves nodes were moved, not rebuilt.
  assert(ul.childNodes[0] === liC, "c should be the same element, moved");
  assert(ul.childNodes[1] === liA, "a should be the same element, moved");
  assert(ul.childNodes[2] === liB, "b should be the same element, moved");
});

Deno.test("repeat: inserting/removing in the middle preserves unrelated item identity", () => {
  const container = makeContainer();
  const render = (ids: string[]) =>
    renderHtml(
      html`<ul>${repeat(ids, (id) => id, (id) => html`<li>${id}</li>`)}</ul>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render(["a", "b", "c"]);
  const ul = container.childNodes[0] as MockElement;
  const [liA, , liC] = ul.childNodes as MockElement[];

  render(["a", "x", "c"]);
  assertEquals(ul.childNodes.map(textOf), ["a", "x", "c"]);
  assert(ul.childNodes[0] === liA, "a should be untouched");
  assert(ul.childNodes[2] === liC, "c should be untouched");

  render(["a", "c"]);
  assertEquals(ul.childNodes.map(textOf), ["a", "c"]);
  assert(ul.childNodes[0] === liA, "a should still be untouched after removal");
  assert(ul.childNodes[1] === liC, "c should still be untouched after removal");
});

Deno.test("renderHtml: nested template swaps content when shape changes", () => {
  const container = makeContainer();
  const render = (loggedIn: boolean) =>
    renderHtml(
      html`<div>${loggedIn ? html`<span>Hi</span>` : html`<a>Log in</a>`}</div>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render(false);
  const div = container.childNodes[0] as MockElement;
  assertEquals((div.childNodes[0] as MockElement).tagName, "a");

  render(true);
  assertEquals((div.childNodes[0] as MockElement).tagName, "span");
  assertEquals(textOf(div), "Hi");
});

Deno.test("renderHtml: removes content for null/undefined/boolean values", () => {
  const container = makeContainer();
  const render = (value: unknown) =>
    renderHtml(
      html`<div>before${value}after</div>`,
      // deno-lint-ignore no-explicit-any
      container as any,
    );

  render("X");
  const div = container.childNodes[0] as MockElement;
  assertEquals(textOf(div), "beforeXafter");

  render(null);
  assertEquals(textOf(div), "beforeafter");

  render(undefined);
  assertEquals(textOf(div), "beforeafter");
});
