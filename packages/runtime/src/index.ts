import { signal, effect, untrack } from '@noopjs/signals';

function isSSR(): boolean {
  return !!(globalThis as any).__NOOP_SSR;
}

function isDev(): boolean {
  if (isSSR()) return false;
  if ((globalThis as any).__NOOP_DEV === true) return true;
  if ((globalThis as any).__NOOP_DEV === false) return false;
  try {
    return (import.meta as any).env?.MODE === 'development';
  } catch {
    return false;
  }
}

function noopWarn(msg: string, ...args: any[]): void {
  if (isDev()) {
    console.warn(`[Noop] ${msg}`, ...args);
  }
}

function noopError(msg: string, hint?: string): Error {
  const error = new Error(`[Noop] ${msg}`);
  if (hint) error.message += `\n  💡 ${hint}`;
  return error;
}

function getCtx(): any {
  return (globalThis as any).__NOOP_SSR_CONTEXT;
}

let nodeIdCounter = 0;

function ensureNodeId(el: any): string {
  if (el._noopNodeId) return el._noopNodeId;
  const id = 'n' + (nodeIdCounter++);
  el._noopNodeId = id;
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('data-noop-node', id);
  }
  return id;
}

export function bindText(
  node: Text | any,
  getter: () => string | number | boolean,
  signalRef?: string,
): void {
  if (isSSR()) {
    const val = String(getter());
    node.nodeValue = val;
    const ctx = getCtx();
    if (ctx && signalRef) {
      const parent = node.parentNode;
      if (parent && typeof parent.setAttribute === 'function') {
        const parentNodeId = ensureNodeId(parent);
        const childIndex = Array.from(parent.childNodes).indexOf(node);
        ctx.bindings.push({
          nodeId: parentNodeId + '-t' + childIndex,
          type: 'text',
          signalRef,
          parentNodeId,
          childIndex,
        });
      }
    }
    return;
  }
  let firstRun = true;
  const dispose = effect(() => {
    if (!firstRun && (node as any).isConnected === false) return;
    firstRun = false;
    node.nodeValue = String(getter());
  });
  registerEffect(node, dispose);
}

function setAttr(el: Element | any, attrName: string, val: string): void {
  if ((attrName === 'className' || attrName === 'class') && 'className' in el) {
    el.className = val;
  } else {
    el.setAttribute(attrName, val);
  }
}

function removeAttr(el: Element | any, attrName: string): void {
  if ((attrName === 'className' || attrName === 'class') && 'className' in el) {
    el.className = '';
  } else {
    el.removeAttribute(attrName);
  }
}

function styleObjToString(obj: Record<string, any>): string {
  let css = '';
  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined) continue;
    const prop = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    css += `${prop}:${obj[key]};`;
  }
  return css;
}

export function bindAttribute(
  el: Element | any,
  attrName: string,
  getter: () => string | number | boolean | null | undefined,
  signalRef?: string,
): void {
  if (isSSR()) {
    const val = getter();
    if (val === null || val === undefined) {
      removeAttr(el, attrName);
    } else {
      setAttr(el, attrName, String(val));
    }
    const ctx = getCtx();
    if (ctx && signalRef) {
      ensureNodeId(el);
      ctx.bindings.push({
        nodeId: el._noopNodeId,
        type: 'attribute',
        attributeName: attrName,
        signalRef,
      });
    }
    return;
  }
  let firstRun = true;
  const dispose = effect(() => {
    if (!firstRun && (el as any).isConnected === false) return;
    firstRun = false;
    const val = getter();
    if (val === null || val === undefined) {
      removeAttr(el, attrName);
    } else {
      setAttr(el, attrName, String(val));
    }
  });
  registerEffect(el, dispose);
}

export function bindStyle(
  el: Element | any,
  getter: () => Record<string, any> | string | null | undefined,
  signalRef?: string,
): void {
  if (isSSR()) {
    const val = getter();
    if (val && typeof val === 'object') {
      el.setAttribute('style', styleObjToString(val));
    } else if (val) {
      el.setAttribute('style', String(val));
    }
    const ctx = getCtx();
    if (ctx && signalRef) {
      ensureNodeId(el);
      ctx.bindings.push({
        nodeId: el._noopNodeId,
        type: 'attribute',
        attributeName: 'style',
        signalRef,
      });
    }
    return;
  }
  let firstRun = true;
  const dispose = effect(() => {
    if (!firstRun && (el as any).isConnected === false) return;
    firstRun = false;
    const val = getter();
    if (val === null || val === undefined) {
      el.removeAttribute('style');
    } else if (typeof val === 'object') {
      el.setAttribute('style', styleObjToString(val));
    } else {
      el.setAttribute('style', String(val));
    }
  });
  registerEffect(el, dispose);
}

// ── Dev warnings (Phase E) ──────────────────────────────────

export function __noopFreezeProps<T>(props: T): T {
  if (isDev()) {
    return Object.freeze(props);
  }
  return props;
}

// ── Effect Cleanup via MutationObserver (Phase B) ──────────

const nodeEffectsMap = new WeakMap<Element, Set<() => void>>();
let cleanupObserver: MutationObserver | null = null;
let cleanupRoot: Element | null = null;

function registerEffect(node: Node | Element, dispose: () => void): void {
  const el = node.nodeType === 1 ? (node as Element) : (node.parentNode instanceof Element ? node.parentNode : null);
  if (!el) return;
  let effects = nodeEffectsMap.get(el);
  if (!effects) {
    effects = new Set();
    nodeEffectsMap.set(el, effects);
  }
  effects.add(dispose);
}

function disposeNodeEffects(node: Element): void {
  const effects = nodeEffectsMap.get(node);
  if (effects) {
    for (const dispose of effects) dispose();
    nodeEffectsMap.delete(node);
  }
  let child = node.firstElementChild;
  while (child) {
    disposeNodeEffects(child);
    child = child.nextElementSibling;
  }
  // Fire any pending onUnmount callbacks registered in CSR
  if (pendingOnUnmount.length > 0) {
    const fns = pendingOnUnmount.splice(0);
    for (const fn of fns) fn();
  }
}

export function startEffectCleanup(): void {
  if (cleanupObserver) return;
  const root = document.body || document.documentElement;
  if (!root) return;
  cleanupRoot = root;
  cleanupObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const removed of mutation.removedNodes) {
          if (removed.nodeType === 1) {
            disposeNodeEffects(removed as Element);
          }
        }
      }
    }
  });
  cleanupObserver.observe(root, { childList: true, subtree: true });
}

export function stopEffectCleanup(): void {
  if (cleanupObserver) {
    cleanupObserver.disconnect();
    cleanupObserver = null;
    cleanupRoot = null;
  }
  if (pendingOnUnmount.length > 0) {
    const fns = pendingOnUnmount.splice(0);
    for (const fn of fns) fn();
  }
}

// ── Event delegation (Phase 9) ─────────────────────────────

interface HandlerEntry {
  eventType: string;
  handler: (...args: any[]) => void;
  el: Element;
}

const handlerRegistry = new Map<string, HandlerEntry>();
const delegatedEvents = new Set<string>();

function delegateEvent(event: Event): void {
  let target = event.target as HTMLElement | null;
  while (target) {
    const handlerId = target.getAttribute('data-noop-ev');
    if (handlerId) {
      // Phase 9: First check local registry (client-rendered components)
      if (handlerRegistry.has(handlerId)) {
        const entry = handlerRegistry.get(handlerId)!;
        entry.handler(event);
        return;
      }
      // Phase 9: For SSR handlers, dispatch a custom event the resumer listens for
      target.dispatchEvent(new CustomEvent('__noop_handler', {
        detail: { handlerId, eventType: event.type, originalEvent: event },
        bubbles: false,
      }));
      return;
    }
    target = target.parentElement;
  }
}

export function bindEvent(
  el: Element | any,
  eventType: string,
  handler: (...args: any[]) => void,
  handlerId: string,
): void {
  if (isSSR()) {
    el.setAttribute('data-noop-ev', handlerId);
    const ctx = getCtx();
    if (ctx) {
      ctx.handlers[handlerId] = {
        eventType,
        componentId: ctx.rootComponentId,
        handlerIndex: (ctx.handlerIndexCounter = (ctx.handlerIndexCounter || 0) + 1),
      };
    }
    return;
  }

  el.setAttribute('data-noop-ev', handlerId);

  // Phase 9: Register in the local handler registry
  handlerRegistry.set(handlerId, { eventType, handler, el });

  // Phase 9: Set up event delegation for this event type (once per type)
  if (!delegatedEvents.has(eventType)) {
    delegatedEvents.add(eventType);
    document.addEventListener(eventType, delegateEvent, true);
  }
}

// ── Lifecycle hooks (Phase B) ──────────────────────────────

let mountQueue: (() => void)[] = [];
let mountScheduled = false;

function flushMounts(): void {
  mountScheduled = false;
  const fns = mountQueue.splice(0);
  for (const fn of fns) fn();
}

export function onMount(fn: () => void): void {
  if (isSSR()) return;
  mountQueue.push(fn);
  if (!mountScheduled) {
    mountScheduled = true;
    queueMicrotask(flushMounts);
  }
}

const unmountRegistry = new Map<string, () => void>();
const pendingOnUnmount: (() => void)[] = [];

export function onUpdate(deps: (() => any)[], fn: () => void): () => void {
  if (isSSR()) return () => {};
  return effect(() => {
    for (const dep of deps) dep();
    untrack(fn);
  });
}

export function onUnmount(fn: () => void): void {
  if (isSSR()) {
    const ctx = getCtx();
    if (ctx && ctx.rootComponentId) {
      unmountRegistry.set(ctx.rootComponentId, fn);
    }
    return;
  }
  // CSR: store in pending queue; fired by disposeNodeEffects on DOM removal
  pendingOnUnmount.push(fn);
}

export function __noopDisposeComponent(compId: string): void {
  const fn = unmountRegistry.get(compId);
  if (fn) {
    fn();
    unmountRegistry.delete(compId);
  }
}

// ── Conditional rendering helper ───────────────────────────

export function bindCondition(
  parent: Node,
  test: () => boolean,
  consequent: () => Node,
  alternate: () => Node,
): Node {
  if (isSSR()) {
    const node = test() ? consequent() : alternate();
    parent.appendChild(node);
    return node;
  }
  const anchor = document.createComment('cond');
  parent.appendChild(anchor);
  let currentChild: Node | null = null;
  effect(() => {
    const val = test();
    if (currentChild && currentChild.parentNode) {
      currentChild.parentNode.removeChild(currentChild);
      if (currentChild.nodeType === 1) {
        disposeNodeEffects(currentChild as Element);
      }
    }
    currentChild = val ? consequent() : alternate();
    if (currentChild) {
      parent.insertBefore(currentChild, anchor);
    }
  });
  return anchor;
}

// ── List rendering helper ──────────────────────────────────

export function __noopEach<T>(
  items: T[],
  render: (item: T, index: number) => Node,
): DocumentFragment {
  if (!Array.isArray(items)) {
    noopWarn('__noopEach called with non-array:', items, '— expected an array');
    return document.createDocumentFragment();
  }
  const frag = document.createDocumentFragment();
  for (let i = 0; i < items.length; i++) {
    const node = render(items[i], i);
    if (!(node instanceof Node)) {
      noopWarn('__noopEach: render function returned non-Node at index', i, node);
    }
    frag.appendChild(node);
  }
  return frag;
}

export function __noopCreateSignal<T>(
  initialValue: T,
  name: string,
  compId: string,
): ReturnType<typeof signal<T>> {
  if (isSSR()) {
    const sig = signal(initialValue);
    const path = `${compId}.${name}`;
    const ctx = getCtx();
    if (ctx) {
      ctx.signalPaths.set(sig, path);
      ctx.signalValues.set(path, initialValue);
    }
    return sig;
  }
  return signal(initialValue);
}

// ── Keyed list reconciliation ─────────────────────────────

const listStates = new Map<string, Map<string, Node>>();

export function __noopReconcile<T>(
  items: T[],
  render: (item: T, index: number) => Node,
  keyFn: (item: T) => string,
  listId: string,
): DocumentFragment {
  const frag = document.createDocumentFragment();
  const oldKeyToNode = listStates.get(listId) || new Map();
  const newKeyToNode = new Map<string, Node>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = String(keyFn(item));

    // Reuse existing DOM node if key matches
    let node = oldKeyToNode.get(key);
    if (!node) {
      node = render(item, i);
      if (node instanceof Element) {
        node.setAttribute('data-noop-key', key);
      }
    }
    newKeyToNode.set(key, node);
    frag.appendChild(node);
  }

  // Store state for next reconciliation
  listStates.set(listId, newKeyToNode);

  return frag;
}

// ── Context API (Phase C) ──────────────────────────────────

export interface Context<T> {
  _key: symbol;
  _defaultValue: T;
  Provider: (props: { value: T; children: any }) => any;
}

function getContextStack(ctx: any): Map<symbol, any[]> {
  if (!ctx._contextStack) ctx._contextStack = new Map();
  return ctx._contextStack;
}

export function createContext<T>(defaultValue: T): Context<T> {
  const _key = Symbol('context');
  function Provider(props: { value: T; children: any }): any {
    const childrenFn = typeof props.children === 'function' ? props.children : () => props.children;
    const ctx = getCtx();
    if (ctx) {
      const stack = getContextStack(ctx);
      const prev = stack.get(_key) || [];
      stack.set(_key, [...prev, props.value]);
      ctx.contextValues.set(String(_key), props.value);
      try {
        return childrenFn();
      } finally {
        stack.set(_key, prev);
      }
    }
    // CSR: use a global stack
    const g = globalThis as any;
    if (!g.__noopContextStack) g.__noopContextStack = new Map();
    const stack = g.__noopContextStack;
    const prev = stack.get(_key) || [];
    stack.set(_key, [...prev, props.value]);
    try {
      return childrenFn();
    } finally {
      stack.set(_key, prev);
    }
  }
  return { _key, _defaultValue: defaultValue, Provider };
}

export function useContext<T>(context: Context<T>): T {
  const ctx = getCtx();
  if (ctx) {
    const stack = getContextStack(ctx);
    const values = stack.get(context._key);
    if (values && values.length > 0) return values[values.length - 1];
    return context._defaultValue;
  }
  const g = globalThis as any;
  const stack = g.__noopContextStack;
  if (stack) {
    const values = stack.get(context._key);
    if (values && values.length > 0) return values[values.length - 1];
  }
  return context._defaultValue;
}

// ── Portal / Teleport (Phase C) ──────────────────────────

export function createPortal(children: any, target: string | Element | (() => Element)): Node {
  const el = typeof children === 'function' ? children() : children;

  if (isSSR()) {
    // SSR: render inline with data attribute, client moves it
    if (el instanceof Element) {
      el.setAttribute('data-noop-portal', typeof target === 'string' ? target : '');
    }
    return el;
  }

  // CSR: move to target immediately via microtask
  const targetEl = typeof target === 'string'
    ? document.querySelector(target)
    : typeof target === 'function'
      ? target()
      : target;

  if (targetEl) {
    queueMicrotask(() => targetEl.appendChild(el));
  }

  return el;
}

function movePortalNodes(root: Element): void {
  const portals = root.querySelectorAll('[data-noop-portal]');
  for (const portal of portals) {
    const selector = portal.getAttribute('data-noop-portal');
    if (selector) {
      const target = document.querySelector(selector);
      if (target) target.appendChild(portal);
    }
  }
}

// ── Transition / Animation Hooks (Phase C) ───────────────

export function onBeforeEnter(el: Element, fn: (el: Element) => void): void {
  if (isSSR()) return;
  mountQueue.push(() => fn(el));
  if (!mountScheduled) { mountScheduled = true; queueMicrotask(flushMounts); }
}

export function onEnter(el: Element, fn: (el: Element) => void): void {
  if (isSSR()) return;
  mountQueue.push(() => fn(el));
  if (!mountScheduled) { mountScheduled = true; queueMicrotask(flushMounts); }
}

export function onAfterEnter(el: Element, fn: (el: Element) => void): void {
  if (isSSR()) return;
  mountQueue.push(() => requestAnimationFrame(() => fn(el)));
  if (!mountScheduled) { mountScheduled = true; queueMicrotask(flushMounts); }
}

export function onBeforeLeave(el: Element, fn: (el: Element) => void): void {
  if (isSSR()) return;
  const compId = '__leave_' + (nodeIdCounter++);
  unmountRegistry.set(compId, () => fn(el));
}

export function onLeave(el: Element, fn: (el: Element, done: () => void) => void): void {
  if (isSSR()) return;
  const compId = '__leave_' + (nodeIdCounter++);
  unmountRegistry.set(compId, () => fn(el, () => {}));
}

export function onAfterLeave(el: Element, fn: (el: Element) => void): void {
  if (isSSR()) return;
  const compId = '__leave_' + (nodeIdCounter++);
  unmountRegistry.set(compId, () => fn(el));
}

// ── Suspense (Phase C) ────────────────────────────────────

export function Suspense(props: {
  children: (() => any) | any;
  fallback?: any;
}): any {
  const childrenFn = typeof props.children === 'function' ? props.children : () => props.children;
  const fb = props.fallback || document.createComment('pending');

  if (isSSR()) {
    try {
      const result = childrenFn();
      if (result instanceof Promise) {
        const ctx = (globalThis as any).__NOOP_SSR_CONTEXT;
        if (ctx) {
          const placeholder = document.createComment('suspense-pending');
          ctx.pendingSuspense.push({ promise: result, placeholder });
      const fbNode = typeof fb === 'function' ? fb({}) : fb;
      const frag = document.createDocumentFragment();
      frag.appendChild(placeholder);
      if (fbNode != null) frag.appendChild(fbNode);
      return frag;
        }
      }
      return result;
    } catch {
      return typeof fb === 'function' ? fb({}) : fb;
    }
  }

  // Try synchronous render first (avoids fragment overhead for sync children)
  try {
    const result = childrenFn();
    if (!(result instanceof Promise)) return result;
    // Async children: render fallback, then resolve
    const container = document.createDocumentFragment();
    const fallbackNode = typeof fb === 'function' ? fb({}) : fb;
    if (fallbackNode != null) container.appendChild(fallbackNode);
    result.then(resolved => {
      if (resolved && resolved instanceof Node && fallbackNode && fallbackNode.parentNode) {
        container.replaceChild(resolved, fallbackNode);
      }
    }).catch(() => {
      // Promise rejected — keep fallback visible
    });
    return container;
  } catch {
    // Error during sync render
    const container = document.createDocumentFragment();
    const fallbackNode = typeof fb === 'function' ? fb({}) : fb;
    if (fallbackNode != null) container.appendChild(fallbackNode);
    return container;
  }
}

// ── ErrorBoundary (Phase C) ────────────────────────────────

export function ErrorBoundary(props: {
  children: (() => any) | any;
  fallback?: any;
  onError?: (error: Error) => void;
}): any {
  const renderChildren = typeof props.children === 'function'
    ? props.children
    : () => props.children;

  try {
    return renderChildren();
  } catch (e) {
    if (props.onError) props.onError(e as Error);
    const fb = props.fallback;
    if (typeof fb === 'function') return fb({ error: e });
    if (fb !== undefined) return fb;
    return document.createComment('error');
  }
}
