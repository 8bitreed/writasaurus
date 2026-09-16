/**
 * A tiny reactive store for state shared between components.
 *
 * The store is intentionally shallow: assigning a top-level property notifies
 * subscribers, while mutating nested objects or arrays does not. Use
 * {@linkcode Store.update} for nested edits; it batches every change made
 * inside the callback into a single notification.
 */

import type { Store, Unsubscribe } from "./types.ts";
import { reactive } from "./reactive-state.ts";

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

  const state = reactive({ ...initial }, notify);

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
