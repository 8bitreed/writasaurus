import { createStore } from "../src/framework/web-components/state.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("store: notifies subscribers when a top-level property changes", () => {
  const store = createStore({ count: 0, title: "Initial" });
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);

  store.state.count = 1;
  assertEquals(store.state.count, 1);
  assertEquals(notifications, 1);

  store.state.count = 1;
  assertEquals(notifications, 1);

  unsubscribe();
  store.state.count = 2;
  assertEquals(notifications, 1);
});

Deno.test("store: set applies a partial update and notifies once", () => {
  const store = createStore({ count: 0, title: "Initial" });
  let notifications = 0;
  store.subscribe(() => notifications++);

  store.set({ count: 2, title: "Updated" });

  assertEquals(store.state.count, 2);
  assertEquals(store.state.title, "Updated");
  assertEquals(notifications, 1);
});

Deno.test("store: update notifies once for nested mutations", () => {
  const store = createStore({ items: [1, 2], meta: { open: false } });
  let notifications = 0;
  store.subscribe(() => notifications++);

  store.state.items.push(3);
  assertEquals(notifications, 0);

  store.update((state) => {
    state.items.push(4);
    state.meta.open = true;
  });

  assertEquals(store.state.items, [1, 2, 3, 4]);
  assertEquals(store.state.meta.open, true);
  assertEquals(notifications, 1);
});
