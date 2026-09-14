export type EventListener<T> = (detail: T) => void;

/** A small synchronous, typed publish/subscribe event bus. */
export class EventBus<Events extends object> {
  #listeners = new Map<keyof Events, Set<EventListener<unknown>>>();

  on<Name extends keyof Events>(name: Name, listener: EventListener<Events[Name]>): () => void {
    let listeners = this.#listeners.get(name);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(name, listeners);
    }
    listeners.add(listener as EventListener<unknown>);
    return () => this.off(name, listener);
  }

  off<Name extends keyof Events>(name: Name, listener: EventListener<Events[Name]>): void {
    const listeners = this.#listeners.get(name);
    if (!listeners) return;
    listeners.delete(listener as EventListener<unknown>);
    if (listeners.size === 0) this.#listeners.delete(name);
  }

  emit<Name extends keyof Events>(name: Name, detail: Events[Name]): void {
    const listeners = this.#listeners.get(name);
    if (!listeners) return;
    for (const listener of [...listeners]) listener(detail);
  }

  clear(name?: keyof Events): void {
    if (name === undefined) this.#listeners.clear();
    else this.#listeners.delete(name);
  }
}

export function createEventBus<Events extends object>(): EventBus<Events> {
  return new EventBus<Events>();
}
