import { signal, effect } from '@noopjs/signals';
import type { SerializedState, NodeManifestEntry } from './state';

const emptyState: SerializedState = { signals: {}, bindings: [], handlers: {}, rootId: '' };

let signalRegistry = new Map<string, ReturnType<typeof signal>>();
let effectDisposers: (() => void)[] = [];
let routerStarted = false;
let navigationInProgress = false;
let navToken: object | null = null;
let scrollPositions = new Map<string, number>();

export function initFromState(state: SerializedState): void {
  disposeAll();
  signalRegistry = new Map();

  for (const [path, value] of Object.entries(state.signals)) {
    const sig = signal(value);
    signalRegistry.set(path, sig);
  }

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

function attachBinding(binding: any): void {
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

function setupSSREventDelegation(handlers: Record<string, any>): void {
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

async function handleSSRHandler(event: CustomEvent, handlerId: string, meta: any): Promise<void> {
  const { originalEvent } = event.detail;
  try {
    const moduleUrl = `/_noop/handler/${meta.componentId}/${handlerId}.js`;
    const mod = await import(/* @vite-ignore */ moduleUrl);
    if (typeof mod.default === 'function') {
      mod.default(originalEvent);
    }
  } catch {
    console.warn(`[Noop] Handler not loaded: ${handlerId}`);
  }
}

function disposeAll(): void {
  for (const dispose of effectDisposers) {
    dispose();
  }
  effectDisposers = [];
}

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

function findAnchor(el: HTMLElement | null): HTMLAnchorElement | null {
  while (el) {
    if (el.tagName === 'A') return el as HTMLAnchorElement;
    el = el.parentElement;
  }
  return null;
}

export function startRouter(): void {
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
    const state: SerializedState = stateEl
      ? JSON.parse(stateEl.textContent || '{}')
      : emptyState;
    const pageScriptEl = doc.querySelector('script[data-noop-page]');
    const pageScript = pageScriptEl?.textContent || '';

    await applyNavigation(rootContent, state, href, options, token, pageScript);
  } catch {
    try { window.location.href = href; } catch {}
  } finally {
    navigationInProgress = false;
  }
}

async function applyNavigation(
  html: string,
  state: SerializedState,
  href: string,
  options?: { replace?: boolean },
  token?: object,
  pageScript?: string,
): Promise<void> {
  if (token && token !== navToken) return;

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

  initFromState(state);

  if (pageScript) {
    await executePageScript(pageScript, state);
  }

  if (token && token !== navToken) return;
  restoreScrollPosition(href);
}

function performDOMSwap(html: string, manifest: Record<number, NodeManifestEntry> = {}): void {
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

function verifyAndClean(root: Node, manifest: Record<number, NodeManifestEntry>): void {
  const keys = Object.keys(manifest);
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

const pageScriptCache = new Map<string, any>();

async function executePageScript(scriptContent: string, state: SerializedState): Promise<void> {
  if (!scriptContent.trim()) return;
  const key = scriptContent;
  try {
    if (!pageScriptCache.has(key)) {
      const blob = new Blob([scriptContent], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      pageScriptCache.set(key, await import(url));
      URL.revokeObjectURL(url);
    }
    const mod = pageScriptCache.get(key);
    if (typeof mod.default === 'function') {
      await mod.default(state);
    }
  } catch {
    // fallback: generic init was already applied above
  }
}

window.addEventListener('popstate', () => {
  if (!routerStarted) return;
  navToken = null;
  navigationInProgress = false;
  navigate(window.location.pathname + window.location.search, { replace: true });
});
