import type { RenderResult } from './render';

interface CacheEntry {
  result: RenderResult;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export interface CacheOptions {
  ttl: number;
  key: string;
  staleWhileRevalidate?: boolean;
}

export function cacheRender(
  options: CacheOptions,
  renderFn: () => RenderResult,
): RenderResult {
  const existing = store.get(options.key);

  // Serve stale while revalidating
  if (existing && options.staleWhileRevalidate) {
    if (Date.now() < existing.expiresAt) {
      return existing.result;
    }
    // Stale: serve stale, re-render in background
    const fresh = renderFn();
    store.set(options.key, { result: fresh, expiresAt: Date.now() + options.ttl });
    return existing.result;
  }

  // Fresh cache hit
  if (existing && Date.now() < existing.expiresAt) {
    return existing.result;
  }

  // Cache miss or expired
  const result = renderFn();
  store.set(options.key, { result, expiresAt: Date.now() + options.ttl });
  return result;
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function clearCache(): void {
  store.clear();
}
