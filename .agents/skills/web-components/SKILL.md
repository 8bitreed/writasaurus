---
name: web-components
description: Build non-trivial Writasaurus browser UI components with the framework component library, renderer, scoped styles, and typed event bus.
---

# Writasaurus Web Components

Use this skill when creating or substantially changing a browser UI component that needs more than trivial JavaScript behavior: DOM event handling, internal state, rendering, lifecycle cleanup, attribute-driven updates, reusable public methods, or component-specific styles.

Do not use the component library merely to wrap static server-rendered markup with no meaningful client behavior.

## Component library

Use `defineWebComponent` from `src/framework/component/component.ts` rather than writing a new `class extends HTMLElement` directly.

```ts
import { defineWebComponent } from "../../../framework/component/component.ts";
import { html } from "../../../framework/html/client_html_renderer.ts";

defineWebComponent(
  "example-widget",
  { observedAttributes: { label: "Default label" } },
  ({
    connectedCallback,
    defineProperty,
    defineRender,
    defineState,
    defineStyles,
    disconnectedCallback,
  }) => {
    defineStyles(/* css */ `
    :host { display: block; }
  `);

    defineState({ pressed: false });

    defineRender(
      (element) => html`
        <button type="button">${element.observedAttribute.label}</button>
      `,
    );

    connectedCallback((element) => {
      // Attach listeners after the first render.
    });

    disconnectedCallback((element) => {
      // Remove listeners registered above.
    });

    defineProperty("reset", function () {
      // Public custom-element API.
    });
  },
);
```

### Typed Composition API

For typed state and attributes, prefer the three-argument form. The setup callback runs once per custom-element instance, and `defineState()` returns the element's reactive state object:

```ts
defineWebComponent(
  "counter-widget",
  { observedAttributes: { label: "Count" } },
  (element, { defineRender, defineState }) => {
    const state = defineState(() => ({ count: 0 }));

    defineRender(
      () =>
        html`<button>
          ${element.observedAttribute.label}: ${state.count}
        </button>`,
    );
  },
);
```

### Rules

- Call `defineRender()` only when the component owns declarative DOM. If it is omitted, `render()` and observed-attribute updates are no-ops.
- `defineRender()` must return the client renderer's `html` tagged-template result, not an HTML string.
- In renderer attributes, an interpolation must occupy the entire attribute value. Compute mixed static/dynamic values first:

  ```ts
  html`<span class=${`indicator ${state}`}></span>`;
  ```

  Do not write `class="indicator ${state}"`.

- Keep component-specific CSS in `defineStyles()`. Components use shadow DOM by default, so page styles do not style their internal markup.
- Use `defineShadow(false)` only when light DOM is intentional and an external stylesheet must style the component content.
- Prefer the schema form for typed observed attributes: `defineWebComponent("name", { observedAttributes: { count: 0, active: false } }, setup)`. Schema values determine both defaults and runtime parsing, and give `element.observedAttribute.count` the `number` type.
- Use `defineObservedAttribute(name, defaultValue)` only when the schema cannot be declared up front; it triggers re-renders but cannot refine TypeScript types inside the existing setup callback.
- Use `defineState(initialState?)` for mutable per-instance state. Every component receives a distinct `{}` state object by default. Plain-object and array mutations automatically re-render after mount. Pass a factory for nested or computed state: `defineState(() => ({ items: [] }))`.
- Use `defineProperty(name, value)` repeatedly for public prototype methods or values. Do not use it for mutable instance state, because properties defined this way are shared through the prototype. Do not redefine framework-managed names such as `render`, lifecycle callbacks, `$`, `$$`, `emit`, `root`, `state`, or `observedAttribute`.
- Use lifecycle registration functions for native custom-element callback behavior rather than defining those properties directly.
- `$` and `$$` in the component setup callback are available only while a registered lifecycle callback is running. Lifecycle callbacks also receive the current element explicitly.

## Events and module boundaries

Use DOM events for native element behavior and interactions that must bubble through the DOM. Use the framework event bus for application-level communication between unrelated modules.

Create and export one typed feature-level bus from a neutral module; all publishers and subscribers must import that same singleton:

```ts
import { createEventBus } from "../../../framework/events/event-bus.ts";

interface EditorEvents {
  command: { command: string; target: string; value?: string };
}

export const editorEvents = createEventBus<EditorEvents>();
```

Publish intent from the component:

```ts
editorEvents.emit("command", { command: "bold", target: "#editor" });
```

Subscribe in the module that owns the effect:

```ts
editorEvents.on("command", ({ command, target, value }) => {
  // Find the target and perform the editor operation.
});
```

Do not create a new bus in every module; separate calls to `createEventBus()` create isolated buses.

## Shadow DOM events

When listening to events from a component's shadow-root content, attach the listener to `element.root`, not the host, when the actual inner target is needed. Host-level listeners receive retargeted events.

For rich-text toolbar buttons, prevent default on `mousedown` for command buttons so the editor selection is preserved before the command runs.

## Placement and registration

- Place feature-specific components under that feature's `client/` directory, for example `src/features/editor/client/editor-toolbar.ts`.
- Import component modules for their registration side effects from the feature's `.client.ts` entry point. Do not rely on type-only imports.
- Browser entry files use `.client.ts`; supporting modules use normal `.ts` filenames.
- Run focused formatting, `deno check` for the affected client entry point, and relevant tests after changes. Run `deno task build` when views or bundled assets change.
- Put real-browser component integration tests in `tests/browser/` and run `deno task test:browser`. This task builds the assets, starts the application in-process, and launches Playwright Chromium. Install its browser binary once with `deno run -A npm:playwright install chromium`.
