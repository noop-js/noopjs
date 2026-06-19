import { describe, it, expect } from 'vitest';
import { renderToString } from '../src/index';

describe('debug-suspense', () => {
  it('manual suspense flow', async () => {
    const result = await renderToString((_props: any, _id: string) => {
      const ctx = (globalThis as any).__NOOP_SSR_CONTEXT;
      const doc = (globalThis as any).document;

      // Simulate what Suspense does in SSR
      const placeholder = doc.createComment('suspense-pending');
      const promise = new Promise(resolve => {
        setTimeout(() => {
          const el = doc.createElement('span');
          el.appendChild(doc.createTextNode('resolved'));
          resolve(el);
        }, 5);
      });
      const cb = () => {
        const el = doc.createElement('div');
        el.appendChild(doc.createTextNode('loading'));
        return el;
      };
      const fbNode = cb();
      const frag = doc.createDocumentFragment();
      frag.appendChild(placeholder);
      frag.appendChild(fbNode);

      // Register pending
      ctx.pendingSuspense.push({ promise, placeholder });

      return frag;
    });

    expect(result.html).toContain('resolved');
    expect(result.html).toContain('loading');
  });
});
