// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bindEvent, bindText, bindAttribute, bindStyle, createContext, useContext, ErrorBoundary, Suspense, onMount, onUpdate, createPortal, startEffectCleanup, stopEffectCleanup, __noopFreezeProps } from '../src/index';
import { signal } from '@noopjs/signals';
import { flushPending } from '@noopjs/signals';

describe('bindEvent (runtime)', () => {
  it('registers handler in delegation registry in client mode', () => {
    const el = document.createElement('button');
    const handler = vi.fn();

    bindEvent(el, 'click', handler, 'h_test');

    expect(el.getAttribute('data-noop-ev')).toBe('h_test');
  });

  it('sets up document-level delegation for the event type', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const handler = vi.fn();

    bindEvent(el, 'click', handler, 'h_test');

    el.click();
    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
  });

  it('delegates to correct handler via data-noop-ev attribute', () => {
    const el1 = document.createElement('button');
    const el2 = document.createElement('button');
    document.body.appendChild(el1);
    document.body.appendChild(el2);
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bindEvent(el1, 'click', handler1, 'h_1');
    bindEvent(el2, 'click', handler2, 'h_2');

    el2.click();
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);

    document.body.removeChild(el1);
    document.body.removeChild(el2);
  });

  it('works with multiple event types', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    // Use two different clickable children to test different event types
    const btn = document.createElement('button');
    el.appendChild(btn);
    const clickHandler = vi.fn();
    bindEvent(btn, 'click', clickHandler, 'h_click');

    const btn2 = document.createElement('button');
    el.appendChild(btn2);
    const clickHandler2 = vi.fn();
    bindEvent(btn2, 'click', clickHandler2, 'h_click2');

    btn.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
    expect(clickHandler2).not.toHaveBeenCalled();

    btn2.click();
    expect(clickHandler2).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
  });

  it('dispatches __noop_handler for unknown handlerIds (SSR path)', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);

    el.setAttribute('data-noop-ev', 'ssr_handler');

    const listener = vi.fn();
    el.addEventListener('__noop_handler', listener);

    el.click();

    expect(listener).toHaveBeenCalled();
    const detail = listener.mock.calls[0][0].detail;
    expect(detail.handlerId).toBe('ssr_handler');

    document.body.removeChild(el);
  });
});

describe('createContext / useContext', () => {
  it('provides default value when no Provider wraps', () => {
    const Theme = createContext('light');
    expect(useContext(Theme)).toBe('light');
  });

  it('Provider sets value for child useContext (lazy children)', () => {
    const Theme = createContext('light');
    let captured: any;
    const Consumer = () => { captured = useContext(Theme); return null; };
    // When children are lazy (thunk), useContext runs inside Provider
    Theme.Provider({ value: 'dark', children: () => Consumer() });
    expect(captured).toBe('dark');
  });

  it('Provider passes value to nested consumption', () => {
    const User = createContext({ name: 'anon' });
    let captured: any;
    const Consumer = () => { captured = useContext(User); return null; };
    User.Provider({ value: { name: 'alice' }, children: () => Consumer() });
    expect(captured).toEqual({ name: 'alice' });
  });

  it('nested Providers override outer value', () => {
    const Theme = createContext('light');
    let inner: any;
    const InnerConsumer = () => { inner = useContext(Theme); return null; };
    Theme.Provider({
      value: 'dark',
      children: () => Theme.Provider({
        value: 'darker',
        children: () => InnerConsumer(),
      }),
    });
    expect(inner).toBe('darker');
  });

  it('returns default value outside Provider', () => {
    const Theme = createContext('light');
    expect(useContext(Theme)).toBe('light');
  });
});

describe('Suspense', () => {
  it('renders children directly when synchronous', () => {
    const el = document.createElement('span');
    const result = Suspense({ children: () => el });
    expect(result).toBe(el);
  });

  it('renders fallback initially then replaces with async children', async () => {
    const el = document.createElement('span');
    const fallback = document.createElement('div');
    const result = Suspense({
      children: () => new Promise<any>(resolve => setTimeout(() => resolve(el), 5)),
      fallback,
    });
    expect(result.nodeType).toBe(11); // DocumentFragment
    // First child should be the fallback
    expect(result.firstChild).toBe(fallback);
    // After promise resolves, should be replaced with el
    await new Promise(r => setTimeout(r, 10));
    expect(result.firstChild).toBe(el);
  });

  it('renders function fallback for async content', () => {
    const fallbackFn = () => document.createComment('loading');
    const result = Suspense({
      children: () => new Promise(() => {}), // never resolves
      fallback: fallbackFn,
    });
    expect(result.firstChild?.nodeType).toBe(8); // comment
  });

  it('SSR path returns children directly', () => {
    (globalThis as any).__NOOP_SSR = true;
    const el = document.createElement('span');
    const result = Suspense({ children: () => el, fallback: document.createElement('div') });
    expect(result).toBe(el);
    delete (globalThis as any).__NOOP_SSR;
  });
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    const el = document.createElement('div');
    const result = ErrorBoundary({
      children: () => el,
    });
    expect(result).toBe(el);
  });

  it('renders fallback when children throw', () => {
    const fallback = document.createElement('span');
    fallback.textContent = 'error';
    const result = ErrorBoundary({
      children: () => { throw new Error('boom'); },
      fallback,
    });
    expect(result).toBe(fallback);
  });

  it('renders function fallback with error', () => {
    const result = ErrorBoundary({
      children: () => { throw new Error('boom'); },
      fallback: ({ error }: any) => {
        const el = document.createElement('div');
        el.textContent = error.message;
        return el;
      },
    });
    expect(result.textContent).toBe('boom');
  });

  it('calls onError when children throw', () => {
    const onError = vi.fn();
    ErrorBoundary({
      children: () => { throw new Error('boom'); },
      fallback: document.createComment('err'),
      onError,
    });
    expect(onError).toHaveBeenCalledWith(new Error('boom'));
  });

  it('renders comment node when no fallback provided', () => {
    const result = ErrorBoundary({
      children: () => { throw new Error('boom'); },
    });
    expect(result.nodeType).toBe(8); // comment node
  });
});

describe('onMount', () => {
  it('fires callback in client mode', () => {
    const fn = vi.fn();
    onMount(fn);
    expect(fn).not.toHaveBeenCalled();
    // Flush microtask queue (onMount uses queueMicrotask)
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1);
        resolve();
      }, 0);
    });
  });

  it('does not fire during SSR', () => {
    (globalThis as any).__NOOP_SSR = true;
    const fn = vi.fn();
    onMount(fn);
    expect(fn).not.toHaveBeenCalled();
    delete (globalThis as any).__NOOP_SSR;
  });
});

describe('onUpdate', () => {
  it('invokes callback when dependency changes', () => {
    const s = signal(0);
    const fn = vi.fn();
    const dispose = onUpdate([() => s.get()], fn);
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();
    s.set(1);
    flushPending();
    expect(fn).toHaveBeenCalledTimes(1);
    dispose();
  });
});

describe('createPortal', () => {
  it('appends portal content to target on microtask', () => {
    const target = document.createElement('div');
    const content = document.createElement('span');
    content.textContent = 'portal content';
    const result = createPortal(content, target);
    expect(result).toBe(content);
    expect(content.parentNode).toBeNull();
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(content.parentNode).toBe(target);
        resolve();
      }, 0);
    });
  });
});

describe('effect cleanup via MutationObserver', () => {
  beforeEach(() => {
    stopEffectCleanup();
  });

  it('disposes bindAttribute effect on element removal', async () => {
    const s = signal('initial');
    const el = document.createElement('div');
    bindAttribute(el, 'class', () => s.get());
    document.body.appendChild(el);
    startEffectCleanup();

    expect(el.className).toBe('initial');

    s.set('updated');
    flushPending();
    expect(el.className).toBe('updated');

    document.body.removeChild(el);
    // Yield to microtask queue so MutationObserver fires and disposes effects
    await Promise.resolve();
    s.set('after-removal');
    flushPending();
    expect(el.className).toBe('updated');
  });

  it('disposes bindText effect on parent removal', async () => {
    const s = signal('initial');
    const text = document.createTextNode('');
    const parent = document.createElement('div');
    parent.appendChild(text);
    bindText(text, () => s.get());
    document.body.appendChild(parent);
    startEffectCleanup();

    expect(text.nodeValue).toBe('initial');

    s.set('updated');
    flushPending();
    expect(text.nodeValue).toBe('updated');

    document.body.removeChild(parent);
    await Promise.resolve();
    s.set('after-removal');
    flushPending();
    expect(text.nodeValue).toBe('updated');
  });

  it('disposes bindStyle effect on element removal', async () => {
    const s = signal('red');
    const el = document.createElement('div');
    bindStyle(el, () => ({ color: s.get() }));
    document.body.appendChild(el);
    startEffectCleanup();

    expect(el.getAttribute('style')).toBe('color:red;');

    s.set('blue');
    flushPending();
    expect(el.getAttribute('style')).toBe('color:blue;');

    document.body.removeChild(el);
    await Promise.resolve();
    s.set('green');
    flushPending();
    expect(el.getAttribute('style')).toBe('color:blue;');
  });

  it('disposes child effects when parent element is removed (subtree)', async () => {
    const s = signal('parent');
    const s2 = signal('child');
    const child = document.createElement('span');
    bindAttribute(child, 'class', () => s2.get());
    const parent = document.createElement('div');
    bindAttribute(parent, 'id', () => s.get());
    parent.appendChild(child);
    document.body.appendChild(parent);
    startEffectCleanup();

    expect(parent.id).toBe('parent');
    expect(child.className).toBe('child');
    s2.set('child-updated');
    flushPending();
    expect(child.className).toBe('child-updated');

    document.body.removeChild(parent);
    await Promise.resolve();
    s.set('parent-removed');
    s2.set('child-removed');
    flushPending();
    expect(parent.id).toBe('parent');
    expect(child.className).toBe('child-updated');
  });

  it('does not clean up effects while element stays in DOM', () => {
    const s = signal('a');
    const el = document.createElement('div');
    bindAttribute(el, 'class', () => s.get());
    document.body.appendChild(el);
    startEffectCleanup();

    s.set('b');
    flushPending();
    expect(el.className).toBe('b');

    s.set('c');
    flushPending();
    expect(el.className).toBe('c');
  });
});

describe('dev warnings', () => {
  it('effect skips update when node is disconnected', () => {
    const s = signal('val');
    const el = document.createElement('div');
    bindAttribute(el, 'class', () => s.get());
    document.body.appendChild(el);

    s.set('updated');
    flushPending();
    expect(el.className).toBe('updated');

    document.body.removeChild(el);
    // Signal change should not update the disconnected node
    s.set('after-removal');
    flushPending();
    expect(el.className).toBe('updated');
  });

  it('__noopFreezeProps freezes props in dev mode', () => {
    (globalThis as any).__AETHER_DEV = true;
    const props = __noopFreezeProps({ name: 'test', value: 42 });
    expect(Object.isFrozen(props)).toBe(true);
    delete (globalThis as any).__AETHER_DEV;
  });

  it('__noopFreezeProps returns props unchanged in non-dev mode', () => {
    (globalThis as any).__AETHER_DEV = false;
    const props = __noopFreezeProps({ name: 'test' });
    expect(Object.isFrozen(props)).toBe(false);
    delete (globalThis as any).__AETHER_DEV;
  });
});
