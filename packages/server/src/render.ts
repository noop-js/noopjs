import { createSSRContext, enterSSR, exitSSR, getSerializedState } from './context';
import type { SerializedState } from './context';

export interface RenderResult {
  html: string;
  state: SerializedState;
  componentId: string;
}

/**
 * Render a NoopJS component to HTML with serialized state.
 * Wrapped in error boundary — if the component throws, returns fallback HTML.
 * Supports async components (Suspense with async children).
 * Records performance marks when globalThis.performance is available.
 */
export async function renderToString(
  componentFn: (...args: any[]) => any,
  props: Record<string, any> = {},
): Promise<RenderResult> {
  const perf = typeof performance !== 'undefined' ? performance : null;
  perf?.mark('noop:ssr:start');

  const componentId = 'c0';
  const ctx = createSSRContext(componentId);
  enterSSR(ctx);

  try {
    let rootNode = componentFn(props, componentId);

    // Await async root (from Suspense)
    if (rootNode instanceof Promise) {
      try {
        rootNode = await rootNode;
      } catch {
        perf?.mark('noop:ssr:end');
        return {
          html: '',
          state: { signals: {}, bindings: [], handlers: {}, rootId: componentId },
          componentId,
        };
      }
    }

    // Resolve pending Suspense boundaries
    while (ctx.pendingSuspense.length > 0) {
      const pending = ctx.pendingSuspense.shift()!;
      try {
        const resolved = await pending.promise;
        if (resolved != null && pending.placeholder.parentNode) {
          const parent = pending.placeholder.parentNode;
          pending.placeholder.parentNode.replaceChild(resolved, pending.placeholder);
        } else {
        }
      } catch {
        // Keep fallback
      }
    }

    perf?.mark('noop:ssr:render');

    if (rootNode != null) {
      const container = ctx.document.createElement('div');
      container.appendChild(rootNode);
      const html = container.toHTML();
      const state = getSerializedState();

      perf?.mark('noop:ssr:serialize');
      perf?.measure('noop:ssr:total', 'noop:ssr:start', 'noop:ssr:serialize');
      perf?.measure('noop:ssr:render-duration', 'noop:ssr:render', 'noop:ssr:serialize');

      return { html, state, componentId };
    }

    perf?.mark('noop:ssr:end');
    return { html: '', state: getSerializedState(), componentId };
  } catch (err) {
    perf?.mark('noop:ssr:end');
    return {
      html: errorFallbackHtml(err),
      state: { signals: {}, bindings: [], handlers: {}, rootId: componentId },
      componentId,
    };
  } finally {
    exitSSR();
  }
}

/**
 * Render a NoopJS component to a ReadableStream.
 * Streams HTML in chunks for progressive loading.
 */
/**
 * Render a NoopJS component to a ReadableStream with progressive shell-first output.
 * Streams the HTML shell immediately, renders the component, then streams content + state.
 */
export function renderToStream(
  componentFn: (...args: any[]) => any,
  props: Record<string, any> = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const componentId = 'c0';
      const ctx = createSSRContext(componentId);
      enterSSR(ctx);

      try {
        const doc = ctx.document;

        // Stream shell immediately
        controller.enqueue(encoder.encode('<!DOCTYPE html>\n<html>'));
        const headHtml = doc.documentElement.children[0]?.toHTML() || '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>';
        controller.enqueue(encoder.encode(headHtml));
        controller.enqueue(encoder.encode('<body><div id="root">'));

        // Render root component
        let rootNode: any;
        try {
          rootNode = componentFn(props, componentId);
        } catch (e) {
          controller.enqueue(encoder.encode(errorFallbackHtml(e)));
          controller.enqueue(encoder.encode('</div></body></html>'));
          controller.close();
          return;
        }

        // Handle async root node (from Suspense)
        if (rootNode instanceof Promise) {
          try {
            rootNode = await rootNode;
          } catch {
            controller.enqueue(encoder.encode('</div></body></html>'));
            controller.close();
            return;
          }
        }

        if (rootNode != null) {
          const container = doc.createElement('div');
          container.appendChild(rootNode);

          // Await pending Suspense boundaries — resolves replace placeholders in the DOM tree
          while (ctx.pendingSuspense.length > 0) {
            const pending = ctx.pendingSuspense.shift()!;
            try {
              const resolved = await pending.promise;
              if (resolved != null && pending.placeholder.parentNode) {
                pending.placeholder.parentNode.replaceChild(resolved, pending.placeholder);
              }
            } catch {
              // Keep fallback
            }
          }

          // Now serialize the DOM tree with resolved content in place
          let content = container.toHTML();
          controller.enqueue(encoder.encode(content));

          controller.enqueue(encoder.encode('</div>'));
          controller.enqueue(encoder.encode(stateToScript(getSerializedState())));
          controller.enqueue(encoder.encode('</body></html>'));
          controller.close();
        } else {
          controller.enqueue(encoder.encode('</div></body></html>'));
          controller.close();
        }
      } catch (err) {
        controller.enqueue(encoder.encode('</div>'));
        controller.enqueue(encoder.encode(stateToScript({ signals: {}, bindings: [], handlers: {}, rootId: 'c0' })));
        controller.enqueue(encoder.encode('</body></html>'));
        controller.close();
      } finally {
        exitSSR();
      }
    },
  });
}

function stateToScript(state: SerializedState): string {
  const json = JSON.stringify(state)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/-->/g, '--\\>');
  return `<script id="__NOOP_STATE__" type="application/json">${json}</script>`;
}

function errorFallbackHtml(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `<!DOCTYPE html>
<html>
<head><title>SSR Error</title></head>
<body>
  <div id="root">
    <h1>Something went wrong</h1>
    <p style="color:red">${escapeHtml(msg)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
