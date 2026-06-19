// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigate, initFromState, prefetchUrl, resetPrefetchCache } from '../src/index';

function clearPrefetchCache(): void {
  resetPrefetchCache();
}

describe('client navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main></main>';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:3000/'),
      writable: true,
    });
    clearPrefetchCache();
  });

  it('navigate fetches with X-Noop-Navigate header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<div>new content</div>',
        state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/about');

    expect(mockFetch).toHaveBeenCalledWith('/about', {
      headers: { 'X-Noop-Navigate': '1' },
    });
  });

  it('navigate replaces DOM content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<div>new page content</div>',
        state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/about');

    expect(document.querySelector('main')!.innerHTML).toContain('new page content');
  });

  it('navigate applies new state after DOM swap', async () => {
    document.body.innerHTML = '<main><span data-noop-node="n0">old</span></main>';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<span data-noop-node="n0">new</span>',
        state: {
          signals: { 'c0.text': 'updated' },
          bindings: [
            {
              nodeId: 'n0',
              type: 'attribute',
              attributeName: 'data-val',
              signalRef: 'c0.text',
            },
          ],
          handlers: {},
          rootId: 'c0',
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/page');
    const span = document.querySelector('[data-noop-node="n0"]');
    expect(span?.getAttribute('data-val')).toBe('updated');
  });

  it('navigate handles non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/fail');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('navigate ignores external URLs', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await navigate('https://external.com/page');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('prefetchUrl fetches and caches navigation response', async () => {
    const navData = {
      html: '<div>prefetched</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(navData),
    });
    vi.stubGlobal('fetch', mockFetch);

    await prefetchUrl('/cached-page');
    await new Promise(r => setTimeout(r, 0));

    expect(mockFetch).toHaveBeenCalledWith('/cached-page', {
      headers: { 'X-Noop-Navigate': '1' },
    });
  });

  it('navigate uses prefetch cache instead of fetching', async () => {
    const navData = {
      html: '<div>from cache</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(navData),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await prefetchUrl('/cached');
    await new Promise(r => setTimeout(r, 0));

    fetchSpy.mockClear();
    await navigate('/cached');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector('main')!.innerHTML).toContain('from cache');
  });

  it('prefetchUrl ignores external URLs', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await prefetchUrl('https://external.com/page');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('prefetchUrl does not re-fetch already cached URL', async () => {
    const navData = {
      html: '<div>cached</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(navData),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await prefetchUrl('/dup');
    await new Promise(r => setTimeout(r, 0));
    await prefetchUrl('/dup');
    await new Promise(r => setTimeout(r, 0));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('consumes cache entry after navigation (single use)', async () => {
    const navData = {
      html: '<div>single-use</div>',
      state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(navData),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await prefetchUrl('/single-use');
    await new Promise(r => setTimeout(r, 0));

    fetchSpy.mockClear();

    // First navigate consumes the cache
    await navigate('/single-use');
    expect(fetchSpy).not.toHaveBeenCalled();

    // Second navigate should miss cache and actually fetch
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(navData),
    });
    await navigate('/single-use');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('navigate uses document.body when no main or #root exists', async () => {
    document.body.innerHTML = '<nav>header</nav>';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<div>body content</div>',
        state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/body-target');
    expect(document.body.innerHTML).toContain('body content');
  });

  it('updates window.history after navigation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<div>new page</div>',
        state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const pushSpy = vi.spyOn(window.history, 'pushState');

    await navigate('/new-path');
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/new-path');
  });

  it('uses View Transition API when available', async () => {
    const mockStartViewTransition = vi.fn((callback: () => void) => ({
      finished: Promise.resolve(),
    }));
    document.startViewTransition = mockStartViewTransition as any;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<div>view-transition</div>',
        state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/with-vt');
    expect(mockStartViewTransition).toHaveBeenCalled();
  });

  it('fallback to direct DOM swap when View Transition API unavailable', async () => {
    (document as any).startViewTransition = undefined;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html: '<div>no-vt</div>',
        state: { signals: {}, bindings: [], handlers: {}, rootId: 'r' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/no-vt');
    expect(document.querySelector('main')!.innerHTML).toContain('no-vt');
  });

  it('handles network error gracefully (hard navigation fallback)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    // Should not throw — navigates via window.location.href fallback
    await expect(navigate('/network-error')).resolves.toBeUndefined();
  });
});
