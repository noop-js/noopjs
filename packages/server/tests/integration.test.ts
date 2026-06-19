// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { compile } from '@noopjs/compiler';
import { renderToString } from '../src/index';
import { initFromState } from '@noopjs/client';
import * as runtime from '@noopjs/runtime';
import * as signals from '@noopjs/signals';

/**
 * Integration test: compile a .noop.tsx source → SSR render → resume on client.
 *
 * We eval the compiled output in a context where runtime functions are available.
 */
function compileAndEval(source: string): (...args: any[]) => any {
  const result = compile(source, { filename: 'test.noop.tsx' });

  // Merge runtime + signals — prefer runtime for overlapping keys
  const mods = { ...signals, ...runtime };

  // Strip ESM import/export from compiled code
  let code = result.code;
  code = code.replace(/import \{.*\} from '@noopjs\/runtime';?\s*\n?/g, '');
  code = code.replace(/import \{.*\} from '@noopjs\/signals';?\s*\n?/g, '');
  code = code.replace(/export default\s+/, 'return ');

  // Prepend destructured var declarations so all functions are in scope
  const keys = Object.keys(mods);
  const varDecls = keys.map(k => `const ${k} = __mod["${k}"];`).join('\n');
  const wrapped = `(function(__mod) {\n${varDecls}\n${code}\n})`;

  try {
    const factory = eval(wrapped);
    const comp = factory(mods);
    if (typeof comp !== 'function') {
      throw new Error('compileAndEval: result is not a function, got ' + typeof comp);
    }
    return comp as (...args: any[]) => any;
  } catch (e) {
    throw new Error(`compileAndEval failed: ${(e as Error).message}`);
  }
}

describe('integration: compile → SSR → resume', () => {
  it('compiles a simple component and SSR renders it', async () => {
    const source = `
      export default function App(props, __noopId) {
        const el = document.createElement('div');
        el.className = 'app';
        const txt = document.createTextNode('hello from compiled');
        el.appendChild(txt);
        return el;
      }
    `;

    const Comp = compileAndEval(source);

    const result = await renderToString(Comp);
    expect(result.html).toContain('hello from compiled');
    expect(result.html).toContain('<div class="app">');
    expect(result.state.rootId).toBe('c0');
    expect(result.state.signals).toBeDefined();
    expect(result.state.bindings).toBeDefined();
  });

  it('compiles a component with signal binding, renders SSR, and resumes', async () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function App(props, __noopId) {
        const count = signal(42);
        const el = document.createElement('div');
        const txt = document.createTextNode('');
        bindText(txt, () => String(count.get()));
        el.appendChild(txt);
        return el;
      }
    `;

    const Comp = compileAndEval(source);

    const result = await renderToString(Comp);
    expect(result.html).toContain('42');

    // Simulate client DOM with the SSR output
    document.body.innerHTML = result.html;

    // Resume on client
    initFromState(result.state);

    const renderedEl = document.querySelector('div');
    expect(renderedEl).toBeTruthy();
    expect(renderedEl!.textContent).toBe('42');
  });

  it('resumes signal-driven text binding in SSR-rendered DOM', async () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function App(props, __noopId) {
        const name = signal('Alice');
        const el = document.createElement('div');
        const txt = document.createTextNode('');
        bindText(txt, () => String(name.get()));
        el.appendChild(txt);
        return el;
      }
    `;

    const Comp = compileAndEval(source);
    const result = await renderToString(Comp);

    document.body.innerHTML = result.html;
    initFromState(result.state);

    const div = document.body.firstElementChild;
    expect(div?.textContent).toBe('Alice');
  });

  it('handles components with event handlers', async () => {
    const source = `
      export default function App(props, __noopId) {
        const btn = document.createElement('button');
        bindEvent(btn, 'click', () => {}, 'h_test');
        btn.appendChild(document.createTextNode('click me'));
        return btn;
      }
    `;

    const Comp = compileAndEval(source);
    const result = await renderToString(Comp);

    expect(result.html).toContain('data-noop-ev');
    expect(result.html).toContain('click me');
    expect(result.state.handlers).toBeDefined();
    expect(result.state.handlers['h_test']).toBeDefined();
  });

  it('produces valid state that the resumer can process', async () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function App(props, __noopId) {
        const count = signal(0);
        const el = document.createElement('div');
        const txt = document.createTextNode('');
        bindText(txt, () => String(count.get()));
        el.appendChild(txt);
        return el;
      }
    `;

    const Comp = compileAndEval(source);
    const result = await renderToString(Comp);

    expect(result.state).toHaveProperty('signals');
    expect(result.state).toHaveProperty('bindings');
    expect(result.state).toHaveProperty('handlers');
    expect(result.state).toHaveProperty('rootId');

    const signalPaths = Object.keys(result.state.signals);
    expect(signalPaths.length).toBeGreaterThan(0);
  });
});

describe('NoopCSS: atomic CSS extraction', () => {
  it('extracts static inline style objects to hashed class names', () => {
    const source = `
      export default function Box() {
        return <div style={{ color: 'red', fontSize: '16px' }}>hello</div>;
      }
    `;
    const result = compile(source);

    // Should produce hashed class names, not inline style
    expect(result.code).not.toContain('setAttribute(\'style\'');
    expect(result.code).toContain('_a');

    // Should return CSS rules
    expect(result.css).toBeDefined();
    expect(result.css).toContain('color: red');
    expect(result.css).toContain('font-size: 16px');
  });

  it('preserves dynamic inline style objects as setAttribute', () => {
    const source = `
      export default function Box({ color }: { color: string }) {
        return <div style={{ color, fontSize: '16px' }}>hello</div>;
      }
    `;
    const result = compile(source);

    // Dynamic (identifier reference) → inline style
    expect(result.code).toContain('setAttribute(\'style\'');
    expect(result.css).toBeUndefined();
  });

  it('renders atomic class names in SSR HTML output', async () => {
    const source = `
      export default function Box() {
        return <div style={{ backgroundColor: 'blue', padding: '8px' }}>styled</div>;
      }
    `;
    const Comp = compileAndEval(source);
    const result = await renderToString(Comp);

    // SSR output should have class names, not inline style
    expect(result.html).not.toContain('style="');
    expect(result.html).toContain('class="_a');
  });

  it('combines static class with atomic style class', () => {
    const source = `
      export default function Box() {
        return <div class="base" style={{ margin: '4px' }}>combined</div>;
      }
    `;
    const result = compile(source);

    // Should merge class with atomic class
    expect(result.code).toContain('className');
    expect(result.code).toContain('base');
    // CSS should be extracted (margin: 4px)
    expect(result.css).toContain('margin: 4px');
  });

  it('extracts and merges multiple unique style objects', () => {
    const source = `
      export default function App() {
        return <div>
          <span style={{ color: 'red' }}>red</span>
          <span style={{ color: 'blue' }}>blue</span>
          <span style={{ color: 'red' }}>red again</span>
        </div>;
      }
    `;
    const result = compile(source);
    expect(result.css).toBeDefined();
    // "color: red" should appear once (deduped)
    const redMatch = result.css!.match(/color: red/g);
    expect(redMatch).toHaveLength(1);
    // Both classes should be in the code
    expect(result.code).toContain('span');
  });
});
