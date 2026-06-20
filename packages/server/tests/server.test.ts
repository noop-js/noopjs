import { describe, it, expect, vi, afterEach } from 'vitest';
import { __noopCreateSignal } from '@noopjs/runtime';
import { renderToString, renderToStream, createNodeHandler } from '../src/index';
import { cacheRender, invalidateCache, clearCache } from '../src/cache';

function Counter(props: any, __noopId: string) {
  const count = __noopCreateSignal(0, 'count', __noopId);
  const el = (globalThis as any).document.createElement('button');
  el.className = 'counter';
  const txt = (globalThis as any).document.createTextNode(`count: ${count.get()}`);
  el.appendChild(txt);
  return el;
}

describe('renderToString', () => {
  it('renders a component to HTML', async () => {
    const result = await renderToString(Counter);
    expect(result.html).toContain('button');
    expect(result.html).toContain('count: 0');
    expect(result.html).toContain('counter');
  });

  it('returns serialized state', async () => {
    const result = await renderToString(Counter);
    expect(result.state.signals).toBeDefined();
    expect(result.state.signals['c0.count']).toBe(0);
  });

  it('handles component errors gracefully', async () => {
    const result = await renderToString(() => {
      throw new Error('boom');
    });
    expect(result.html).toContain('Something went wrong');
    expect(result.html).toContain('boom');
  });
});

describe('renderToStream', () => {
  it('returns a ReadableStream', () => {
    const result = renderToStream(Counter);
    expect(result.stream).toBeInstanceOf(ReadableStream);
    expect(result.state).toBeInstanceOf(Promise);
  });

  it('produces HTML chunks', async () => {
    const { stream, state } = renderToStream(Counter);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const full = chunks.map(c => new TextDecoder().decode(c)).join('');
    expect(full).toContain('<button');
    expect(full).toContain('count: 0');
    expect(full).not.toContain('__NOOP_STATE__'); // state is returned via promise, not in stream

    const streamState = await state;
    expect(streamState.signals).toBeDefined();
    expect(streamState.signals['c0.count']).toBe(0);
  });

  it('returns state via promise matching rendered content', async () => {
    const { stream, state } = renderToStream(Counter);
    const reader = stream.getReader();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += new TextDecoder().decode(value);
    }

    const streamState = await state;
    expect(full).toContain('count: 0');
    expect(streamState.signals['c0.count']).toBe(0);
  });
});

describe('cacheRender', () => {
  afterEach(() => {
    clearCache();
  });

  it('returns cached result within TTL', () => {
    const renderFn = vi.fn(() => ({
      html: '<div>cached</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'c0' },
      componentId: 'c0',
    }));

    const result1 = cacheRender({ key: 'ttl-test', ttl: 10000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(1);

    const result2 = cacheRender({ key: 'ttl-test', ttl: 10000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(result2).toEqual(result1);
  });

  it('re-renders after TTL expires', () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    const renderFn = vi.fn(() => ({
      html: '<div>fresh</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'c0' },
      componentId: 'c0',
    }));

    cacheRender({ key: 'expire-test', ttl: 1000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(1);

    // Within TTL
    cacheRender({ key: 'expire-test', ttl: 1000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(1);

    // Advance past TTL
    vi.advanceTimersByTime(1001);

    cacheRender({ key: 'expire-test', ttl: 1000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('invalidateCache', () => {
  afterEach(() => {
    clearCache();
  });

  it('removes cached entry', () => {
    const renderFn = vi.fn(() => ({
      html: '<div>hi</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'c0' },
      componentId: 'c0',
    }));

    cacheRender({ key: 'invalidate-test', ttl: 10000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(1);

    invalidateCache('invalidate-test');

    cacheRender({ key: 'invalidate-test', ttl: 10000 }, renderFn);
    expect(renderFn).toHaveBeenCalledTimes(2);
  });
});

describe('ETag header', () => {
  it('is set correctly by createNodeHandler', async () => {
    const handler = createNodeHandler((_props: any, _id: string) => {
      const el = document.createElement('div');
      el.className = 'test';
      const txt = document.createTextNode('hello');
      el.appendChild(txt);
      return el;
    });

    const req = { headers: {} } as any;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as any;

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'ETag': expect.stringMatching(/^".+"$/),
      }),
    );
  });
});
