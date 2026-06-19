import { createSSRContext, enterSSR, exitSSR, getSerializedState } from './context';
import type { SerializedState } from './context';

export type ClientLevel = 'none' | 'resume' | 'spa' | 'full';

export interface RenderResult {
  html: string;
  state: SerializedState;
  componentId: string;
  clientLevel: ClientLevel;
}

export async function renderToString(
  componentFn: (...args: any[]) => any,
  props: Record<string, any> = {},
  options?: { clientLevel?: ClientLevel },
): Promise<RenderResult> {
  const perf = typeof performance !== 'undefined' ? performance : null;
  perf?.mark('noop:ssr:start');

  const componentId = 'c0';
  const ctx = createSSRContext(componentId);
  enterSSR(ctx);

  const clientLevel: ClientLevel = options?.clientLevel || (componentFn as any).clientLevel || 'spa';

  try {
    let rootNode = componentFn(props, componentId);

    if (rootNode instanceof Promise) {
      try {
        rootNode = await rootNode;
      } catch {
        perf?.mark('noop:ssr:end');
        return {
          html: '',
          state: { signals: {}, bindings: [], handlers: {}, rootId: componentId, clientLevel },
          componentId,
          clientLevel,
        };
      }
    }

    while (ctx.pendingSuspense.length > 0) {
      const pending = ctx.pendingSuspense.shift()!;
      try {
        const resolved = await pending.promise;
        if (resolved != null && pending.placeholder.parentNode) {
          const parent = pending.placeholder.parentNode;
          pending.placeholder.parentNode.replaceChild(resolved, pending.placeholder);
        }
      } catch {}
    }

    perf?.mark('noop:ssr:render');

    if (rootNode != null) {
      const container = ctx.document.createElement('div');
      container.appendChild(rootNode);
      const html = container.toHTML();
      const rawState = getSerializedState();
      const state = { ...rawState, clientLevel };

      perf?.mark('noop:ssr:serialize');
      perf?.measure('noop:ssr:total', 'noop:ssr:start', 'noop:ssr:serialize');
      perf?.measure('noop:ssr:render-duration', 'noop:ssr:render', 'noop:ssr:serialize');

      return { html, state, componentId, clientLevel };
    }

    perf?.mark('noop:ssr:end');
    return { html: '', state: { ...getSerializedState(), clientLevel }, componentId, clientLevel };
  } catch (err) {
    perf?.mark('noop:ssr:end');
    return {
      html: errorFallbackHtml(err),
      state: { signals: {}, bindings: [], handlers: {}, rootId: componentId, clientLevel },
      componentId,
      clientLevel,
    };
  } finally {
    exitSSR();
  }
}

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
        controller.enqueue(encoder.encode('<!DOCTYPE html>\n<html>'));
        const headHtml = doc.documentElement.children[0]?.toHTML() || '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>';
        controller.enqueue(encoder.encode(headHtml));
        controller.enqueue(encoder.encode('<body><div id="root">'));

        let rootNode: any;
        try {
          rootNode = componentFn(props, componentId);
        } catch (e) {
          controller.enqueue(encoder.encode(errorFallbackHtml(e)));
          controller.enqueue(encoder.encode('</div></body></html>'));
          controller.close();
          return;
        }

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

          while (ctx.pendingSuspense.length > 0) {
            const pending = ctx.pendingSuspense.shift()!;
            try {
              const resolved = await pending.promise;
              if (resolved != null && pending.placeholder.parentNode) {
                pending.placeholder.parentNode.replaceChild(resolved, pending.placeholder);
              }
            } catch {}
          }

          let content = container.toHTML();
          controller.enqueue(encoder.encode(content));

          controller.enqueue(encoder.encode('</div>'));
          controller.enqueue(encoder.encode(stateToScript({ ...getSerializedState(), clientLevel: 'spa' as ClientLevel })));
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

/**
 * Generate the per-page inline bootstrap script.
 * This script is synchronous (non-module) and includes:
 * 1. A minimal signal/effect polyfill (~500 bytes)
 * 2. Per-page signal creation + hardcoded binding effects
 * 3. Event handler setup
 * 4. Router initialization flag for SPA pages
 *
 * The @noopjs/client module (loaded as <script type="module">) provides
 * startRouter, navigate, and verifyAndClean. It checks _needsRouter to start.
 */
export function generatePageBootstrap(
  state: SerializedState,
  clientLevel: ClientLevel,
): string {
  if (clientLevel === 'none') return '';

  const signalEntries = Object.entries(state.signals);
  const bindings = state.bindings || [];
  const handlers = state.handlers || {};
  const handlerKeys = Object.keys(handlers);

  // Minimal signal/effect polyfill that matches @noopjs/signals API
  const polyfill = `var __n=window.__noop=window.__noop||{};(function(){var _ae=null;__n.signal=function(v){var s=new Set;return{get(){if(_ae)s.add(_ae);return v},set(n){if(n!==v){v=n;for(var f of[...s])f()}}}};__n.effect=function(fn){var d=false,r=function(){if(d)return;_ae=r;try{fn()}finally{_ae=null}};r();var ed=function(){d=true};__n._trackEffect(ed);return ed};})();`;

  const lines: string[] = [];
  lines.push(`(function(s){`);
  lines.push(`var _s={};`);

  // Create signals
  for (const [path] of signalEntries) {
    lines.push(`_s['${path}']=__n.signal(s.signals['${path}']);`);
  }

  // Generate hardcoded binding effects
  for (const binding of bindings) {
    const ref = `_s['${binding.signalRef}']`;
    if (binding.type === 'text') {
      lines.push(`__n.effect(function(){var p=document.querySelector('[data-noop-node="${binding.parentNodeId}"]');if(p&&p.childNodes[${binding.childIndex}]!=null)p.childNodes[${binding.childIndex}].nodeValue=String(${ref}.get())});`);
    } else if (binding.type === 'attribute') {
      lines.push(`__n.effect(function(){var el=document.querySelector('[data-noop-node="${binding.nodeId}"]');if(el){var v=${ref}.get();if(v==null)el.removeAttribute('${binding.attributeName}');else el.setAttribute('${binding.attributeName}',String(v))}});`);
    }
  }

  // Setup event handlers
  for (const handlerId of handlerKeys) {
    const meta = handlers[handlerId];
    lines.push(`(function(){var el=document.querySelector('[data-noop-ev="${handlerId}"]');if(el)el.addEventListener('${meta.eventType}',async function(e){try{var m=await import('/_noop/handler/${meta.componentId}/${handlerId}.js');if(typeof m.default==='function')m.default(e)}catch{}})}());`);
  }

  // Set flags for module script
  lines.push(`__n._pageInitRan=true;`);
  if (clientLevel === 'spa' || clientLevel === 'full') {
    lines.push(`__n._needsRouter=true;`);
  }

  lines.push(`})(JSON.parse(document.getElementById('__NOOP_STATE__').textContent));`);

  const pageScript = lines.join('\n');
  const escaped = pageScript.replace(/<\/script>/gi, '<\\/script>');
  return `<script>${polyfill}${escaped}</script>`;
}

export function extractPrefetchLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /<a\s[^>]*href="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('/')) {
      links.push(href);
    }
  }
  return [...new Set(links)];
}

export function prefetchLinkTags(html: string): string {
  const links = extractPrefetchLinks(html);
  if (links.length === 0) return '';
  return '\n  ' + links.map(href => `<link rel="prefetch" href="${href}">`).join('\n  ');
}
