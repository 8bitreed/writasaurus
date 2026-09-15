import { html, webComponent } from "../../framework/web-components/index.ts";

webComponent("about-counter")
  .defineState({
    count: 0,
  })
  .defineShadow(false)
  .defineObservedAttributes({
    name: "John",
    lastName: "Smith",
  })
  .defineMethod("increment", (el) => {
    return () => el.state.count++;
  })
  .defineComputed(
    "fullName",
    (el): [string, string] => [el.observedAttribute.name, el.observedAttribute.lastName],
    (name, lastName) => `${name} ${lastName}`,
  )
  .defineRender((el) => {
    return html`
      <p>Hello, ${el.computed.fullName}!</p>
      <p>Count: ${el.state.count}</p>
      <button class="button primary" @click=${el.increment}>Increment</button>
      ${el.state.count >= 10 ? html`<p>You've reached 10!</p>` : ""}
    `;
  })
  .create();
