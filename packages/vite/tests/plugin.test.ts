import { describe, it, expect } from 'vitest';
import { noopVite } from '../src/index';

describe('@noopjs/vite plugin', () => {
  it('returns a Vite plugin with the correct name', () => {
    const plugin = noopVite();
    expect(plugin.name).toBe('@noopjs/vite');
    expect(plugin.enforce).toBe('pre');
  });

  it('transforms .noop.tsx files', async () => {
    const plugin = noopVite();

    // Simulate Vite's transform hook
    const source = `
      export default function Foo() {
        return <div>hello</div>;
      }
    `;

    const result = await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); }, emitFile: () => '' },
      source,
      '/src/Foo.noop.tsx',
    );

    expect(result).toBeTruthy();
    expect(result.code).toContain('document.createElement');
    expect(result.code).toContain("'div'");
  });

  it('passes through non-noop files unchanged', async () => {
    const plugin = noopVite();
    const source = 'const x = 1;';

    const result = await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); }, emitFile: () => '' },
      source,
      '/src/bar.ts',
    );

    expect(result).toBeNull();
  });

  it('errors on invalid .noop.tsx', async () => {
    const plugin = noopVite();

    await expect(
      (plugin as any).transform!.call(
        { error: (msg: string) => { throw new Error(msg); }, emitFile: () => '' },
        'invalid syntax <<<>>>',
        '/src/Bad.noop.tsx',
      ),
    ).rejects.toThrow();
  });

  it('resolves virtual .noop.css imports', () => {
    const plugin = noopVite();

    // Simulate configResolved to set config
    (plugin as any).configResolved!({ command: 'build' });

    const result = (plugin as any).resolveId!(
      '\0noop-css:/src/Foo.noop.css',
      '/src/Foo.noop.tsx',
    );

    expect(result).toBe('\0noop-css:/src/Foo.noop.css');
  });

  it('loads virtual CSS modules from the cssMap', async () => {
    const plugin = noopVite();

    // First run transform to populate the cssMap
    const source = `
      export const styles = {
        container: { color: 'red' },
      };

      export default function Foo() {
        return <div className={styles.container}>hi</div>;
      }
    `;

    await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); } },
      source,
      '/src/Foo.noop.tsx',
    );

    // Now load the virtual CSS module
    const css = await (plugin as any).load!('\0noop-css:/src/Foo.noop.css');
    expect(css).toBeTruthy();
    expect(css).toContain('color: red');
    expect(css).toContain('._a');
  });

  it('extracts handlers in build mode', async () => {
    const plugin = noopVite();

    (plugin as any).configResolved!({ command: 'build' });

    const source = `
      import { signal } from '@noopjs/signals';

      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;

    const result = await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); } },
      source,
      '/src/Counter.noop.tsx',
    );

    expect(result.code).toContain('bindEvent');
  });

  it('adds CSS import for components with styles', async () => {
    const plugin = noopVite();

    (plugin as any).configResolved!({ command: 'build' });

    const source = `
      export const styles = {
        red: { color: 'red' },
      };

      export default function Foo() {
        return <div className={styles.red}>hi</div>;
      }
    `;

    const result = await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); } },
      source,
      '/src/Foo.noop.tsx',
    );

    expect(result.code).toContain('.noop.css');
  });

  it('adds HMR accept block in dev mode', async () => {
    const plugin = noopVite();

    (plugin as any).configResolved!({ command: 'serve' });

    const source = `
      export default function Foo() {
        return <div>hello</div>;
      }
    `;

    const result = await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); } },
      source,
      '/src/Foo.noop.tsx',
    );

    expect(result.code).toContain('import.meta.hot.accept');
  });

  it('registers handler code maps for extracted handlers', async () => {
    const plugin = noopVite({ extractHandlers: true });

    (plugin as any).configResolved!({ command: 'build' });

    const source = `
      import { signal } from '@noopjs/signals';
      export default function Counter() {
        const count = signal(0);
        return <button onClick={() => count.set(count.get() + 1)}>{count}</button>;
      }
    `;

    await (plugin as any).transform!.call(
      { error: (msg: string) => { throw new Error(msg); } },
      source,
      '/src/Counter.noop.tsx',
    );

    // The handler should be loadable via the virtual handler module
    const handlerCode = await (plugin as any).load!('\0noop-handler:__h_0');
    expect(handlerCode).toBeTruthy();
    expect(handlerCode).toContain('export default function');
    expect(handlerCode).toContain('count.set');
  });
});
