// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigate, initFromState } from '../src/index';

function buildPageHtml(bodyHtml: string, state: any): string {
  const stateJson = JSON.stringify(state)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E');
  return `<!DOCTYPE html><html><head></head><body><div id="root">${bodyHtml}</div><script id="__NOOP_STATE__" type="application/json">${stateJson}</script></body></html>`;
}

const emptyState = { signals: {}, bindings: [], handlers: {}, rootId: 'r' };

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
  });

  it('navigates by fetching the page HTML', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildPageHtml('<div>new content</div>', emptyState)),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/about');

    expect(mockFetch).toHaveBeenCalledWith('/about');
  });

  it('replaces DOM content after navigation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildPageHtml('<div>new page content</div>', emptyState)),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/about');

    expect(document.querySelector('main')!.innerHTML).toContain('new page content');
  });

  it('applies new state after DOM swap', async () => {
    document.body.innerHTML = '<main><span data-noop-node="n0">old</span></main>';

    const state = {
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
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildPageHtml('<span data-noop-node="n0">new</span>', state)),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/page');
    const span = document.querySelector('[data-noop-node="n0"]');
    expect(span?.getAttribute('data-val')).toBe('updated');
  });

  it('handles non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/fail');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('ignores external URLs', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await navigate('https://external.com/page');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses document.body when no main or #root exists', async () => {
    document.body.innerHTML = '<nav>header</nav>';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildPageHtml('<div>body content</div>', emptyState)),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/body-target');
    expect(document.body.innerHTML).toContain('body content');
  });

  it('updates window.history after navigation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildPageHtml('<div>new page</div>', emptyState)),
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
      text: () => Promise.resolve(buildPageHtml('<div>view-transition</div>', emptyState)),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/with-vt');
    expect(mockStartViewTransition).toHaveBeenCalled();
  });

  it('falls back to direct DOM swap when View Transition API unavailable', async () => {
    (document as any).startViewTransition = undefined;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildPageHtml('<div>no-vt</div>', emptyState)),
    });
    vi.stubGlobal('fetch', mockFetch);

    await navigate('/no-vt');
    expect(document.querySelector('main')!.innerHTML).toContain('no-vt');
  });

  it('handles network error gracefully (hard navigation fallback)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(navigate('/network-error')).resolves.toBeUndefined();
  });
});
