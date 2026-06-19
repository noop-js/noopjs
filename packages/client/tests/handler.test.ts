// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initFromState } from '../src/index';

describe('SSR handler delegation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers __noop_handler listener during initFromState', () => {
    document.body.innerHTML = `<button data-noop-ev="h_test">click</button>`;

    initFromState({
      signals: {},
      bindings: [],
      handlers: {
        h_test: { eventType: 'click', componentId: 'c0', handlerIndex: 0 },
      },
      rootId: 'c0',
    });

    const btn = document.querySelector('button')!;
    const dispatched = vi.fn();
    document.addEventListener('__noop_handler', dispatched);

    btn.dispatchEvent(new CustomEvent('__noop_handler', {
      detail: { handlerId: 'h_test', eventType: 'click', originalEvent: new MouseEvent('click') },
      bubbles: true,
    }));

    expect(dispatched).toHaveBeenCalled();
  });

  it('handles multiple handlers with different IDs', () => {
    initFromState({
      signals: {},
      bindings: [],
      handlers: {
        h_a: { eventType: 'click', componentId: 'c0', handlerIndex: 0 },
        h_b: { eventType: 'click', componentId: 'c0', handlerIndex: 1 },
      },
      rootId: 'c0',
    });

    document.body.innerHTML = `<button data-noop-ev="h_a">a</button><button data-noop-ev="h_b">b</button>`;
    const [btnA, btnB] = document.querySelectorAll('button');

    const dispatched: string[] = [];
    document.addEventListener('__noop_handler', ((e: CustomEvent) => {
      dispatched.push(e.detail.handlerId);
    }) as EventListener);

    btnA.dispatchEvent(new CustomEvent('__noop_handler', {
      detail: { handlerId: 'h_a', eventType: 'click', originalEvent: new MouseEvent('click') },
      bubbles: true,
    }));

    btnB.dispatchEvent(new CustomEvent('__noop_handler', {
      detail: { handlerId: 'h_b', eventType: 'click', originalEvent: new MouseEvent('click') },
      bubbles: true,
    }));

    expect(dispatched).toEqual(['h_a', 'h_b']);
  });
});
