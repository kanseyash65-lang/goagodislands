import { createLogger } from '../logger/logger';
import type { GameEventName, GameEvents } from './event-types';

const log = createLogger('events');

type Handler<K extends GameEventName> = (payload: GameEvents[K]) => void;

/** Typed event bus. Systems talk only through this. */
export interface IEventBus {
  on<K extends GameEventName>(type: K, handler: Handler<K>): () => void;
  emit<K extends GameEventName>(type: K, payload: GameEvents[K]): void;
  /** Queue an event to be dispatched on the next flush (use during system updates). */
  defer<K extends GameEventName>(type: K, payload: GameEvents[K]): void;
}

interface Deferred {
  readonly type: GameEventName;
  readonly payload: unknown;
}

export class EventBus implements IEventBus {
  private readonly handlers = new Map<GameEventName, Set<(p: unknown) => void>>();
  private queue: Deferred[] = [];

  on<K extends GameEventName>(type: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const h = handler as (p: unknown) => void;
    set.add(h);
    return () => set?.delete(h);
  }

  emit<K extends GameEventName>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (err) {
        // One faulty listener must never break the others (or the demo).
        log.error(`handler for ${type} failed`, err);
      }
    }
  }

  defer<K extends GameEventName>(type: K, payload: GameEvents[K]): void {
    this.queue.push({ type, payload });
  }

  flush(): void {
    if (this.queue.length === 0) return;
    const pending = this.queue;
    this.queue = [];
    for (const e of pending) this.emit(e.type, e.payload as never);
  }
}
