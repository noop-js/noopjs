export interface Signal<T> {
  get(): T;
  set(newValue: T): void;
}

interface ReactiveNode {
  deps: Set<SignalImpl<any> | ComputedImpl<any>>;
  subscribers: Set<ReactiveNode>;
  _notify(): void;
}

let currentTracker: ReactiveNode | null = null;
let batchDepth = 0;
let microtaskScheduled = false;
const pendingEffects = new Set<EffectImpl>();

function flushEffects(): void {
  microtaskScheduled = false;
  while (pendingEffects.size > 0) {
    const effects = [...pendingEffects];
    pendingEffects.clear();
    for (const eff of effects) {
      if (eff.dirty && !eff.disposed) {
        try {
          eff.execute();
        } catch (e) {
          console.error('[Noop] Effect error:', e);
        }
      }
    }
  }
}

function scheduleFlushEffects(): void {
  if (!microtaskScheduled) {
    microtaskScheduled = true;
    queueMicrotask(flushEffects);
  }
}

export function startBatch(): void {
  batchDepth++;
}

export function endBatch(): void {
  batchDepth--;
  if (batchDepth === 0) {
    scheduleFlushEffects();
  }
}

export function batch<T>(fn: () => T): T {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}

/** For testing: synchronously flush any scheduled effects */
export function flushPending(): void {
  if (microtaskScheduled) {
    flushEffects();
  }
}

class SignalImpl<T> {
  private _value: T;
  subscribers = new Set<ReactiveNode>();

  constructor(value: T) {
    this._value = value;
  }

  get(): T {
    if (currentTracker) {
      currentTracker.deps.add(this);
      this.subscribers.add(currentTracker);
    }
    return this._value;
  }

  set(newValue: T): void {
    if (newValue !== this._value) {
      this._value = newValue;
      for (const sub of this.subscribers) {
        sub._notify();
      }
      if (batchDepth === 0) {
        scheduleFlushEffects();
      }
    }
  }
}

class ComputedImpl<T> implements Signal<T>, ReactiveNode {
  private fn: () => T;
  private _value: T | undefined;
  private _dirty = true;
  private _errored = false;
  private _error: any = null;
  subscribers = new Set<ReactiveNode>();
  deps = new Set<SignalImpl<any> | ComputedImpl<any>>();

  constructor(fn: () => T) {
    this.fn = fn;
  }

  get(): T {
    if (currentTracker) {
      currentTracker.deps.add(this);
      this.subscribers.add(currentTracker);
    }
    if (this._dirty) {
      this._evaluate();
    }
    if (this._errored) throw this._error;
    return this._value as T;
  }

  set(_newValue: T): void {
    throw new Error('Cannot set() a computed signal');
  }

  _notify(): void {
    if (this._dirty) return;
    this._dirty = true;
    this._errored = false; // allow retry
    this._error = null;
    for (const sub of this.subscribers) {
      sub._notify();
    }
  }

  private _evaluate(): void {
    const oldDeps = new Set(this.deps);
    this.deps.clear();

    const prevTracker = currentTracker;
    currentTracker = this;
    try {
      this._value = this.fn();
      this._errored = false;
      this._error = null;
    } catch (e) {
      this._errored = true;
      this._error = e;
    } finally {
      currentTracker = prevTracker;
    }

    for (const dep of oldDeps) {
      if (!this.deps.has(dep)) {
        dep.subscribers.delete(this);
      }
    }

    this._dirty = false;
  }
}

class EffectImpl implements ReactiveNode {
  fn: () => void;
  deps = new Set<SignalImpl<any> | ComputedImpl<any>>();
  dirty = false;
  disposed = false;
  subscribers = new Set<ReactiveNode>();
  private disposer: (() => void) | null = null;

  constructor(fn: () => void) {
    this.fn = fn;
  }

  _notify(): void {
    if (!this.dirty && !this.disposed) {
      this.dirty = true;
      pendingEffects.add(this);
    }
  }

  execute(): void {
    if (this.disposed) return;

    // Save old deps in case execution fails — we need to stay subscribed for retry
    const oldDeps = new Set(this.deps);
    for (const dep of this.deps) {
      dep.subscribers.delete(this);
    }
    this.deps.clear();

    const prevTracker = currentTracker;
    currentTracker = this;
    try {
      const result = this.fn();
      if (typeof result === 'function') {
        this.disposer = result;
      }
      this.dirty = false;
    } catch (e) {
      // Restore old deps so we stay subscribed and retry on next change
      this.deps = oldDeps;
      for (const dep of oldDeps) {
        dep.subscribers.add(this);
      }
      this.dirty = true;
      pendingEffects.add(this);
      throw e;
    } finally {
      currentTracker = prevTracker;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.dirty = false;
    pendingEffects.delete(this);
    for (const dep of this.deps) {
      dep.subscribers.delete(this);
    }
    this.deps.clear();
    if (this.disposer) {
      this.disposer();
      this.disposer = null;
    }
  }
}

export function signal<T>(initialValue: T): Signal<T> {
  const impl = new SignalImpl(initialValue);
  return {
    get: () => impl.get(),
    set: (v: T) => impl.set(v),
  };
}

export function computed<T>(fn: () => T): Signal<T> {
  const impl = new ComputedImpl(fn);
  return {
    get: () => impl.get(),
    set: (_v: T) => impl.set(_v),
  };
}

export function effect(fn: () => void): () => void {
  const eff = new EffectImpl(fn);
  eff.execute();
  return () => eff.dispose();
}

export function untrack<T>(fn: () => T): T {
  const prev = currentTracker;
  currentTracker = null;
  try {
    return fn();
  } finally {
    currentTracker = prev;
  }
}

export function readonly<T>(signal: Signal<T>): { get(): T } {
  return { get: () => signal.get() };
}
