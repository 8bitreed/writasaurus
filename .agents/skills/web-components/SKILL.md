---
name: web-components
description: Build non-trivial Writasaurus browser UI components with the fluent web-components framework, scoped styles, reactive state, and typed event bus.
---

# Writasaurus Web Components

Use this skill for browser components that need meaningful JavaScript behavior: rendering, state,
lifecycle listeners, reusable APIs, or component-specific styles. Do not wrap static server-rendered
markup unnecessarily.

Import from the barrel:

```ts
import { html, webComponent } from "../../../framework/web-components/index.ts";
```

## Preferred fluent API

Start with `webComponent()` and finish with `.create()`:

```ts
webComponent("counter-widget")
  .defineState(() => ({ count: 0 }))
  .defineObservedAttributes({ label: "Count" })
  .defineStyles(
    /* css */ `
    :host { display: inline-block; }
  `,
  )
  .defineMethod("increment", (element) => () => element.state.count++)
  .defineRender(
    (element) =>
      html`
        <button @click=${element.increment}>
          ${element.observedAttribute.label}: ${element.state.count}
        </button>
      `,
  )
  .create();
```

Each chained declaration refines the types for later steps. Use
`defineState((): State => ({ ... }))` when nullable values, empty arrays, objects, or functions need
an explicit type.

`defineObservedAttributes()` is for HTML-compatible values only: `string`, `number`, `boolean`, or
`null`. Use component state for objects and functions.

`defineMethod(name, factory)` creates a public per-instance method. The factory receives the element
and returns the actual method, including its user-defined arguments and return value.

## Rules

- `defineRender()` must return the client `html` tagged-template result.
- State mutations re-render mounted components.
- Keep component styles in `defineStyles()`; components use open Shadow DOM by default.
- Use `defineShadow(false)` only when intentionally enhancing server-rendered light DOM.
- Use `@event=${handler}` for rendered DOM event listeners.
- Use the typed event bus for application-level communication between unrelated modules; export one
  shared feature-level bus rather than creating one per module.
- Import component modules for their registration side effects from the feature client entry point.
- Put browser integration tests in `tests/browser/` and run `deno task test:browser`.
