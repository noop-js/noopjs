// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initFromState } from '../src/index';

describe('client resumer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('re-attaches attribute binding', () => {
    document.body.innerHTML = `<div data-noop-node="n0"></div>`;

    initFromState({
      signals: { 'c0.active': 'yes' },
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-active', signalRef: 'c0.active' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    const div = document.querySelector('[data-noop-node="n0"]') as HTMLElement;
    expect(div.getAttribute('data-active')).toBe('yes');
  });

  it('handles multiple attribute bindings', () => {
    document.body.innerHTML = `
      <div data-noop-node="n0"></div>
      <span data-noop-node="n1"></span>
    `;

    initFromState({
      signals: { 'c0.name': 'Alice', 'c0.role': 'admin' },
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-name', signalRef: 'c0.name' },
        { nodeId: 'n1', type: 'attribute', attributeName: 'data-role', signalRef: 'c0.role' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    const div = document.querySelector('[data-noop-node="n0"]') as HTMLElement;
    const span = document.querySelector('[data-noop-node="n1"]') as HTMLElement;
    expect(div.getAttribute('data-name')).toBe('Alice');
    expect(span.getAttribute('data-role')).toBe('admin');
  });

  it('re-attaches text binding via parentNodeId and childIndex', () => {
    document.body.innerHTML = `<div data-noop-node="n0">initial</div>`;

    initFromState({
      signals: { 'c0.greeting': 'hello' },
      bindings: [
        {
          nodeId: 'n0-t0',
          type: 'text',
          signalRef: 'c0.greeting',
          parentNodeId: 'n0',
          childIndex: 0,
        },
      ],
      handlers: {},
      rootId: 'c0',
    });

    const parent = document.querySelector('[data-noop-node="n0"]')!;
    const textNode = parent.childNodes[0];
    expect(textNode.nodeType).toBe(Node.TEXT_NODE);
    expect(textNode.nodeValue).toBe('hello');
  });

  it('handles empty state gracefully', () => {
    expect(() => {
      initFromState({
        signals: {},
        bindings: [],
        handlers: {},
        rootId: 'root',
      });
    }).not.toThrow();
  });

  it('warns on missing node binding', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `<div></div>`;

    initFromState({
      signals: { 'c0.x': 'val' },
      bindings: [
        { nodeId: 'nonexistent', type: 'attribute', attributeName: 'data-x', signalRef: 'c0.x' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Node not found'),
    );
    warnSpy.mockRestore();
  });

  it('warns on missing signal binding', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `<div data-noop-node="n0"></div>`;

    initFromState({
      signals: {},
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-x', signalRef: 'missing.signal' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Signal not found'),
    );
    warnSpy.mockRestore();
  });

  it('propagates signal changes to bound attribute', () => {
    document.body.innerHTML = `<div data-noop-node="n0"></div>`;

    initFromState({
      signals: { 'c0.count': 0 },
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-val', signalRef: 'c0.count' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    const div = document.querySelector('[data-noop-node="n0"]') as HTMLElement;
    expect(div.getAttribute('data-val')).toBe('0');
  });

  it('removes attribute when signal becomes null', () => {
    document.body.innerHTML = `<div data-noop-node="n0" data-val="keep"></div>`;

    initFromState({
      signals: { 'c0.val': null },
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-val', signalRef: 'c0.val' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    const div = document.querySelector('[data-noop-node="n0"]') as HTMLElement;
    expect(div.hasAttribute('data-val')).toBe(false);
  });

  it('restores context values from state', () => {
    document.body.innerHTML = `<div data-noop-node="n0"></div>`;

    initFromState({
      signals: {},
      bindings: [],
      handlers: {},
      rootId: 'c0',
      contextValues: { 'Symbol(theme)': 'dark' },
    });

    const g = globalThis as any;
    expect(g.__aetherContextStack).toBeDefined();
    expect(g.__aetherContextStack.get('Symbol(theme)')).toEqual(['dark']);
  });

  it('disposes previous effects on re-init', () => {
    document.body.innerHTML = `<div data-noop-node="n0"></div>`;

    initFromState({
      signals: { 'c0.text': 'first' },
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-val', signalRef: 'c0.text' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    const div = document.querySelector('[data-noop-node="n0"]') as HTMLElement;
    expect(div.getAttribute('data-val')).toBe('first');

    // Re-init with new state (simulates navigation)
    initFromState({
      signals: { 'c0.text': 'second' },
      bindings: [
        { nodeId: 'n0', type: 'attribute', attributeName: 'data-val', signalRef: 'c0.text' },
      ],
      handlers: {},
      rootId: 'c0',
    });

    expect(div.getAttribute('data-val')).toBe('second');
  });
});
