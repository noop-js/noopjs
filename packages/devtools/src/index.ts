import * as _signals from '@noopjs/signals';

// ── DevTools API exposed on window.__noopDevTools ──────────

export interface DevToolsSignal {
  id: string;
  value: any;
  subscriberCount: number;
  label?: string;
}

export interface DevToolsComponent {
  id: string;
  name: string;
  signals: string[];
}

export interface DevToolsBinding {
  nodeId: string;
  type: string;
  signalRef: string;
  attributeName?: string;
}

let devSignals = new Map<string, DevToolsSignal>();
let devComponents = new Map<string, DevToolsComponent>();
let devBindings: DevToolsBinding[] = [];
let signalUpdateLog: { id: string; value: any; time: number }[] = [];
let listeners: Set<() => void> = new Set();

let sigCounter = 0;
let panel: HTMLDivElement | null = null;
let panelVisible = false;

function genId(): string {
  return 's' + (sigCounter++);
}

// ── Wrapped signal() — tracks all signal instances ────────

export function signal<T>(initialValue: T): ReturnType<typeof _signals.signal<T>> {
  const sig = _signals.signal(initialValue);
  const id = genId();
  const entry: DevToolsSignal = { id, value: initialValue, subscriberCount: 0 };
  devSignals.set(id, entry);

  const origGet = sig.get.bind(sig);
  const origSet = sig.set.bind(sig);

  const wrapped: any = {
    get() {
      const v = origGet();
      entry.value = v;
      return v;
    },
    set(v: T) {
      origSet(v);
      entry.value = v;
      entry.subscriberCount = (sig as any).subscribers?.size ?? 0;
      signalUpdateLog.push({ id, value: v, time: Date.now() });
      if (signalUpdateLog.length > 100) signalUpdateLog.shift();
      notify();
    },
  };

  // Periodically update subscriber count
  const iv = setInterval(() => {
    const count = (sig as any).subscribers?.size ?? 0;
    if (entry.subscriberCount !== count) {
      entry.subscriberCount = count;
      notify();
    }
  }, 200);
  if (iv && typeof iv === 'object' && 'unref' in iv && typeof (iv as any).unref === 'function') (iv as any).unref();

  return wrapped as any;
}

// ── Wrapped effect() — tracks effect instances ────────────

export function effect(fn: () => void): () => void {
  const trackedFn = () => {
    try { fn(); } catch (e) { console.warn('[Noop DevTools] effect error:', e); }
  };
  return _signals.effect(trackedFn);
}

// ── Instrument runtime creation ───────────────────────────

export function trackSignal(name: string, compId: string, sig: any): void {
  // Called by __noopCreateSignal to associate a signal with a component
  const signalId = [...devSignals.entries()].find(([_, s]) => s.value === sig?.get?.())?.[0];
  if (signalId) {
    const entry = devSignals.get(signalId)!;
    entry.label = `${compId}.${name}`;
    let comp = devComponents.get(compId);
    if (!comp) {
      comp = { id: compId, name: compId, signals: [] };
      devComponents.set(compId, comp);
    }
    if (!comp.signals.includes(signalId)) comp.signals.push(signalId);
    notify();
  }
}

export function trackBinding(binding: DevToolsBinding): void {
  devBindings.push(binding);
  if (devBindings.length > 500) devBindings.splice(0, devBindings.length - 500);
  notify();
}

// ── DevTools public API on window ─────────────────────────

function notify() {
  for (const fn of listeners) fn();
}

export function getSignals(): DevToolsSignal[] {
  return [...devSignals.values()];
}

export function getComponents(): DevToolsComponent[] {
  return [...devComponents.values()];
}

export function getBindings(): DevToolsBinding[] {
  return [...devBindings];
}

export function getUpdateLog(): { id: string; value: any; time: number }[] {
  return [...signalUpdateLog];
}

export function getSignalById(id: string): DevToolsSignal | undefined {
  return devSignals.get(id);
}

export function onUpdate(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function togglePanel(): void {
  if (panelVisible) hidePanel();
  else showPanel();
}

// ── Floating Panel UI ─────────────────────────────────────

let panelTab: 'signals' | 'components' | 'bindings' = 'signals';

function showPanel() {
  if (panel) { panel.style.display = 'flex'; panelVisible = true; return; }

  panel = document.createElement('div');
  panel.id = '__noop_devtools_panel';
  panelVisible = true;

  const style = panel.style;
  style.position = 'fixed';
  style.bottom = '0';
  style.right = '0';
  style.width = '480px';
  style.maxHeight = '50vh';
  style.background = '#1a1a2e';
  style.color = '#e0e0e0';
  style.fontFamily = 'Menlo, Monaco, monospace';
  style.fontSize = '12px';
  style.zIndex = '999999';
  style.borderTopLeftRadius = '8px';
  style.boxShadow = '0 -4px 20px rgba(0,0,0,0.4)';
  style.display = 'flex';
  style.flexDirection = 'column';
  style.overflow = 'hidden';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;padding:6px 12px;background:#16162a;border-bottom:1px solid #2a2a4a;cursor:move;';
  header.innerHTML = '<span style="font-weight:bold;color:#7c7ce0;">⬡ Noop DevTools</span>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'margin-left:auto;background:none;border:none;color:#888;cursor:pointer;font-size:14px;';
  closeBtn.onclick = hidePanel;
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;border-bottom:1px solid #2a2a4a;';
  const tabs = ['signals', 'components', 'bindings'] as const;
  const tabEls: HTMLElement[] = [];
  for (const t of tabs) {
    const tb = document.createElement('button');
    tb.textContent = t[0].toUpperCase() + t.slice(1);
    tb.style.cssText = 'flex:1;padding:4px;background:#1a1a2e;border:none;color:#888;cursor:pointer;font-family:inherit;font-size:11px;';
    tb.dataset.tab = t;
    tb.onclick = () => switchTab(t);
    tabBar.appendChild(tb);
    tabEls.push(tb);
  }
  panel.appendChild(tabBar);

  // Content area
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;padding:4px 0;min-height:80px;max-height:40vh;';
  panel.appendChild(content);

  // Footer with summary
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:4px 12px;background:#16162a;border-top:1px solid #2a2a4a;color:#666;font-size:10px;';
  panel.appendChild(footer);

  document.body.appendChild(panel);

  function switchTab(tab: typeof panelTab) {
    panelTab = tab;
    for (const tb of tabEls) tb.style.background = tb.dataset.tab === tab ? '#2a2a4a' : '#1a1a2e';
    renderContent();
  }

  function renderContent() {
    if (panelTab === 'signals') {
      const sigs = getSignals();
      if (sigs.length === 0) {
        content.innerHTML = '<div style="padding:12px;color:#666;">No signals tracked</div>';
      } else {
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr style="color:#666;font-size:10px;"><th style="text-align:left;padding:2px 8px;">Signal</th><th style="text-align:left;padding:2px 4px;">Value</th><th style="text-align:right;padding:2px 8px;">Subs</th></tr>';
        for (const s of sigs) {
          const label = s.label || s.id;
          const val = typeof s.value === 'string' ? `"${s.value.length > 40 ? s.value.slice(0, 40) + '...' : s.value}"` : String(s.value);
          html += `<tr><td style="padding:2px 8px;color:#7c7ce0;">${label}</td><td style="padding:2px 4px;color:#e0e0e0;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${val}</td><td style="padding:2px 8px;text-align:right;color:#888;">${s.subscriberCount}</td></tr>`;
        }
        html += '</table>';
        content.innerHTML = html;
      }
      footer.textContent = `${sigs.length} signal(s) | ${getComponents().length} component(s) | ${getBindings().length} binding(s)`;
    } else if (panelTab === 'components') {
      const comps = getComponents();
      if (comps.length === 0) {
        content.innerHTML = '<div style="padding:12px;color:#666;">No components tracked</div>';
      } else {
        let html = '';
        for (const c of comps) {
          html += `<div style="padding:4px 8px;border-bottom:1px solid #2a2a4a;"><span style="color:#7c7ce0;">${c.name}</span><span style="color:#666;margin-left:8px;">${c.signals.length} signal(s)</span></div>`;
        }
        content.innerHTML = html;
      }
      footer.textContent = `${comps.length} component(s)`;
    } else {
      const binds = getBindings();
      if (binds.length === 0) {
        content.innerHTML = '<div style="padding:12px;color:#666;">No bindings tracked</div>';
      } else {
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr style="color:#666;font-size:10px;"><th style="text-align:left;padding:2px 8px;">Node</th><th style="text-align:left;padding:2px 4px;">Type</th><th style="text-align:left;padding:2px 8px;">Signal</th></tr>';
        for (const b of binds.slice(-50)) {
          html += `<tr><td style="padding:2px 8px;color:#888;">${b.nodeId}</td><td style="padding:2px 4px;color:#7c7ce0;">${b.type}</td><td style="padding:2px 8px;color:#e0e0e0;">${b.signalRef}</td></tr>`;
        }
        html += '</table>';
        content.innerHTML = html;
      }
      footer.textContent = `${binds.length} binding(s)`;
    }
  }

  // Auto-refresh
  const unsub = onUpdate(renderContent);
  renderContent();

  // Override close to also unsubscribe
  const origHide = hidePanel;
  const _hidePanel = () => { unsub(); origHide(); };
  (panel as any).__noopHide = _hidePanel;
}

function hidePanel() {
  if (panel) {
    panel.style.display = 'none';
    panelVisible = false;
  }
}

// ── Auto-initialization ───────────────────────────────────

// Re-export everything from @noopjs/signals so this module is a drop-in replacement
export const computed = _signals.computed;
export const batch = _signals.batch;
export const untrack = _signals.untrack;
export const readonly = _signals.readonly;
export const flushPending = _signals.flushPending;
export const startBatch = _signals.startBatch;
export const endBatch = _signals.endBatch;

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const g = window as any;
  g.__noopDevTools = {
    signal: getSignals,
    components: getComponents,
    bindings: getBindings,
    updateLog: getUpdateLog,
    getSignalById,
    onUpdate,
    togglePanel,
    showPanel,
    hidePanel,
    _trackSignal: trackSignal,
    _trackBinding: trackBinding,
  };

  // Patch window.__noop for inline bootstrap tracking
  if (g.__noop) {
    const origSignal = g.__noop.signal;
    if (origSignal && origSignal !== signal) {
      g.__noop.signal = (v: any) => {
        const sig = origSignal(v);
        const id = genId();
        devSignals.set(id, { id, value: v, subscriberCount: 0 });
        const origGet = sig.get.bind(sig);
        const origSet = sig.set.bind(sig);
        sig.get = () => { const val = origGet(); const e = devSignals.get(id); if (e) e.value = val; return val; };
        sig.set = (nv: any) => { origSet(nv); const e = devSignals.get(id); if (e) { e.value = nv; notify(); } };
        return sig;
      };
    }
    const origEffect = g.__noop.effect;
    if (origEffect && origEffect !== effect) {
      g.__noop.effect = (fn: () => void) => {
        return origEffect(() => { try { fn(); } catch {} });
      };
    }
  }

  // Keyboard shortcut: Cmd+Shift+N
  document.addEventListener('keydown', (e) => {
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      togglePanel();
    }
  });

  if (typeof console !== 'undefined') {
    console.log('%c⬡ Noop DevTools active — Cmd+Shift+N to open', 'color:#7c7ce0;font-weight:bold;');
  }
}
