import { createEventBus } from "../src/framework/events/event-bus.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("event bus: delivers typed events and unsubscribes listeners", () => {
  const events = createEventBus<{ saved: { filename: string } }>();
  const received: string[] = [];
  const unsubscribe = events.on("saved", ({ filename }) => received.push(filename));

  events.emit("saved", { filename: "first.md" });
  unsubscribe();
  events.emit("saved", { filename: "second.md" });

  assertEquals(received.join(","), "first.md");
});

Deno.test("event bus: clear removes a single event's listeners", () => {
  const events = createEventBus<{ changed: number; saved: number }>();
  let changed = 0;
  let saved = 0;
  events.on("changed", () => changed++);
  events.on("saved", () => saved++);

  events.clear("changed");
  events.emit("changed", 1);
  events.emit("saved", 1);

  assertEquals(changed, 0);
  assertEquals(saved, 1);
});
