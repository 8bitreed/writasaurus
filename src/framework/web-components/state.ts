/**
 * A tiny reactive store for state shared between components.
 *
 * The store is intentionally shallow: assigning a top-level property notifies
 * subscribers, while mutating nested objects or arrays does not. Use
 * {@linkcode Store.update} for nested edits; it batches every change made
 * inside the callback into a single notification.
 */

export type Unsubscribe = () => void;

/** Anything a component can subscribe to for re-render notifications. */
export interface Subscribable {
  subscribe(listener: () => void): Unsubscribe;
}

export interface Store<T extends object = Record<string, unknown>> extends Subscribable {
  /** Reactive state. Assigning a top-level property notifies subscribers. */
  readonly state: T;
  /** Registers a listener and returns its unsubscribe function. */
  subscribe(listener: () => void): Unsubscribe;
  /** Applies a partial update, notifying subscribers once. */
  set(partial: Partial<T>): void;
  /** Mutates state (including nested values), notifying subscribers once. */
  update(mutate: (state: T) => void): void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  const listeners = new Set<() => void>();
  let depth = 0;
  let pending = false;

  function notify(): void {
    if (depth > 0) {
      pending = true;
      return;
    }
    for (const listener of [...listeners]) listener();
  }

  function batch(mutate: () => void): void {
    depth++;
    try {
      mutate();
    } finally {
      depth--;
      if (depth === 0 && pending) {
        pending = false;
        notify();
      }
    }
  }

  const state = new Proxy({ ...initial }, {
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

  return {
    state,
    subscribe(listener: () => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(partial: Partial<T>): void {
      batch(() => Object.assign(state, partial));
    },
    update(mutate: (state: T) => void): void {
      batch(() => {
        mutate(state);
        pending = true;
      });
    },
  };
}
