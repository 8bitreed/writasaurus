/**
 * Wraps an object in a shallow reactive Proxy that invokes `notify` whenever
 * a property is set or deleted and its value changed.
 */
export function reactive<T extends object>(state: T, notify: () => void): T {
  return new Proxy(state, {
    set(target, property, value) {
      const previous = Reflect.get(target, property);
      const applied = Reflect.set(target, property, value);
      if (applied && !Object.is(previous, value)) notify();
      return applied;
    },
    deleteProperty(target, property) {
      const applied = Reflect.deleteProperty(target, property);
      if (applied) notify();
      return applied;
    },
  });
}
