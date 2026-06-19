import { signal, computed, effect, batch, untrack, readonly } from '@noopjs/signals';
import { startRouter, navigate, initFromState } from './router';
import type { SerializedState } from './state';

// Set up global primitives for inline page scripts to use.
// The SSR engine emits synchronous inline scripts that depend on these globals.
const g = globalThis as any;
if (!g.__noop) {
  g.__noop = {};
}
const noop = g.__noop;
noop.signal = signal;
noop.computed = computed;
noop.effect = effect;
noop.batch = batch;
noop.untrack = untrack;
noop.readonly = readonly;
noop.startRouter = startRouter;
noop.navigate = navigate;

// Track effects from inline page scripts for disposal on SPA navigation
const effectDisposers: (() => void)[] = [];
noop._trackEffect = (disposer: () => void) => {
  effectDisposers.push(disposer);
};
noop._disposeEffects = () => {
  for (const d of effectDisposers) d();
  effectDisposers.length = 0;
};
noop._pageInitRan = false;

// Re-export for module usage
export { signal, computed, effect, batch, untrack, readonly, startRouter, navigate, initFromState };
export type { ClientLevel, SerializedState, NodeManifestEntry, BindingDescriptor, HandlerMeta } from './state';

// After module loads: if inline page script already ran and this is SPA/full, start router
if (typeof document !== 'undefined') {
  const doInit = () => {
    if (noop._pageInitRan && noop._needsRouter) {
      startRouter();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doInit);
  } else {
    doInit();
  }
}
