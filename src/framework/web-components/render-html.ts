/**
 * ClientHtmlRenderer
 *
 * A minimal, dependency-free templating helper for the browser modeled after
 * `lit-html`'s core rendering loop: tagged template literals describe static
 * markup plus dynamic "holes", and re-rendering the same call site diffs
 * against the previously committed DOM instead of tearing everything down.
 *
 * Deliberately excluded (to keep the module small): directives, async
 * iterables, SVG/MathML template parsing, and keyed list reconciliation.
 * Plain arrays are diffed by position only.
 *
 * Binding syntax inside a tag mirrors lit-html:
 *   - `name="${value}"`   -> attribute binding (removed when nullish/false)
 *   - `.name="${value}"`  -> property binding (`element.name = value`)
 *   - `?name="${value}"`  -> boolean attribute binding (toggled via truthiness)
 *   - `@name="${handler}"` -> event listener binding
 */

import type { RepeatEntry, RepeatResult, TemplateResult } from "./types.ts";

const HOLE_START = "\u0001";
const HOLE_END = "\u0002";
const UNSET: unique symbol = Symbol("client-html-renderer-unset");

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": "\u00a0",
};

function decodeEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|#39|nbsp);/g,
    (match) => ENTITY_MAP[match] ?? match,
  );
}

function isTemplateResult(value: unknown): value is TemplateResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __isTemplateResult?: boolean }).__isTemplateResult === true
  );
}

/**
 * Tags a template literal for use with {@link renderHtml}. Values may be
 * strings, numbers, booleans, null/undefined, nested `html` results, event
 * handler functions (for `@`-bound attributes), or arrays of any of those.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  return { strings, values, __isTemplateResult: true };
}

/**
 * Treat `value` as pre-escaped HTML and parse it into DOM nodes when
 * interpolated into a template. Use sparingly — this bypasses the normal
 * escaping and can introduce XSS if untrusted content is inserted.
 */
export function raw(value: string): TemplateResult {
  // The parser only needs the template `strings` array; values can be empty.
  // Construct a TemplateStringsArray via a cast so we can reuse the same
  // parsing path as normal tagged templates.
  return {
    strings: [value] as unknown as TemplateStringsArray,
    values: [],
    __isTemplateResult: true,
  };
}

function isRepeatResult(value: unknown): value is RepeatResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __isRepeatResult?: boolean }).__isRepeatResult === true
  );
}

/**
 * The only "directive" this module provides: a keyed list helper. Unlike
 * interpolating a plain array (which is diffed positionally by index),
 * `repeat` reconciles by key, so reordering/inserting/removing items moves
 * existing DOM nodes instead of patching every item after the change.
 */
export function repeat<T>(
  items: Iterable<T>,
  keyFn: (item: T, index: number) => unknown,
  template: (item: T, index: number) => TemplateResult,
): RepeatResult {
  const entries: RepeatEntry[] = [];
  let index = 0;
  for (const item of items) {
    entries.push({ key: keyFn(item, index), value: template(item, index) });
    index++;
  }
  return { entries, __isRepeatResult: true };
}

type AttrBindingKind = "attribute" | "property" | "boolean" | "event";

interface AttrBinding {
  readonly kind: AttrBindingKind;
  readonly name: string;
  readonly index: number;
}

type TemplateNode =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "hole"; readonly index: number }
  | {
    readonly type: "element";
    readonly tag: string;
    readonly attrs: ReadonlyArray<{ readonly name: string; readonly value: string }>;
    readonly bindings: readonly AttrBinding[];
    readonly children: readonly TemplateNode[];
  };

const templateAstCache = new WeakMap<TemplateStringsArray, readonly TemplateNode[]>();

function combineWithHoleMarkers(strings: TemplateStringsArray): string {
  let combined = strings[0];
  for (let i = 1; i < strings.length; i++) {
    combined += `${HOLE_START}${i - 1}${HOLE_END}${strings[i]}`;
  }
  return combined;
}

function parseTemplateSource(source: string): readonly TemplateNode[] {
  let pos = 0;
  const len = source.length;

  function consumeMarker(): number {
    const end = source.indexOf(HOLE_END, pos);
    const index = Number(source.slice(pos + 1, end));
    pos = end + 1;
    return index;
  }

  function parseChildren(): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    while (pos < len) {
      if (source[pos] === HOLE_START) {
        nodes.push({ type: "hole", index: consumeMarker() });
        continue;
      }
      if (source[pos] === "<") {
        if (source[pos + 1] === "/") {
          const end = source.indexOf(">", pos);
          pos = end === -1 ? len : end + 1;
          return nodes;
        }
        if (source.startsWith("<!--", pos)) {
          const end = source.indexOf("-->", pos);
          pos = end === -1 ? len : end + 3;
          continue;
        }
        nodes.push(parseElement());
        continue;
      }
      let textEnd = pos;
      while (textEnd < len && source[textEnd] !== "<" && source[textEnd] !== HOLE_START) {
        textEnd++;
      }
      const text = source.slice(pos, textEnd);
      if (text.length > 0) nodes.push({ type: "text", value: decodeEntities(text) });
      pos = textEnd;
    }
    return nodes;
  }

  function parseElement(): TemplateNode {
    pos++; // consume '<'
    const tagStart = pos;
    while (pos < len && /[a-zA-Z0-9-]/.test(source[pos])) pos++;
    const tag = source.slice(tagStart, pos);
    const attrs: Array<{ name: string; value: string }> = [];
    const bindings: AttrBinding[] = [];

    while (pos < len) {
      while (pos < len && /\s/.test(source[pos])) pos++;
      if (source[pos] === ">") {
        pos++;
        break;
      }
      if (source[pos] === "/" && source[pos + 1] === ">") {
        pos += 2;
        return { type: "element", tag, attrs, bindings, children: [] };
      }

      const nameStart = pos;
      while (pos < len && !/[\s=/>]/.test(source[pos])) pos++;
      const rawName = source.slice(nameStart, pos);
      if (!rawName) {
        pos++;
        continue;
      }

      let value = "";
      let hasValue = false;
      const beforeEquals = pos;
      while (pos < len && /\s/.test(source[pos])) pos++;
      if (source[pos] === "=") {
        pos++;
        while (pos < len && /\s/.test(source[pos])) pos++;
        hasValue = true;
        const quote = source[pos];
        if (quote === '"' || quote === "'") {
          pos++;
          const valStart = pos;
          while (pos < len && source[pos] !== quote) pos++;
          value = source.slice(valStart, pos);
          pos++;
        } else {
          const valStart = pos;
          while (pos < len && !/[\s>]/.test(source[pos])) pos++;
          value = source.slice(valStart, pos);
        }
      } else {
        pos = beforeEquals;
      }

      let kind: AttrBindingKind | null = null;
      let name = rawName;
      if (rawName[0] === ".") {
        kind = "property";
        name = rawName.slice(1);
      } else if (rawName[0] === "?") {
        kind = "boolean";
        name = rawName.slice(1);
      } else if (rawName[0] === "@") {
        kind = "event";
        name = rawName.slice(1);
      }

      const holeMatch = new RegExp(`^${HOLE_START}(\\d+)${HOLE_END}$`).exec(value);
      if (holeMatch) {
        bindings.push({ kind: kind ?? "attribute", name, index: Number(holeMatch[1]) });
      } else if (!kind) {
        attrs.push({ name, value: hasValue ? decodeEntities(value) : "" });
      }
      // Property/boolean/event bindings with a static (non-hole) value are not
      // meaningful and are silently dropped, matching this module's "no
      // directives, keep it simple" scope.
    }

    if (VOID_ELEMENTS.has(tag.toLowerCase())) {
      return { type: "element", tag, attrs, bindings, children: [] };
    }
    const children = parseChildren();
    return { type: "element", tag, attrs, bindings, children };
  }

  return parseChildren();
}

function getTemplateAst(strings: TemplateStringsArray): readonly TemplateNode[] {
  let ast = templateAstCache.get(strings);
  if (!ast) {
    ast = parseTemplateSource(combineWithHoleMarkers(strings));
    templateAstCache.set(strings, ast);
  }
  return ast;
}

interface ChildPart {
  parentNode: Node;
  beforeNode: Node | null;
  lastValue: unknown;
  /** Top-level DOM nodes currently committed for this part (for removal). */
  committedNodes: Node[];
  nested?: TemplateInstance;
  items?: ChildPart[];
  keyed?: Map<unknown, ChildPart>;
}

interface AttrPart {
  element: Element;
  name: string;
  kind: AttrBindingKind;
  lastValue: unknown;
}

interface TemplateInstance {
  templateKey: TemplateStringsArray;
  fragmentRootNodes: Node[];
  childParts: (ChildPart | undefined)[];
  attrParts: (AttrPart | undefined)[];
}

function disposePart(part: ChildPart): void {
  if (part.items) {
    for (const item of part.items) disposePart(item);
    part.items = undefined;
  }
  if (part.keyed) {
    for (const item of part.keyed.values()) disposePart(item);
    part.keyed = undefined;
  }
  part.nested = undefined;
  for (const node of part.committedNodes) {
    node.parentNode?.removeChild(node);
  }
  part.committedNodes = [];
}

function applyAttrValue(part: AttrPart, value: unknown): void {
  if (Object.is(part.lastValue, value)) return;
  switch (part.kind) {
    case "property":
      (part.element as unknown as Record<string, unknown>)[part.name] = value;
      break;
    case "boolean":
      part.element.toggleAttribute(part.name, Boolean(value));
      break;
    case "event": {
      const previous = part.lastValue;
      if (typeof previous === "function") {
        part.element.removeEventListener(part.name, previous as EventListener);
      }
      if (typeof value === "function") {
        part.element.addEventListener(part.name, value as EventListener);
      }
      break;
    }
    case "attribute":
    default:
      if (value === null || value === undefined || value === false) {
        part.element.removeAttribute(part.name);
      } else {
        part.element.setAttribute(part.name, value === true ? "" : String(value));
      }
      break;
  }
  part.lastValue = value;
}

function ownerDocumentOf(node: Node): Document {
  const doc = node.ownerDocument;
  if (!doc) throw new Error("ClientHtmlRenderer: node has no ownerDocument");
  return doc;
}

function buildNodes(
  astNodes: readonly TemplateNode[],
  values: readonly unknown[],
  parentNode: Node,
  beforeNode: Node | null,
  childParts: (ChildPart | undefined)[],
  attrParts: (AttrPart | undefined)[],
): Node[] {
  const doc = ownerDocumentOf(parentNode);
  const created: Node[] = [];

  for (const astNode of astNodes) {
    if (astNode.type === "text") {
      const node = doc.createTextNode(astNode.value);
      parentNode.insertBefore(node, beforeNode);
      created.push(node);
      continue;
    }

    if (astNode.type === "hole") {
      const part: ChildPart = {
        parentNode,
        beforeNode,
        lastValue: UNSET,
        committedNodes: [],
      };
      childParts[astNode.index] = part;
      setChildPartValue(part, values[astNode.index]);
      created.push(...part.committedNodes);
      continue;
    }

    const element = doc.createElement(astNode.tag);
    for (const attr of astNode.attrs) {
      element.setAttribute(attr.name, attr.value);
    }
    buildNodes(astNode.children, values, element, null, childParts, attrParts);
    for (const binding of astNode.bindings) {
      const part: AttrPart = {
        element,
        name: binding.name,
        kind: binding.kind,
        lastValue: UNSET,
      };
      attrParts[binding.index] = part;
      applyAttrValue(part, values[binding.index]);
    }
    parentNode.insertBefore(element, beforeNode);
    created.push(element);
  }

  return created;
}

function instantiateTemplate(
  templateKey: TemplateStringsArray,
  values: readonly unknown[],
  parentNode: Node,
  beforeNode: Node | null,
): TemplateInstance {
  const ast = getTemplateAst(templateKey);
  const childParts: (ChildPart | undefined)[] = new Array(values.length);
  const attrParts: (AttrPart | undefined)[] = new Array(values.length);
  const fragmentRootNodes = buildNodes(ast, values, parentNode, beforeNode, childParts, attrParts);
  return { templateKey, fragmentRootNodes, childParts, attrParts };
}

function updateTemplateInstance(instance: TemplateInstance, values: readonly unknown[]): void {
  for (let i = 0; i < values.length; i++) {
    const childPart = instance.childParts[i];
    if (childPart) {
      setChildPartValue(childPart, values[i]);
      continue;
    }
    const attrPart = instance.attrParts[i];
    if (attrPart) applyAttrValue(attrPart, values[i]);
  }
}

/**
 * Reconciles a keyed list (from {@link repeat}) against whatever was
 * previously keyed-rendered into `part`. Processes entries back-to-front so
 * each item's insertion point (`nextMarker`) is known before it is placed;
 * reused items are only physically moved in the DOM when their neighbor
 * actually changed.
 */
function renderRepeat(part: ChildPart, entries: readonly RepeatEntry[]): void {
  if (!part.keyed) {
    disposePart(part);
    part.keyed = new Map();
  }
  const oldKeyed = part.keyed;
  const newKeyed = new Map<unknown, ChildPart>();
  let nextMarker: Node | null = part.beforeNode;

  for (let i = entries.length - 1; i >= 0; i--) {
    const { key, value } = entries[i];
    let item = oldKeyed.get(key);
    if (item) {
      oldKeyed.delete(key);
    } else {
      item = {
        parentNode: part.parentNode,
        beforeNode: nextMarker,
        lastValue: UNSET,
        committedNodes: [],
      };
    }

    if (item.committedNodes.length > 0 && item.beforeNode !== nextMarker) {
      for (const node of item.committedNodes) {
        part.parentNode.insertBefore(node, nextMarker);
      }
    }
    item.beforeNode = nextMarker;

    setChildPartValue(item, value);
    newKeyed.set(key, item);
    if (item.committedNodes.length > 0) {
      nextMarker = item.committedNodes[0];
    }
  }

  for (const leftover of oldKeyed.values()) {
    disposePart(leftover);
  }

  part.keyed = newKeyed;
}

function setChildPartValue(part: ChildPart, value: unknown): void {
  if (Object.is(part.lastValue, value)) return;

  if (isTemplateResult(value)) {
    if (part.nested && part.nested.templateKey === value.strings) {
      updateTemplateInstance(part.nested, value.values);
    } else {
      disposePart(part);
      const instance = instantiateTemplate(
        value.strings,
        value.values,
        part.parentNode,
        part.beforeNode,
      );
      part.nested = instance;
      part.committedNodes = instance.fragmentRootNodes;
    }
    part.lastValue = value;
    return;
  }

  if (isRepeatResult(value)) {
    renderRepeat(part, value.entries);
    part.lastValue = value;
    return;
  }

  if (Array.isArray(value)) {
    if (!part.items) {
      disposePart(part);
      part.items = [];
    }
    const items = part.items;
    for (let i = 0; i < value.length; i++) {
      let item = items[i];
      if (!item) {
        item = {
          parentNode: part.parentNode,
          beforeNode: part.beforeNode,
          lastValue: UNSET,
          committedNodes: [],
        };
        items.push(item);
      }
      setChildPartValue(item, value[i]);
    }
    for (let i = value.length; i < items.length; i++) {
      disposePart(items[i]);
    }
    items.length = value.length;
    part.lastValue = value;
    return;
  }

  if (part.nested || part.items) {
    disposePart(part);
  }

  if (value === null || value === undefined || typeof value === "boolean") {
    for (const node of part.committedNodes) node.parentNode?.removeChild(node);
    part.committedNodes = [];
    part.lastValue = value;
    return;
  }

  const text = typeof value === "string" ? value : String(value);
  if (part.committedNodes.length === 1 && part.committedNodes[0].nodeType === 3) {
    (part.committedNodes[0] as Text).data = text;
  } else {
    for (const node of part.committedNodes) node.parentNode?.removeChild(node);
    const textNode = ownerDocumentOf(part.parentNode).createTextNode(text);
    part.parentNode.insertBefore(textNode, part.beforeNode);
    part.committedNodes = [textNode];
  }
  part.lastValue = value;
}

const rootParts = new WeakMap<Node, ChildPart>();

/**
 * Renders `result` into `container`, efficiently diffing against whatever was
 * previously rendered into that exact container (reusing DOM nodes, only
 * touching the parts whose values actually changed).
 */
export function renderHtml(result: TemplateResult, container: Element | DocumentFragment): void {
  let part = rootParts.get(container);
  if (!part) {
    part = { parentNode: container, beforeNode: null, lastValue: UNSET, committedNodes: [] };
    rootParts.set(container, part);
  }
  setChildPartValue(part, result);
}
