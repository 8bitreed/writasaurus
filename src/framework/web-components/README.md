# Web Components

A small browser component library for Writasaurus. It combines native Custom Elements and Shadow DOM
with a typed fluent builder, reactive per-instance state, and the client HTML renderer.

```ts
import { html, webComponent } from "../framework/web-components/index.ts";
```

Create a component by starting with `webComponent()` and ending with `.create()`:

```ts
webComponent("simple-counter")
  .defineState({ count: 0 })
  .defineMethod("increment", (element) => () => element.state.count++)
  .defineRender(
    (element) =>
      html`
        <button type="button" @click=${element.increment}>
          Count: ${element.state.count}
        </button>
      `,
  )
  .create();
```

```html
<simple-counter></simple-counter>
```

You can also include the component from JavaScript templates by calling the value returned from
`.create()` (it returns a render helper):

```ts
const simpleCounter = webComponent("simple-counter")
  .defineState({ count: 0 })
  .defineMethod("increment", (element) => () => element.state.count++)
  .defineRender(
    (element) =>
      html`<button type="button" @click=${element.increment}>
        Count: ${element.state.count}
      </button>`,
  )
  .create();

// In another template:
html`${simpleCounter({ class: "my-counter", id: "main-counter" })}`;
```

The helper accepts the component's observed attributes combined with standard HTML attributes
(`class`, `id`, `style`, `hidden`, `role`, `tabindex`, `data-*`, `aria-*`, etc.). Arguments are
optional if all attributes have defaults or are optional:

```ts
html`${simpleCounter()}`;
```

The helper returns a `TemplateResult` whose markup is parsed when it is rendered, so use it to
compose static shells (the editor builds its layout this way). For values that change between
renders, write the tag directly and bind them: `html`<word-count total=${total}></word-count>``.

## Builder API

Every builder call returns the builder, allowing later calls to receive more precise TypeScript
types.

### `defineState(initialState)`

Defines reactive, per-instance component state. State mutations re-render mounted components.

```ts
webComponent("profile-card")
  .defineState(
    (): {
      tags: string[];
      message: string | null;
    } => ({
      tags: [],
      message: null,
    }),
  )
  .defineRender(
    (element) =>
      html`
        <p>${element.state.message ?? "No message"}</p>
        <p>${element.state.tags.length} tags</p>
      `,
  )
  .create();
```

Use a factory for nested mutable state such as arrays and objects so each element instance gets
fresh values.

### `defineObservedAttributes(defaults)`

Defines attributes observed by the Custom Elements platform. Default values also determine how
values are parsed.

```ts
webComponent("book-card")
  .defineObservedAttributes({
    title: "Untitled",
    pageCount: 0,
    expanded: false,
    subtitle: null as string | null,
  })
  .defineRender(
    (element) =>
      html`
        <h2>${element.observedAttribute.title}</h2>
        <p>${element.observedAttribute.pageCount} pages</p>
      `,
  )
  .create();
```

Supported attribute values are `string`, `number`, `boolean`, and `null`:

- Number defaults parse attribute strings as numbers and fall back to the default for invalid
  values.
- Boolean attributes are `false` only when their value is exactly `"false"`; any other present value
  is `true`.
- A `null as string | null` default remains `null` while the attribute is absent and becomes a
  string when present.

Attributes cannot safely carry objects or functions. Use component state for those values.

### `defineMethod(name, factory)`

Adds a public method to each element instance. The factory receives the component element and
returns the real method, including its own arguments and return type.

```ts
webComponent("counter-button")
  .defineState({ count: 0 })
  .defineMethod("add", (element) => (amount: number): number => {
    element.state.count += amount;
    return element.state.count;
  })
  .defineRender(
    (element) =>
      html`
        <button @click=${() => element.add(1)}>${element.state.count}</button>
      `,
  )
  .create();
```

### `defineComputed(name, dependencies, compute)`

Adds a cached read-only value under `element.computed`. The dependencies function runs when the
value is read. The compute function runs only when its dependency tuple changes according to
`Object.is`.

```ts
webComponent("person-card")
  .defineObservedAttributes({ name: "John", lastName: "Smith" })
  .defineComputed(
    "fullName",
    (element): [string, string] => [
      element.observedAttribute.name,
      element.observedAttribute.lastName,
    ],
    (name, lastName) => `${name} ${lastName}`,
  )
  .defineRender((element) => html`<h2>${element.computed.fullName}</h2>`)
  .create();
```

### `defineStyles(css)`

Adds styles to the component. Components use an open Shadow DOM by default, so these styles are
scoped to the component.

```ts
.defineStyles(/* css */ `
  :host { display: block; }
  button { color: var(--accent); }
`)
```

### `defineShadow(shadow)`

The default is an open Shadow DOM. Use `false` only when a component intentionally enhances existing
light-DOM markup or must participate in page-level selectors.

```ts
webComponent("editor-canvas")
  .defineShadow(false)
  .connectedCallback((element) => {
    element.setAttribute("contenteditable", "true");
  })
  .create();
```

### `subscribe(...stores)`

Subscribes the component to one or more external reactive stores created via `createStore()`. You
can pass any number of stores variadically or chain multiple `.subscribe()` calls:

```ts
webComponent("dashboard-widget")
  .subscribe(userStore, themeStore)
  .subscribe(notificationsStore)
  .defineRender(() => html`...`)
  .create();
```

The component automatically subscribes to all configured stores when mounted (`connectedCallback`)
and triggers a re-render when any of them updates. It automatically unsubscribes from every store
when unmounted (`disconnectedCallback`), preventing memory leaks.

```ts
import { createStore, html, webComponent } from "../framework/web-components/index.ts";

export const appStore = createStore({
  theme: "dark",
  user: "Alice",
});

webComponent("user-badge")
  .subscribe(appStore)
  .defineRender(
    () => html`<div>User: ${appStore.state.user} (${appStore.state.theme})</div>`,
  )
  .create();
```

Stores are shallow: assigning a top-level property notifies subscribers, but mutating a nested
object or array does not. Use `update()` for nested edits and `set()` for partial updates; both
notify subscribers exactly once, no matter how many properties they touch.

```ts
appStore.set({ theme: "light" });
appStore.update((state) => {
  state.chapters.push(chapter);
  state.activeChapter = state.chapters.length - 1;
});
```

Prefer a store over parent-to-child method calls whenever several components need the same data:
every subscriber renders from one source of truth, so no component has to push updates into another.
Components that own uncontrolled DOM (such as `contenteditable` regions or focused inputs) should
subscribe manually with `store.subscribe(...)` and update that DOM only when the underlying value
really changed, so re-renders never move the caret.

### Lifecycle callbacks

Use native Custom Element lifecycle names on the builder:

```ts
webComponent("resize-aware-panel")
  .connectedCallback((element) => {
    // Register listeners after the component has rendered.
  })
  .disconnectedCallback((element) => {
    // Remove listeners, event-bus subscriptions, timers, and observers.
  })
  .create();
```

### DOM helpers

Generated elements expose root-scoped query and event helpers:

```ts
component.$("button");
component.$$("button");
component.emit("saved", { filename: "draft.md" });
```

`$()` and `$$()` query the Shadow Root by default, or the element itself when `defineShadow(false)`
is used.

## Rendering

`defineRender()` must return `html` from this framework's client renderer:

```ts
import { html } from "../framework/web-components/index.ts";
```

Event bindings use `@event`:

```ts
html`<button @click=${handler}>Save</button>`;
```

Property bindings use `.property`, and boolean attributes use `?attribute`.

For a mixed static/dynamic attribute value, compute the whole value first:

```ts
html`<span class=${`status ${state}`}></span>`;
```

## Registration

Finish each component definition with `.create()`. It defines the custom element if its tag name has
not already been registered, and returns a render helper function you can call to insert the element
into templates. The helper returns a `TemplateResult` so it can be interpolated directly into `html`
templates.

The element's constructor is registered with the browser `customElements` registry but is not
returned from `.create()`; use `document.createElement("tag-name")` or query the DOM when you need
the element instance.

## Testing

Put browser integration tests under `tests/browser/` and run:

```sh
deno task test:browser
```

This builds browser assets, serves the app in-process, and runs tests in Playwright Chromium.
