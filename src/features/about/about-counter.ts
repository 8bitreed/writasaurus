import { defineWebComponent, html } from "../../framework/web-components/index.ts";

defineWebComponent("about-counter", (c) => {
  return c.defineState({
    count: 0,
  })
    .defineShadow(false)
    .defineObservedAttributes({
      name: "World",
    })
    .defineMethod("increment", (element) => {
      return () => element.state.count++;
    })
    .defineRender((el) => {
      const { count } = el.state;
      const { name } = el.observedAttribute;

      return html`
        <div>
          <p>Hello, ${name}!</p>
          <p>Count: ${count}</p>
          <button class="button primary" @click=${el.increment}>Increment</button>
          ${count >= 10 ? html`<p>You've reached 10!</p>` : ""}
        </div>
      `;
    });
});
