import { describe, it, expect } from 'vitest';
import { compile } from '../src/index';
import { createTailwindResolver } from '../src/tailwind';

describe('compiler', () => {
  it('compiles a simple static component', () => {
    const source = `
      export default function Foo() {
        return <div class="foo">hello</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('document.createElement(\'div\')');
    expect(result.code).toContain('.className = "foo"');
    expect(result.code).toContain('document.createTextNode("hello")');
    expect(result.code).toContain('export default function Foo');
  });

  it('compiles a counter component with signal', () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('document.createElement(\'button\')');
    expect(result.code).toContain('bindText');
    expect(result.code).toContain('bindEvent');
    expect(result.code).toContain('__noopCreateSignal');
    expect(result.code).toContain("__noopCreateSignal(0, 'count', __compId)");
    expect(result.code).toContain('count.get()');
    // signalRef should be passed to bindText
    expect(result.code).toContain("'c0.count'");
    // runtime import should be added
    expect(result.code).toContain('@noopjs/runtime');
  });

  it('compiles computed attribute expression', () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function Toggle() {
        const isActive = signal(false);
        return <div class={isActive.get() ? 'active' : 'inactive'}>toggle</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('bindAttribute');
    expect(result.code).toContain('isActive.get()');
  });

  it('compiles nested components', () => {
    const source = `
      function Child(props: any) {
        return <span>{props.label}</span>;
      }

      export default function Parent() {
        return <div><Child label="hello" /></div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('Child({');
    expect(result.code).toContain('__noopId');
  });

  it('handles fragments', () => {
    const source = `
      export default function Foo() {
        return <>
          <div>a</div>
          <div>b</div>
        </>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('document.createDocumentFragment');
    expect(result.code).toContain('document.createElement(\'div\')');
  });

  it('strips framework imports but keeps user imports', () => {
    const source = `
      import { signal } from '@noopjs/signals';
      import { something } from './other';

      export default function Foo() {
        const x = signal(0);
        something(x);
        return <div>{x}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).not.toContain('@noopjs/signals');
    expect(result.code).toContain('./other');
  });

  it('returns bindings for signal-driven text', () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function Foo() {
        const name = signal('world');
        return <div>Hello {name}</div>;
      }
    `;
    const result = compile(source);
    expect(result.bindings.length).toBeGreaterThanOrEqual(1);
    expect(result.bindings[0].type).toBe('text');
  });

  it('compiles a component with @noopjs/runtime imports added', () => {
    const source = `
      export default function Static() {
        return <p>static text</p>;
      }
    `;
    const result = compile(source);
    // No dynamic content -> no runtime imports needed
    expect(result.code).not.toContain("@noopjs/runtime");
  });

  it('generates custom element wrapper with directive', () => {
    const source = `
      // @noopjs customElement 'my-counter'
      import { signal } from '@noopjs/signals';

      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;
    const result = compile(source);
    expect(result.customElementTag).toBe('my-counter');
    expect(result.code).toContain("customElements.define('my-counter'");
    expect(result.code).toContain('class extends HTMLElement');
    expect(result.code).toContain('connectedCallback');
  });

  it('does not generate custom element wrapper without directive', () => {
    const source = `
      export default function Foo() {
        return <div>hi</div>;
      }
    `;
    const result = compile(source);
    expect(result.customElementTag).toBeUndefined();
    expect(result.code).not.toContain('customElements.define');
  });

  it('parses client directive and attaches static property', () => {
    const source = `
      // client: resume
      import { signal } from '@noopjs/signals';

      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;
    const result = compile(source);
    expect(result.clientLevel).toBe('resume');
    expect(result.code).toContain('Counter.clientLevel');
    expect(result.code).toContain("Counter.clientLevel = 'resume'");
  });

  it('defaults to no clientLevel without directive', () => {
    const source = `
      export default function Foo() {
        return <div>hi</div>;
      }
    `;
    const result = compile(source);
    expect(result.clientLevel).toBeUndefined();
    expect(result.code).not.toContain('.clientLevel');
  });

  it('extracts handlers when extractHandlers is true', () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;
    const result = compile(source, { extractHandlers: true });
    expect(result.handlers).toBeDefined();
    expect(result.handlers!.length).toBe(1);
    expect(result.handlers![0].eventType).toBe('click');
    expect(result.handlers![0].extracted).toBe(true);
    expect(result.handlers![0].code).toContain('count.set');
  });

  it('does not extract handlers when option is off', () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;
    const result = compile(source);
    expect(result.handlers).toBeUndefined();
  });

  it('extracts multiple handlers', () => {
    const source = `
      import { signal } from '@noopjs/signals';

      export default function Form() {
        const name = signal('');
        return <form>
          <input onInput={(e) => name.set(e.target.value)} />
          <button onClick={() => console.log(name.get())}>submit</button>
        </form>;
      }
    `;
    const result = compile(source, { extractHandlers: true });
    expect(result.handlers).toBeDefined();
    expect(result.handlers!.length).toBe(2);
    expect(result.handlers!.map(h => h.eventType)).toEqual(['input', 'click']);
  });

  it('compiles .map() array expressions in JSX', () => {
    const source = `
      export default function List() {
        const items = ['a', 'b'];
        return <ul>{items.map(item => <li>{item}</li>)}</ul>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('__noopEach');
    expect(result.code).toContain('document.createElement(\'li\')');
    // The map callback should create DOM nodes for each item
    expect(result.code).toContain('return _el_');
  });

  it('compiles literal array expressions [<A/>, <B/>]', () => {
    const source = `
      export default function Pair() {
        return <div>{[<span>A</span>, <span>B</span>]}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('createDocumentFragment');
    expect(result.code).toContain('createElement(\'span\')');
  });

  it('compiles boolean attributes correctly', () => {
    const source = `
      export default function Input({ disabled }: { disabled: boolean }) {
        return <input disabled={disabled} />;
      }
    `;
    const result = compile(source);
    // Boolean attributes should use property assignment, not setAttribute
    expect(result.code).toContain('.disabled = ');
    expect(result.code).not.toContain('setAttribute(\'disabled\'');
  });

  it('extracts static inline style to atomic CSS class', () => {
    const source = `
      export default function Box() {
        return <div style={{ color: 'red', fontSize: '16px' }} />;
      }
    `;
    const result = compile(source);
    // Should NOT generate inline setAttribute for static objects
    expect(result.code).not.toContain('setAttribute(\'style\'');
    // Should generate className with hashed class
    expect(result.code).toContain('className');
    expect(result.code).toContain('_a');
    // Should return CSS
    expect(result.css).toBeDefined();
    expect(result.css).toContain('color: red');
    expect(result.css).toContain('font-size: 16px');
    expect(result.css).toContain('_a');
  });

  it('keeps dynamic style objects as inline setAttribute', () => {
    const source = `
      export default function Box({ color }: { color: string }) {
        return <div style={{ color, fontSize: '16px' }} />;
      }
    `;
    const result = compile(source);
    // Non-literal value (identifier reference) → inline style
    expect(result.code).toContain('setAttribute(\'style\'');
    expect(result.code).toContain('color');
    expect(result.code).toContain('font-size: 16px');
    // Should NOT have generated CSS
    expect(result.css).toBeUndefined();
  });

  it('compiles dangerouslySetInnerHTML', () => {
    const source = `
      export default function Raw() {
        return <div dangerouslySetInnerHTML={{ __html: '<b>safe</b>' }} />;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('.innerHTML = ');
    expect(result.code).toContain('__html');
  });

  it('compiles ternary expressions with JSX branches', () => {
    const source = `
      export default function Toggle({ show }: { show: boolean }) {
        return <div>{show ? <span>yes</span> : <span>no</span>}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('if (show)');
    expect(result.code).toContain('createElement(\'span\')');
  });

  it('compiles ternary with null fallback', () => {
    const source = `
      export default function Maybe({ show }: { show: boolean }) {
        return <div>{show ? <span>yes</span> : null}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('if (show)');
    expect(result.code).toContain('createComment');
  });

  it('compiles spread attributes on DOM elements', () => {
    const source = `
      export default function Spready({ attrs }: any) {
        return <div {...attrs}>text</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('for (const _k in attrs)');
    expect(result.code).toContain('setAttribute');
  });

  it('compiles spread attributes on components', () => {
    const source = `
      import Child from './Child';
      export default function Parent({ data }: any) {
        return <Child {...data} extra={42} />;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('Object.assign');
    expect(result.code).toContain('extra');
  });

  it('compiles logical AND expression with JSX', () => {
    const source = `
      export default function Badge({ visible }: { visible: boolean }) {
        return <div>{visible && <span>shown</span>}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('visible');
    expect(result.code).toContain('createComment');
    expect(result.code).toContain('if (_ltest');
  });

  it('preserves original param destructuring', () => {
    const source = `
      export default function Greet({ name }: { name: string }) {
        return <h1>Hello {name}</h1>;
      }
    `;
    const result = compile(source);
    const lines = result.code.split('\n');
    const funcIdx = lines.findIndex(l => l.includes('function Greet'));
    expect(funcIdx).toBeGreaterThanOrEqual(0);
    // Check across the multi-line parameter
    expect(lines[funcIdx]).toContain('{');
    expect(lines[funcIdx + 1]).toContain('name');
    expect(lines[funcIdx + 2]).toContain('__noopId');
  });

  it('generates lazy children for ErrorBoundary', () => {
    const source = `
      import { ErrorBoundary } from '@noopjs/runtime';
      export default function App() {
        return <ErrorBoundary fallback={<span>err</span>}><div>ok</div></ErrorBoundary>;
      }
    `;
    const result = compile(source);
    // Lazy children are created as a thunk variable, e.g. _thunk_3
    expect(result.code).toContain('() => {');
    expect(result.code).toContain('ErrorBoundary({');
  });

  it('generates lazy children for Context.Provider', () => {
    const source = `
      import { createContext } from '@noopjs/runtime';
      const Theme = createContext('light');
      export default function App() {
        return <Theme.Provider value="dark"><div>ok</div></Theme.Provider>;
      }
    `;
    const result = compile(source);
    // Theme.Provider should be treated as a component with lazy children
    expect(result.code).toContain('Theme.Provider({');
    expect(result.code).toContain('() => {');
  });

  it('generates lazy children for Suspense', () => {
    const source = `
      import { Suspense } from '@noopjs/runtime';
      export default function App() {
        return <Suspense fallback={<div>loading</div>}><div>content</div></Suspense>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('Suspense({');
    expect(result.code).toContain('() => {');
  });

  it('generates source map when sourceMaps option is set', () => {
    const source = `export default function App() { return <div>hello</div>; }`;
    const result = compile(source, { sourceMaps: true });
    expect(result.map).toBeDefined();
    expect(result.map.mappings).toBeTruthy();
    expect(result.map.sources).toContain('unknown.noop.tsx');
  });

  it('compiles if/else with JSX in branches', () => {
    const source = `
      export default function Toggle({ show }: { show: boolean }) {
        if (show) {
          return <span>yes</span>;
        } else {
          return <span>no</span>;
        }
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('if (show)');
    expect(result.code).toContain('} else {');
    expect(result.code).toContain('createElement(\'span\')');
  });

  it('compiles nested ternaries', () => {
    const source = `
      export default function Nested({ x }: { x: number }) {
        return <div>{x > 0 ? <span>positive</span> : x < 0 ? <span>negative</span> : <span>zero</span>}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('x > 0');
    expect(result.code).toContain('x < 0');
    expect(result.code).toContain('createElement(\'span\')');
  });

  it('compiles empty arrays as empty fragment without child nodes', () => {
    const source = `
      export default function Empty() {
        return <div>{[]}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('createDocumentFragment');
    expect(result.code).not.toContain('createTextNode');
  });

  it('compiles signal-driven dynamic style with bindStyle', () => {
    const source = `
      import { signal } from '@noopjs/signals';
      export default function DynamicStyle() {
        const isActive = signal(false);
        return <div style={isActive.get() ? { color: 'red' } : { color: 'blue' }} />;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('bindStyle');
    expect(result.code).toContain('isActive.get()');
  });

  it('compiles component that uses onUpdate', () => {
    const source = `
      import { signal } from '@noopjs/signals';
      import { onUpdate } from '@noopjs/runtime';
      export default function Counter() {
        const count = signal(0);
        onUpdate([() => count.get()], () => { console.log(count.get()); });
        return <div>{count}</div>;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('onUpdate');
    expect(result.code).toContain('@noopjs/runtime');
  });

  it('source map contains valid mappings', () => {
    const source = `export default function App() { return <div>hello</div>; }`;
    const result = compile(source, { sourceMaps: true });
    expect(result.map).toBeDefined();
    const mappings = result.map.mappings;
    expect(mappings).toBeTruthy();
    expect(mappings.length).toBeGreaterThan(0);
  });

  it('compiles style object with signal references using bindStyle', () => {
    const source = `
      import { signal } from '@noopjs/signals';
      export default function App() {
        const styleObj = signal({ color: 'red' });
        return <div style={styleObj.get()} />;
      }
    `;
    const result = compile(source);
    expect(result.code).toContain('bindStyle');
    expect(result.code).toContain('styleObj.get()');
  });
});

describe('Tailwind token adapter', () => {
  it('resolves token.spacing.4 + padding → p-4', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('padding', 'token.spacing.4')).toBe('p-4');
    expect(resolver.resolve('padding', 'token.spacing.2')).toBe('p-2');
  });

  it('resolves token.spacing.X to various margin utilities', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('margin', 'token.spacing.4')).toBe('m-4');
    expect(resolver.resolve('margin-top', 'token.spacing.2')).toBe('mt-2');
    expect(resolver.resolve('margin-left', 'token.spacing.8')).toBe('ml-8');
    expect(resolver.resolve('margin-block', 'token.spacing.3')).toBe('my-3');
  });

  it('resolves token.spacing.X to gap utilities', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('gap', 'token.spacing.4')).toBe('gap-4');
    expect(resolver.resolve('column-gap', 'token.spacing.2')).toBe('gap-x-2');
    expect(resolver.resolve('row-gap', 'token.spacing.6')).toBe('gap-y-6');
  });

  it('resolves token.spacing.X to width/height utilities', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('width', 'token.spacing.20')).toBe('w-20');
    expect(resolver.resolve('height', 'token.spacing.12')).toBe('h-12');
  });

  it('resolves token.spacing.px → px utility', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('padding', 'token.spacing.px')).toBe('p-px');
    expect(resolver.resolve('margin', 'token.spacing.0')).toBe('m-0');
  });

  it('returns null for non-spacing tokens that do not match', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('padding', 'token.spacing.99')).toBeNull();
    expect(resolver.resolve('padding', 'token.color.red.500')).toBeNull();
    expect(resolver.resolve('display', 'token.spacing.4')).toBeNull();

  });

  it('resolves color tokens to text/bg/border utilities', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('color', 'token.color.red.500')).toBe('text-red-500');
    expect(resolver.resolve('background-color', 'token.color.blue.100')).toBe('bg-blue-100');
    expect(resolver.resolve('border-color', 'token.color.green.400')).toBe('border-green-400');
  });

  it('resolves named colors without shade', () => {
    const resolver = createTailwindResolver();
    expect(resolver.resolve('color', 'token.color.white')).toBe('text-white');
    expect(resolver.resolve('background-color', 'token.color.black')).toBe('bg-black');
    expect(resolver.resolve('color', 'token.color.transparent')).toBe('text-transparent');
  });

  it('compiles token spacing style objects to Tailwind class names', () => {
    const tailwind = createTailwindResolver();
    const source = `
      export default function Box() {
        return <div style={{ padding: 'token.spacing.4', margin: 'token.spacing.2' }}>hello</div>;
      }
    `;
    const result = compile(source, { tokenResolvers: [tailwind] });
    expect(result.code).toContain('p-4');
    expect(result.code).toContain('m-2');
    expect(result.css).toBeUndefined();
  });

  it('falls back to NoopCSS for non-token style values when resolver is present', () => {
    const tailwind = createTailwindResolver();
    const source = `
      export default function Box() {
        return <div style={{ color: 'red', padding: 'token.spacing.4' }}>hello</div>;
      }
    `;
    const result = compile(source, { tokenResolvers: [tailwind] });
    expect(result.code).toContain('p-4');
    expect(result.css).toBeDefined();
    expect(result.css).toContain('color: red');
  });

  it('preserves Tailwind classes in SSR-rendered HTML', () => {
    const tailwind = createTailwindResolver();
    const source = `
      export default function Box() {
        return <div style={{ padding: 'token.spacing.4' }}>hello</div>;
      }
    `;
    const compiled = compile(source, { tokenResolvers: [tailwind] });
    expect(compiled.code).toContain('p-4');
    expect(compiled.code).toContain('className');
    expect(compiled.css).toBeUndefined();
  });
});
