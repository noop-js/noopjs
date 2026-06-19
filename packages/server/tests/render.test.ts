import { describe, it, expect } from 'vitest';
import { signal } from '@noopjs/signals';
import { bindText, bindAttribute, __noopCreateSignal, Suspense } from '@noopjs/runtime';
import { renderToString, renderToStream } from '../src/index';

describe('renderToString', () => {
  it('renders a simple static component', async () => {
    function MyComponent(_props: any, __noopId: string) {
      const el = document.createElement('div');
      el.className = 'foo';
      const txt = document.createTextNode('hello world');
      el.appendChild(txt);
      return el;
    }

    const result = await renderToString(MyComponent);
    expect(result.html).toContain('<div class="foo">');
    expect(result.html).toContain('hello world');
    expect(result.html).toContain('</div>');
    expect(result.state).toBeDefined();
    expect(result.state.rootId).toBe('c0');
  });

  it('renders a component with nested elements', async () => {
    function MyComponent(_props: any, _id: string) {
      const div = document.createElement('div');
      const span = document.createElement('span');
      span.appendChild(document.createTextNode('inner'));
      div.appendChild(span);
      return div;
    }

    const result = await renderToString(MyComponent);
    expect(result.html).toContain('<div><span>inner</span></div>');
  });

  it('renders a component with attributes', async () => {
    function MyComponent(_props: any, _id: string) {
      const btn = document.createElement('button');
      btn.setAttribute('disabled', '');
      btn.className = 'btn primary';
      btn.appendChild(document.createTextNode('Click'));
      return btn;
    }

    const result = await renderToString(MyComponent);
    expect(result.html).toContain('<button');
    expect(result.html).toContain('disabled=""');
    expect(result.html).toContain('class="btn primary"');
    expect(result.html).toContain('>Click</button>');
  });

  it('passes props to the component', async () => {
    function Greeting(props: any, _id: string) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(`Hello ${props.name}`));
      return div;
    }

    const result = await renderToString(Greeting, { name: 'World' });
    expect(result.html).toContain('Hello World');
  });

  it('uses SSR-aware bindText to record bindings', async () => {
    function Counter(_props: any, __noopId: string) {
      const count = __noopCreateSignal(0, 'count', __noopId);
      const el = document.createElement('div');
      const txt = document.createTextNode('');
      bindText(txt, () => count.get(), `${__noopId}.count`);
      el.appendChild(txt);
      return el;
    }

    const result = await renderToString(Counter);
    // bindText during SSR should set initial text
    expect(result.html).toContain('0');
    // State should contain the signal value
    expect(result.state.signals['c0.count']).toBe(0);
  });

  it('renders Suspense with sync children', async () => {
    function App(_props: any, _id: string) {
      return Suspense({
        children: () => {
          const div = document.createElement('div');
          div.appendChild(document.createTextNode('sync content'));
          return div;
        },
      });
    }

    const result = await renderToString(App);
    expect(result.html).toContain('sync content');
  });

  it('renders Suspense with async children using fallback', async () => {
    function App(_props: any, _id: string) {
      return Suspense({
        children: () => new Promise(resolve => {
          setTimeout(() => {
            const div = document.createElement('div');
            div.appendChild(document.createTextNode('async content'));
            resolve(div);
          }, 10);
        }),
        fallback: () => {
          const div = document.createElement('div');
          div.appendChild(document.createTextNode('loading...'));
          return div;
        },
      });
    }

    const result = await renderToString(App);
    // Should contain the resolved async content after awaiting
    expect(result.html).toContain('async content');
  });

  it('Suspense streaming resolves async content', async () => {
    function App(_props: any, _id: string) {
      return Suspense({
        children: () => new Promise(resolve => {
          setTimeout(() => {
            const el = document.createElement('span');
            el.appendChild(document.createTextNode('resolved'));
            resolve(el);
          }, 5);
        }),
        fallback: () => {
          const el = document.createElement('span');
          el.appendChild(document.createTextNode('fallback'));
          return el;
        },
      });
    }

    const stream = renderToStream(App);
    const reader = stream.getReader();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += new TextDecoder().decode(value);
    }

    expect(result).toContain('resolved');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result.indexOf('resolved')).toBeGreaterThan(result.indexOf('<div id="root">'));
    expect(result.indexOf('</html>')).toBeGreaterThan(result.indexOf('resolved'));
  });

  it('records performance marks during SSR', async () => {
    function MyComponent(_props: any, _id: string) {
      const el = document.createElement('div');
      const txt = document.createTextNode('perf test');
      el.appendChild(txt);
      return el;
    }

    const result = await renderToString(MyComponent);
    expect(result.html).toContain('perf test');

    // Check performance marks were recorded
    const perf = typeof performance !== 'undefined' ? performance : null;
    if (perf) {
      const measures = perf.getEntriesByType('measure');
      const ssrMeasures = measures.filter(m => m.name.startsWith('noop:ssr:'));
      expect(ssrMeasures.length).toBeGreaterThan(0);
    }
  });

  it('bundles stay within size budget', () => {
    const fs = require('fs') as typeof import('fs');
    const sizes: Record<string, number> = {};

    const bundles: [string, string][] = [
      ['runtime', __dirname + '/../../runtime/dist/index.js'],
      ['signals', __dirname + '/../../signals/dist/index.js'],
      ['client', __dirname + '/../../client/dist/index.js'],
    ];

    for (const [name, fullPath] of bundles) {
      if (fs.existsSync(fullPath)) {
        sizes[name] = fs.statSync(fullPath).size;
      }
    }

    // Budget: runtime < 30KB, signals < 10KB, client < 15KB
    expect(sizes.runtime).toBeLessThan(30 * 1024);
    expect(sizes.signals).toBeLessThan(10 * 1024);
    expect(sizes.client).toBeLessThan(15 * 1024);
  });
});
