import { describe, it, expect, vi } from 'vitest';
import { signal, computed, effect, batch, flushPending, untrack, readonly } from '../src/index';

describe('signal', () => {
  it('returns initial value on get()', () => {
    const s = signal(42);
    expect(s.get()).toBe(42);
  });

  it('returns updated value after set()', () => {
    const s = signal(0);
    s.set(1);
    expect(s.get()).toBe(1);
  });

  it('triggers an effect that reads it', () => {
    const s = signal(0);
    const fn = vi.fn(() => s.get());
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    s.set(1);
    flushPending();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not trigger effect when set to same value', () => {
    const s = signal(0);
    const fn = vi.fn(() => s.get());
    effect(fn);
    fn.mockClear();
    s.set(0);
    flushPending();
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports multiple signals in one effect', () => {
    const a = signal('hello');
    const b = signal('world');
    const fn = vi.fn(() => `${a.get()} ${b.get()}`);
    effect(fn);
    fn.mockClear();
    a.set('goodbye');
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();
    b.set('earth');
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('computed', () => {
  it('returns computed value', () => {
    const a = signal(2);
    const b = computed(() => a.get() * 2);
    expect(b.get()).toBe(4);
  });

  it('caches and recomputes lazily', () => {
    const a = signal(1);
    const compute = vi.fn(() => a.get() + 1);
    const c = computed(compute);
    expect(compute).not.toHaveBeenCalled();
    expect(c.get()).toBe(2);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(c.get()).toBe(2);
    expect(compute).toHaveBeenCalledTimes(1);
    a.set(2);
    expect(c.get()).toBe(3);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('chains nested computeds', () => {
    const a = signal(1);
    const b = computed(() => a.get() * 2);
    const c = computed(() => b.get() + 1);
    expect(c.get()).toBe(3);
    a.set(2);
    expect(c.get()).toBe(5);
  });

  it('throws on set()', () => {
    const a = signal(1);
    const c = computed(() => a.get());
    expect(() => (c as any).set(5)).toThrow('Cannot set() a computed signal');
  });
});

describe('effect', () => {
  it('runs immediately on creation', () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-runs when a dependency changes', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s.get(); });
    effect(fn);
    fn.mockClear();
    s.set(1);
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('disposer stops effect from re-running', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s.get(); });
    const dispose = effect(fn);
    fn.mockClear();
    dispose();
    s.set(1);
    flushPending();
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports disposer function returned from effect fn', () => {
    const s = signal(0);
    const cleanup = vi.fn();
    const dispose = effect(() => {
      s.get();
      return cleanup;
    });
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('re-runs when computed dependency changes', () => {
    const a = signal(1);
    const b = computed(() => a.get() * 2);
    const fn = vi.fn(() => { b.get(); });
    effect(fn);
    fn.mockClear();
    a.set(2);
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('batching', () => {
  it('batches multiple sets into single effect run', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s.get(); });
    effect(fn);
    fn.mockClear();
    batch(() => {
      s.set(1);
      s.set(2);
      s.set(3);
    });
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.get()).toBe(3);
  });

  it('batches work with nested batch calls', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s.get(); });
    effect(fn);
    fn.mockClear();
    batch(() => {
      s.set(1);
      batch(() => {
        s.set(2);
      });
    });
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.get()).toBe(2);
  });

  it('effect sees intermediate values within batch', () => {
    const s = signal(0);
    const fn = vi.fn(() => { s.get(); });
    effect(fn);
    fn.mockClear();
    batch(() => {
      s.set(1);
      expect(s.get()).toBe(1);
      s.set(2);
    });
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('untrack', () => {
  it('prevents dependency tracking', () => {
    const s = signal(0);
    const fn = vi.fn(() => untrack(() => s.get()));
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();
    s.set(1);
    flushPending();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('readonly', () => {
  it('prevents .set()', () => {
    const s = signal(42);
    const r = readonly(s);
    expect(r.get()).toBe(42);
    expect((r as any).set).toBeUndefined();
  });
});

describe('computed errors', () => {
  it('catches errors and re-throws on get()', () => {
    const c = computed(() => { throw new Error('boom'); });
    expect(() => c.get()).toThrow('boom');
  });

  it('recovers after source signal changes', () => {
    const s = signal(0);
    const c = computed(() => {
      const val = s.get();
      if (val === 0) throw new Error('zero');
      return val;
    });
    expect(() => c.get()).toThrow('zero');
    s.set(1);
    expect(c.get()).toBe(1);
  });
});

describe('flushPending', () => {
  it('flushes scheduled effects', () => {
    const s = signal(0);
    const fn = vi.fn(() => s.get());
    effect(fn);
    fn.mockClear();
    s.set(1);
    expect(fn).not.toHaveBeenCalled();
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flushes all pending effects', () => {
    const a = signal(0);
    const b = signal(0);
    const fnA = vi.fn(() => a.get());
    const fnB = vi.fn(() => b.get());
    effect(fnA);
    effect(fnB);
    fnA.mockClear();
    fnB.mockClear();
    a.set(1);
    b.set(2);
    flushPending();
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });
});

describe('batching with microtask scheduling', () => {
  it('still batches correctly', () => {
    const s = signal(0);
    const fn = vi.fn(() => s.get());
    effect(fn);
    fn.mockClear();
    batch(() => {
      s.set(1);
      s.set(2);
    });
    expect(fn).not.toHaveBeenCalled();
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.get()).toBe(2);
  });
});
