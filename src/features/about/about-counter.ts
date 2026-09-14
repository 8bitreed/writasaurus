import { createWebComponent, html } from "../../framework/web-components/index.ts";

createWebComponent("about-counter")
  .defineState({
    count: 0,
  })
  .defineShadow(false)
  .defineObservedAttributes({
    name: "John",
    lastName: "Smith",
  })
  .defineMethod("increment", (element) => {
    return () => element.state.count++;
  })
  .defineRender((el) => {
    const fullname = `${el.observedAttribute.name} ${el.observedAttribute.lastName}`;

    return html`
      <p>Hello, ${fullname}!</p>
      <p>Count: ${el.state.count}</p>
      <button class="button primary" @click=${el.increment}>Increment</button>
      ${el.state.count >= 10 ? html`<p>You've reached 10!</p>` : ""}
    `;
  })
  .define();
