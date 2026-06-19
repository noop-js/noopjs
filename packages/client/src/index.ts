import { signal, effect } from '@noopjs/signals';

interface SerializedState {
  signals: Record<string, any>;
  bindings: BindingDescriptor[];
  handlers: Record<string, HandlerMeta>;
  rootId: string;
  contextValues?: Record<string, any>;
}

interface BindingDescriptor {
  nodeId: string;
  type: 'text' | 'attribute';
  attributeName?: string;
  signalRef: string;
  parentNodeId?: string;
  childIndex?: number;
}

interface HandlerMeta {
  eventType: string;
  componentId: string;
  handlerIndex: number;
}

interface NavigationResponse {
  html: string;
  state: SerializedState;
}

let signalRegistry = new Map<string, ReturnType<typeof signal>>();
let effectDisposers: (() => void)[] = [];
let routerStarted = false;

// ── Prefetch Cache ──────────────────────────────────────────

let prefetchCache = new Map<string, NavigationResponse>();
let prefetchObserver: IntersectionObserver | null = null;

export function resetPrefetchCache(): void {
  prefetchCache.clear();
}

export function prefetchUrl(url: string): void {
  if (prefetchCache.has(url)) return;
  const absUrl = new URL(url, window.location.origin);
  if (absUrl.origin !== window.location.origin) return;
  fetch(absUrl.pathname + absUrl.search, {
    headers: { 'X-Noop-Navigate': '1' },
  })
    .then(r => r.ok ? r.json() : null)
    .then((nav: NavigationResponse | null) => {
      if (nav) prefetchCache.set(url, nav);
    })
    .catch(() => {});
}

function observeLinks(): void {
  if (typeof IntersectionObserver === 'undefined') return;
  if (prefetchObserver) prefetchObserver.disconnect();

  prefetchObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const link = entry.target as HTMLAnchorElement;
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('http')) {
          prefetchUrl(href);
        }
        prefetchObserver!.unobserve(link);
      }
    }
  }, { rootMargin: '200px' });

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http')) return;
    prefetchObserver!.observe(link);
    link.addEventListener('mouseenter', () => prefetchUrl(href), { once: true });
  });
}

export function init(): void {
  const stateEl = document.getElementById('__NOOP_STATE__');
  if (!stateEl) return;

  try {
    const state: SerializedState = JSON.parse(stateEl.textContent || '');
    initFromState(state);
    startRouter();
  } catch (e) {
    console.error('[Aether] Failed to parse state:', e);
  }
}

export function initFromState(state: SerializedState): void {
  disposeAll();
  signalRegistry = new Map();

  for (const [path, value] of Object.entries(state.signals)) {
    const sig = signal(value);
    signalRegistry.set(path, sig);
  }

  // Restore context values
  if (state.contextValues) {
    const g = globalThis as any;
    if (!g.__aetherContextStack) g.__aetherContextStack = new Map();
    for (const [key, value] of Object.entries(state.contextValues)) {
      g.__aetherContextStack.set(key, [value]);
    }
  }

  for (const binding of state.bindings) {
    attachBinding(binding);
  }

  setupSSREventDelegation(state.handlers);
}

function attachBinding(binding: BindingDescriptor): void {
  const sig = signalRegistry.get(binding.signalRef);
  if (!sig) {
    console.warn(`[Aether] Signal not found: ${binding.signalRef}`);
    return;
  }

  let node: Node | null = null;

  if (binding.type === 'text' && binding.parentNodeId !== undefined) {
    const parent = document.querySelector(`[data-noop-node="${binding.parentNodeId}"]`);
    if (parent && binding.childIndex !== undefined) {
      node = parent.childNodes[binding.childIndex];
    }
  } else if (binding.type === 'attribute') {
    node = document.querySelector(`[data-noop-node="${binding.nodeId}"]`);
  }

  if (!node) {
    console.warn(`[Aether] Node not found: ${binding.nodeId}`);
    return;
  }

  if (binding.type === 'text') {
    const disposer = effect(() => {
      (node as Text).nodeValue = String(sig.get());
    });
    effectDisposers.push(disposer);
  } else if (binding.type === 'attribute' && binding.attributeName) {
    const disposer = effect(() => {
      const val = sig.get();
      if (val === null || val === undefined) {
        (node as Element).removeAttribute(binding.attributeName!);
      } else {
        (node as Element).setAttribute(binding.attributeName!, String(val));
      }
    });
    effectDisposers.push(disposer);
  }
}

// ── SSR Event Delegation ──────────────────────────────────

function setupSSREventDelegation(handlers: Record<string, HandlerMeta>): void {
  const handlerIds = Object.keys(handlers);
  if (handlerIds.length === 0) return;

  for (const handlerId of handlerIds) {
    document.addEventListener('__noop_handler', ((event: CustomEvent) => {
      const { handlerId: firedId } = event.detail;
      if (firedId === handlerId) {
        handleSSRHandler(event, handlerId, handlers[handlerId]);
      }
    }) as EventListener, true);
  }
}

async function handleSSRHandler(
  event: CustomEvent,
  handlerId: string,
  meta: HandlerMeta,
): Promise<void> {
  const { originalEvent } = event.detail;

  // Phase 9: Try to import the handler code dynamically.
  // The handler module path is derived from the component ID.
  // In a production build, the Vite plugin maps each component
  // to a chunk URL. Here we use a convention-based approach:
  //   /_noop/handler/{componentId}/{handlerId}.js
  try {
    const moduleUrl = `/_noop/handler/${meta.componentId}/${handlerId}.js`;
    const mod = await import(/* @vite-ignore */ moduleUrl);
    if (typeof mod.default === 'function') {
      mod.default(originalEvent);
    }
  } catch {
    // Fallback: the handler may already be loaded in the runtime
    // registry (for client-rendered components).
    console.warn(`[Aether] Handler not loaded: ${handlerId}`);
  }
}

export function applyState(newState: SerializedState): void {
  initFromState(newState);
}

function disposeAll(): void {
  for (const dispose of effectDisposers) {
    dispose();
  }
  effectDisposers = [];
}

// ── Router ─────────────────────────────────────────────────

function startRouter(): void {
  if (routerStarted) return;
  routerStarted = true;

  document.addEventListener('click', (event: MouseEvent) => {
    const link = findAnchor(event.target as HTMLElement | null);
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http')) return;

    const isModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (isModifier) return;

    event.preventDefault();
    navigate(href).catch(console.error);
  });

  observeLinks();
}

function findAnchor(el: HTMLElement | null): HTMLAnchorElement | null {
  while (el) {
    if (el.tagName === 'A') return el as HTMLAnchorElement;
    el = el.parentElement;
  }
  return null;
}

export async function navigate(href: string): Promise<void> {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return;

  try {
    const cached = prefetchCache.get(href);
    if (cached) {
      prefetchCache.delete(href);
      await applyNavigation(cached, href);
      return;
    }

    const response = await fetch(url.pathname + url.search, {
      headers: { 'X-Noop-Navigate': '1' },
    });

    if (!response.ok) {
      try { window.location.href = href; } catch {}
      return;
    }

    const nav: NavigationResponse = await response.json();
    await applyNavigation(nav, href);
  } catch {
    try { window.location.href = href; } catch {}
  }
}

async function applyNavigation(nav: NavigationResponse, href: string): Promise<void> {
  if (document.startViewTransition) {
    await document.startViewTransition(async () => {
      performDOMSwap(nav.html);
    }).finished;
  } else {
    performDOMSwap(nav.html);
  }

  applyState(nav.state);
  window.history.pushState({}, '', href);
  observeLinks();
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === 1) {
    const el = node as Element;
    const attrs = el.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const name = attrs[i].name;
      if (name.startsWith('on') || name === 'href' && attrs[i].value.startsWith('javascript:')) {
        el.removeAttribute(name);
      }
    }
    let child = el.firstChild;
    while (child) {
      const next = child.nextSibling;
      sanitizeNode(child);
      child = next;
    }
  }
}

function performDOMSwap(html: string): void {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  sanitizeNode(temp);

  const root = document.querySelector('main') || document.getElementById('root');
  if (root) {
    root.innerHTML = '';
    while (temp.firstChild) {
      root.appendChild(temp.firstChild);
    }
  } else {
    document.body.innerHTML = '';
    while (temp.firstChild) {
      document.body.appendChild(temp.firstChild);
    }
  }
}

window.addEventListener('popstate', () => {
  navigate(window.location.pathname + window.location.search);
});

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
}
