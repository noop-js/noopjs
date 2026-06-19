import { describe, it, expect } from 'vitest';
import { extractStyles } from '../src/index';

describe('css extraction', () => {
  it('extracts atomic CSS from style exports', () => {
    const source = `
      export const styles = {
        container: { color: 'red', fontSize: '16px' }
      };

      export default function Foo() {
        return <div className={styles.container}>hello</div>;
      }
    `;

    const result = extractStyles(source);
    expect(result.css).toContain('color: red');
    expect(result.css).toContain('font-size: 16px');
    expect(result.transformedSource).toContain('className=');
    expect(result.transformedSource).not.toContain('styles.container');
    expect(result.transformedSource).toContain('_a');
  });

  it('handles multiple style objects', () => {
    const source = `
      export const styles = {
        container: { background: 'blue' },
        text: { color: 'white', fontWeight: 'bold' }
      };

      export default function Foo() {
        return <div className={styles.container}><span className={styles.text}>hi</span></div>;
      }
    `;

    const result = extractStyles(source);
    expect(result.css).toContain('background: blue');
    expect(result.css).toContain('color: white');
    expect(result.css).toContain('font-weight: bold');
    expect(result.transformedSource).toContain('className="');
    expect(result.styleNames).toHaveProperty('container');
    expect(result.styleNames).toHaveProperty('text');
  });

  it('removes styles export from output', () => {
    const source = `
      export const styles = {
        box: { padding: '10px' }
      };

      export default function Box() {
        return <div className={styles.box}>content</div>;
      }
    `;

    const result = extractStyles(source);
    expect(result.transformedSource).not.toContain('export const styles');
    expect(result.transformedSource).not.toContain('styles.box');
  });

  it('handles numeric values with px', () => {
    const source = `
      export const styles = {
        box: { margin: 20 }
      };

      export default function Box() {
        return <div className={styles.box}>content</div>;
      }
    `;

    const result = extractStyles(source);
    expect(result.css).toContain('margin: 20px');
  });

  it('returns empty CSS when no styles', () => {
    const source = `export default function Foo() { return <div>hi</div>; }`;
    const result = extractStyles(source);
    expect(result.css).toBe('');
  });

  it('generates deterministic class names', () => {
    const source1 = `
      export const styles = { x: { color: 'red' } };
      export default function A() { return <div className={styles.x}>a</div>; }
    `;

    const source2 = `
      export const styles = { x: { color: 'red' } };
      export default function B() { return <div className={styles.x}>b</div>; }
    `;

    const r1 = extractStyles(source1);
    const r2 = extractStyles(source2);
    // Same rule should produce same class name (deterministic)
    expect(r1.css).toBe(r2.css);
  });

  it('converts camelCase CSS properties to kebab-case', () => {
    const source = `
      export const styles = {
        card: { backgroundColor: '#fff', borderRadius: '4px' }
      };
      export default function Card() {
        return <div className={styles.card}>card</div>;
      }
    `;

    const result = extractStyles(source);
    expect(result.css).toContain('background-color: #fff');
    expect(result.css).toContain('border-radius: 4px');
  });
});
