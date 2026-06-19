import { ServerDocument, ServerElement, ServerTextNode } from './dom';

export interface BindingRecord {
  nodeId: string;
  type: 'text' | 'attribute';
  attributeName?: string;
  signalRef: string;
  /** For text bindings: the parent element's nodeId, used to locate the text node */
  parentNodeId?: string;
  /** For text bindings: the child index within the parent */
  childIndex?: number;
}

export interface HandlerRecord {
  eventType: string;
  componentId: string;
  handlerIndex: number;
}

export interface SerializedState {
  signals: Record<string, any>;
  bindings: BindingRecord[];
  handlers: Record<string, HandlerRecord>;
  rootId: string;
  contextValues?: Record<string, any>;
}

export interface SuspensePending {
  promise: Promise<any>;
  placeholder: any;
}

export interface SSRContext {
  document: ServerDocument;
  signalValues: Map<string, any>;
  signalPaths: Map<any, string>;
  bindings: BindingRecord[];
  handlers: Record<string, HandlerRecord>;
  handlerIndexCounter: number;
  nodeIdCounter: number;
  rootComponentId: string;
  contextValues: Map<string, any>;
  pendingSuspense: SuspensePending[];
}

let activeContext: SSRContext | null = null;
let originalDocument: any = null;

export function getActiveContext(): SSRContext | null {
  return activeContext;
}

export function isSSR(): boolean {
  return activeContext !== null;
}

export function createSSRContext(rootComponentId: string): SSRContext {
  const ctx: SSRContext = {
    document: new ServerDocument(),
    signalValues: new Map(),
    signalPaths: new Map(),
    bindings: [],
    handlers: {},
    handlerIndexCounter: 0,
    nodeIdCounter: 0,
    rootComponentId,
    contextValues: new Map(),
    pendingSuspense: [],
  };
  return ctx;
}

export function enterSSR(ctx: SSRContext): void {
  activeContext = ctx;
  (globalThis as any).__NOOP_SSR = true;
  (globalThis as any).__NOOP_SSR_CONTEXT = ctx;
  originalDocument = (globalThis as any).document;
  (globalThis as any).document = ctx.document;
}

export function exitSSR(): void {
  activeContext = null;
  (globalThis as any).__NOOP_SSR = false;
  delete (globalThis as any).__NOOP_SSR_CONTEXT;
  if (originalDocument) {
    (globalThis as any).document = originalDocument;
    originalDocument = null;
  } else {
    delete (globalThis as any).document;
  }
}

export function getPerformanceMetrics(): Record<string, number> {
  const perf = typeof performance !== 'undefined' ? performance : null;
  if (!perf) return {};

  const metrics: Record<string, number> = {};
  const measures = perf.getEntriesByType('measure');
  for (const m of measures) {
    if (m.name.startsWith('noop:')) {
      metrics[m.name] = m.duration;
    }
  }
  perf.clearMarks('noop:ssr:');
  perf.clearMeasures('noop:ssr:');
  return metrics;
}

export function getNodeId(node: ServerElement | ServerTextNode): string {
  const ctx = activeContext;
  if (!ctx) return '';
  if ((node as any)._noopNodeId) return (node as any)._noopNodeId;
  const id = 'n' + (ctx.nodeIdCounter++);
  (node as any)._noopNodeId = id;
  return id;
}

export function recordBinding(binding: BindingRecord): void {
  const ctx = activeContext;
  if (!ctx) return;
  ctx.bindings.push(binding);
}

export function recordHandler(id: string, record: HandlerRecord): void {
  const ctx = activeContext;
  if (!ctx) return;
  ctx.handlers[id] = record;
}

export function setSignalPath(signal: any, path: string): void {
  const ctx = activeContext;
  if (!ctx) return;
  ctx.signalPaths.set(signal, path);
}

export function getSignalPath(signal: any): string | undefined {
  const ctx = activeContext;
  if (!ctx) return undefined;
  return ctx.signalPaths.get(signal);
}

export function recordSignalValue(path: string, value: any): void {
  const ctx = activeContext;
  if (!ctx) return;
  ctx.signalValues.set(path, value);
}

export function getSerializedState(): SerializedState {
  const ctx = activeContext;
  if (!ctx) throw new Error('No active SSR context');

  const signals: Record<string, any> = {};
  for (const [path, value] of ctx.signalValues) {
    signals[path] = value;
  }

  const contextValues: Record<string, any> = {};
  for (const [key, value] of ctx.contextValues) {
    contextValues[String(key)] = value;
  }

  return {
    signals,
    bindings: ctx.bindings,
    handlers: ctx.handlers,
    rootId: ctx.rootComponentId,
    contextValues: Object.keys(contextValues).length > 0 ? contextValues : undefined,
  };
}
