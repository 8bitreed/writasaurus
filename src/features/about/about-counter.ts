import { defineWebComponent, html } from "../../framework/web-components/index.ts";

defineWebComponent("about-counter", (c) => {
  return c.defineState({
    count: 0,
  })
    .defineMethod("increment", (element) => {
      return () => element.state.count++;
    })
    .defineRender((el) => {
      const { count } = el.state;

      return html`
        <div>
          <p>Count: ${count}</p>
          <button @click=${el.increment}>Increment</button>
        </div>
      `;
    });
});
