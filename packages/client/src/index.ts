import { signal, effect } from '@noopjs/signals';

type ClientLevel = 'none' | 'resume' | 'spa' | 'full';

interface NodeManifestEntry {
  tag: string;
  attrs: string[];
}

interface SerializedState {
  signals: Record<string, any>;
  bindings: BindingDescriptor[];
  handlers: Record<string, HandlerMeta>;
  rootId: string;
  contextValues?: Record<string, any>;
  nodeManifest?: Record<number, NodeManifestEntry>;
  clientLevel?: ClientLevel;
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

let signalRegistry = new Map<string, ReturnType<typeof signal>>();
let effectDisposers: (() => void)[] = [];
let routerStarted = false;
let navigationInProgress = false;
let navToken: object | null = null;

const emptyState: SerializedState = { signals: {}, bindings: [], handlers: {}, rootId: '' };

export function init(): void {
  const stateEl = document.getElementById('__NOOP_STATE__');
  if (!stateEl) return;

  try {
    const state: SerializedState = JSON.parse(stateEl.textContent || '');
    const level = state.clientLevel || 'spa';
    if (level === 'none') return;
    initFromState(state);
    if (level === 'spa' || level === 'full') {
      startRouter();
    }
  } catch (e) {
    console.error('[Noop] Failed to parse state:', e);
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
    if (!g.__noopContextStack) g.__noopContextStack = new Map();
    for (const [key, value] of Object.entries(state.contextValues)) {
      g.__noopContextStack.set(key, [value]);
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
    console.warn(`[Noop] Signal not found: ${binding.signalRef}`);
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
    console.warn(`[Noop] Node not found: ${binding.nodeId}`);
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
    console.warn(`[Noop] Handler not loaded: ${handlerId}`);
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

// ── Scroll restoration ────────────────────────────────────

let scrollPositions = new Map<string, number>();

function saveScrollPosition(): void {
  scrollPositions.set(window.location.pathname, window.scrollY);
}

function restoreScrollPosition(path: string): void {
  const y = scrollPositions.get(path);
  if (y !== undefined) {
    requestAnimationFrame(() => window.scrollTo(0, y));
  } else {
    window.scrollTo(0, 0);
  }
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
    saveScrollPosition();
    navigate(href).catch(console.error);
  });
}

function findAnchor(el: HTMLElement | null): HTMLAnchorElement | null {
  while (el) {
    if (el.tagName === 'A') return el as HTMLAnchorElement;
    el = el.parentElement;
  }
  return null;
}

export async function navigate(href: string, options?: { replace?: boolean }): Promise<void> {
  if (navigationInProgress) return;
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return;

  const token = {};
  navToken = token;
  navigationInProgress = true;
  try {
    const response = await fetch(url.pathname + url.search);

    if (!response.ok) {
      try { window.location.href = href; } catch {}
      return;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rootEl = doc.querySelector('main') || doc.getElementById('root');
    const rootContent = rootEl?.innerHTML ?? '';
    const stateEl = doc.getElementById('__NOOP_STATE__');
    const state: SerializedState = stateEl ? JSON.parse(stateEl.textContent || '{}') : emptyState;

    await applyNavigation(rootContent, state, href, options, token);
  } catch {
    try { window.location.href = href; } catch {}
  } finally {
    navigationInProgress = false;
  }
}

async function applyNavigation(html: string, state: SerializedState, href: string, options?: { replace?: boolean }, token?: object): Promise<void> {
  // Abort stale navigations BEFORE any side effects
  if (token && token !== navToken) return;

  // Update history FIRST, before any async work. This ensures the history
  // stack is correct even if the user presses back during the view transition.
  // For popstate navigations (replace=true), the browser already updated the URL.
  if (!options?.replace) {
    saveScrollPosition();
    window.history.pushState({}, '', href);
  }

  const manifest = state.nodeManifest || {};
  if (document.startViewTransition && !options?.replace) {
    await document.startViewTransition(async () => {
      performDOMSwap(html, manifest);
    }).finished;
  } else {
    performDOMSwap(html, manifest);
  }

  applyState(state);

  // Re-check token after the async view transition — popstate may have
  // fired during the animation, invalidating this navigation.
  if (token && token !== navToken) return;

  restoreScrollPosition(href);
}

function verifyAndClean(
  root: Node,
  manifest: Record<number, NodeManifestEntry>,
): void {
  const keys = Object.keys(manifest);
  // If the server didn't emit a manifest (older version), skip verification
  // to avoid stripping all content. This is a graceful degradation — once
  // the server emits data-n, the manifest will be non-empty and verification
  // is strict.
  if (keys.length === 0) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  const nodes: Element[] = [];

  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node as Element);
  }

  for (const el of nodes) {
    const sentinelVal = el.getAttribute('data-n');
    if (sentinelVal === null) {
      toRemove.push(el);
      continue;
    }
    const sentinelId = parseInt(sentinelVal, 10);
    const entry = manifest[sentinelId];
    if (!entry) {
      toRemove.push(el);
      continue;
    }
    if (entry.tag !== el.tagName.toLowerCase()) {
      toRemove.push(el);
      continue;
    }

    // Strip attributes not in the manifest
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const name = el.attributes[i].name;
      if (name === 'data-n') continue;
      if (!entry.attrs.includes(name)) {
        el.removeAttribute(name);
      }
    }
  }

  for (const el of toRemove) {
    el.parentNode?.removeChild(el);
  }
}

function performDOMSwap(
  html: string,
  manifest: Record<number, NodeManifestEntry> = {},
): void {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  verifyAndClean(temp, manifest);

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
  if (!routerStarted) return;
  // Abort any in-flight click navigation — its pushState would fire after
  // the browser's history already moved, corrupting the history stack.
  navToken = null;
  navigationInProgress = false;
  navigate(window.location.pathname + window.location.search, { replace: true });
});

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
}
