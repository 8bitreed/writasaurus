---
name: app-ui-components
description: Build UI features in Writasaurus using the standardized, accessible web component primitives from src/lib/ui/. Always use these components instead of raw HTML elements when constructing user interfaces.
---

# Standard App UI Components (`src/lib/ui/`)

When building new UI features, dialogs, panels, settings, or views in Writasaurus, **always use the
standard UI components** from `src/lib/ui/index.ts` rather than raw HTML inputs or unstyled
controls.

All components are built using the fluent `webComponent` builder framework, employ shadow DOM
scoping, and are themed with CSS custom properties matching the Writasaurus design system (`--bg`,
`--surface`, `--surface-sunken`, `--text`, `--muted`, `--border`, `--accent`, `--accent-text`).

---

## Importing Components

Import the component tag definitions and/or helper renderers from `src/lib/ui/index.ts`:

```ts
import {
  appButton,
  appCard,
  appInput,
  appSelect,
  // ...
} from "../../../lib/ui/index.ts";
```

Importing registers the custom elements globally in the browser custom elements registry.

---

## Available Component Library

### 1. Form & Input Controls (`src/lib/ui/inputs/`)

- **`<app-input>`**: Text, email, password, search, number input.
  - Attributes: `value`, `placeholder`, `type`, `name`, `disabled`, `required`, `readonly`, `label`,
    `helperText`, `errorText`.
  - Properties & Methods: `.value`, `.focus()`.
  - Events: `@input`, `@change`.
- **`<app-select>`**: Select dropdown with custom chevron indicator.
  - Attributes: `value`, `name`, `disabled`, `required`, `label`, `helperText`.
  - Content: `<option>` elements in default slot.
  - Properties & Methods: `.value`, `.focus()`.
  - Events: `@change`.
- **`<app-button>`**: Standard action button.
  - Attributes: `variant` (`"primary"` | `"secondary"` | `"subtle"` | `"danger"`), `size` (`"small"`
    | `"medium"` | `"large"`), `type` (`"button"` | `"submit"` | `"reset"`), `disabled`.
  - Properties & Methods: `.focus()`.
- **`<app-checkbox>`**: Styled checkbox with custom check indicator.
  - Attributes: `checked`, `value`, `name`, `disabled`, `required`, `label`.
  - Properties & Methods: `.checked`, `.value`, `.focus()`.
  - Events: `@change`.
- **`<app-switch>`**: Accessible toggle switch.
  - Attributes: `checked`, `value`, `name`, `disabled`, `required`, `label`.
  - Properties & Methods: `.checked`, `.value`, `.focus()`.
  - Events: `@change`.
- **`<app-datepicker>`**: Date picker wrapping browser-native picking capability.
  - Attributes: `value`, `name`, `min`, `max`, `step`, `disabled`, `required`, `readonly`, `label`,
    `helperText`.
  - Properties & Methods: `.value`, `.focus()`, `.showPicker()`.
  - Events: `@input`, `@change`.
- **`<app-textarea>`**: Multi-line auto-height / vertically resizable text area.
  - Attributes: `value`, `name`, `placeholder`, `rows`, `disabled`, `required`, `readonly`, `label`,
    `helperText`, `errorText`.
  - Properties & Methods: `.value`, `.focus()`.
  - Events: `@input`, `@change`.
- **`<app-radio>`**: Radio selection button.
  - Attributes: `checked`, `value`, `name`, `label`, `disabled`, `required`.
  - Properties & Methods: `.checked`, `.value`, `.focus()`.
  - Events: `@change`.
- **`<app-slider>`**: Range input slider.
  - Attributes: `value`, `min`, `max`, `step`, `name`, `disabled`, `label`, `showValue`.
  - Properties & Methods: `.value`, `.focus()`.
  - Events: `@input`, `@change`.
- **`<app-form-field>`**: Composite layout wrapper.
  - Attributes: `label`, `required`, `helperText`, `errorText`.
  - Slots: default slot holds any form input control.

### 2. Layout & Structure (`src/lib/ui/`)

- **`<app-card>`**: Styled content card.
  - Attributes: `variant` (`"default"` | `"outlined"` | `"sunken"` | `"elevated"`), `padding`
    (`"none"` | `"small"` | `"medium"` | `"large"`), `interactive`.
  - Slots: `header`, default, `footer`.
- **`<app-accordion>`**: Expandable section wrapper.
  - Attributes: `open`, `summary`, `disabled`.
  - Slots: `summary` (optional custom header), default (content).
  - Properties & Methods: `.open`, `.toggle()`.
  - Events: `@toggle`.
- **`<app-tabs>`**: Tabbed container navigation.
  - Attributes: `activeTab`.
  - Slots: `tab` (elements with `data-tab="id"`), `panel` (elements with `data-tab="id"`).
  - Properties & Methods: `.activeTab`, `.selectTab(tabId)`.
  - Events: `@tab-change`.
- **`<app-divider>`**: Visual separator rule.
  - Attributes: `orientation` (`"horizontal"` | `"vertical"`), `label`.
- **`<app-drawer>`**: Slide-in side drawer.
  - Attributes: `open`, `placement` (`"left"` | `"right"`), `title`.
  - Slots: `header`, default, `footer`.
  - Properties & Methods: `.open`, `.show()`, `.close()`, `.toggle()`.
  - Events: `@open`, `@close`.

### 3. Feedback & Overlays (`src/lib/ui/`)

- **`<app-modal>`**: Dialog overlay modal.
  - Attributes: `open`, `title`, `size` (`"small"` | `"medium"` | `"large"`).
  - Slots: `header`, default, `footer`.
  - Properties & Methods: `.open`, `.show()`, `.close()`.
  - Events: `@open`, `@close`.
- **`<app-tooltip>`**: Contextual hover/focus popover tip.
  - Attributes: `content`, `position` (`"top"` | `"bottom"` | `"left"` | `"right"`).
  - Slots: default (wrapped element), `content` (optional rich HTML content).
- **`<app-dropdown-menu>`**: Dropdown popover menu.
  - Attributes: `open`, `placement` (`"bottom-start"` | `"bottom-end"`).
  - Slots: `trigger`, default (menu items with `role="menuitem"`).
  - Properties & Methods: `.open`, `.toggle()`, `.close()`.
  - Events: `@toggle`, `@close`.
- **`<app-toast>`**: Transient toast notification.
  - Attributes: `variant` (`"info"` | `"success"` | `"warning"` | `"error"`), `open`, `duration`
    (ms, default 3000).
  - Slots: default.
  - Properties & Methods: `.open`, `.show()`, `.dismiss()`.
  - Events: `@show`, `@dismiss`.
- **`<app-alert>`**: Inline alert notice banner.
  - Attributes: `variant` (`"info"` | `"success"` | `"warning"` | `"error"`), `dismissible`,
    `title`.
  - Slots: `icon`, default.
  - Properties & Methods: `.dismiss()`.
  - Events: `@dismiss`.

### 4. Data Display & Status (`src/lib/ui/`)

- **`<app-chip>`**: Tag badge with optional dismiss action.
  - Attributes: `variant` (`"default"` | `"accent"` | `"outline"`), `removable`, `selected`,
    `disabled`.
  - Slots: `icon`, default.
  - Events: `@remove`.
- **`<app-avatar>`**: User avatar with image or initial fallback.
  - Attributes: `src`, `alt`, `name`, `size` (`"small"` | `"medium"` | `"large"`).
- **`<app-progress-bar>`**: Linear progress indicator.
  - Attributes: `value`, `max`, `label`, `showPercentage`.
- **`<app-spinner>`**: Loading indicator animation.
  - Attributes: `size` (`"small"` | `"medium"` | `"large"`).
- **`<app-stat-card>`**: Statistic metric card.
  - Attributes: `title`, `value`, `description`, `trend`, `trendDirection` (`"up"` | `"down"` |
    `"neutral"`).
  - Slots: `icon`, default.

---

## Examples

### Building a Form Section

```ts
html`
  <app-card variant="outlined" padding="medium">
    <div slot="header">
      <h3>Manuscript Details</h3>
    </div>

    <app-input
      label="Title"
      placeholder="Enter manuscript title..."
      .value=${manuscript.title}
      @input=${onTitleChange}
    ></app-input>

    <app-select label="Genre" .value=${manuscript.genre} @change=${onGenreChange}>
      <option value="fiction">Fiction</option>
      <option value="non-fiction">Non-Fiction</option>
      <option value="sci-fi">Sci-Fi</option>
    </app-select>

    <app-switch
      label="Enable Auto-Outline"
      .checked=${manuscript.autoOutline}
      @change=${onToggleOutline}
    ></app-switch>

    <div slot="footer">
      <app-button variant="primary" @click=${onSave}>Save Changes</app-button>
    </div>
  </app-card>
`;
```

### Confirmation Modal

```ts
html`
  <app-modal id="confirm-modal" title="Delete Chapter" size="small">
    <p>Are you sure you want to delete this chapter? This cannot be undone.</p>
    <div slot="footer">
      <app-button variant="subtle" @click=${() => modal.close()}>Cancel</app-button>
      <app-button variant="danger" @click=${onConfirmDelete}>Delete</app-button>
    </div>
  </app-modal>
`;
```
