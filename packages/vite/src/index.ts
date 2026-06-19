import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import { compile } from '@noopjs/compiler';
import { extractStyles } from '@noopjs/css';
import fs from 'fs';
import path from 'path';

const NOOP_FILE_PATTERN = /\.noop\.(tsx|ts)$/;
const VIRTUAL_CSS_PREFIX = '\0noop-css:';
const HANDLER_PREFIX = '\0noop-handler:';

let handlerCodeMap = new Map<string, string>();

/** Workspace packages that can be externalized. When their dist changes during
 *  dev, the Vite dev server needs to invalidate the SSR module cache.
 *  Without this, developers get stale behavior after rebuilding a workspace package. */
const EXTERNALIZED_PACKAGES = ['@noopjs/runtime', '@noopjs/signals'];

export interface NoopViteOptions {
  cssMode?: 'atomic' | 'inline';
  ssr?: boolean;
  extractHandlers?: boolean;
  tokenResolvers?: import('@noopjs/compiler').TokenResolver[];
}

export function noopVite(options: NoopViteOptions = {}): Plugin {
  let config: ResolvedConfig;
  let server: ViteDevServer | undefined;
  const cssMap = new Map<string, string>();

  function cssVirtualId(realId: string): string {
    return VIRTUAL_CSS_PREFIX + realId.replace(NOOP_FILE_PATTERN, '.noop.css');
  }

function prependImport(result: { code: string; map?: any }, importPath: string): { code: string; map?: any } {
  const importLine = `import '${importPath}';\n`;
  const map = result.map;
  if (!map) {
    return { code: importLine + result.code, map: undefined };
  }
  // Shift all generated line references by 1 to account for the prepended line
  const newMappings = map.mappings.replace(/([A-Za-z0-9+/]+)/g, (m: string) => {
    try {
      const decoded = vlqDecode(m);
      if (decoded.length > 0) {
        decoded[0] += 1; // generated line +1
      }
      return vlqEncode(decoded);
    } catch {
      return m;
    }
  });
  return {
    code: importLine + result.code,
    map: { ...map, mappings: newMappings },
  };
}

function vlqDecode(str: string): number[] {
  // Simple VLQ decoder for source-map-js VLQ format
  const result: number[] = [];
  let shift = 0;
  let value = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i) - 63; // 'A' is 65, minus 63 gives 2
    const digit = c & 31;
    value |= (digit << shift);
    shift += 5;
    if ((c & 32) === 0) {
      result.push((value & 1) ? -(value >> 1) : (value >> 1));
      shift = 0;
      value = 0;
    }
  }
  return result;
}

function vlqEncode(values: number[]): string {
  let result = '';
  for (let value of values) {
    const signBit = value < 0 ? 1 : 0;
    value = value < 0 ? -value : value;
    value = (value << 1) | signBit;
    do {
      let digit = value & 31;
      value >>= 5;
      if (value > 0) digit |= 32;
      result += String.fromCharCode(digit + 63);
    } while (value > 0);
  }
  return result;
}

  return {
    name: '@noopjs/vite',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    configureServer(devServer) {
      server = devServer;

      // Watch externalized workspace packages for changes and restart the dev
      // server so SSR module cache is invalidated (Node.js ESM cache can't be
      // cleared per-module, so a restart is the reliable path).
      if (config.command === 'serve') {
        let restartTimer: ReturnType<typeof setTimeout> | undefined;
        const scheduleRestart = () => {
          if (restartTimer) return;
          restartTimer = setTimeout(() => {
            restartTimer = undefined;
            devServer.restart(true);
          }, 300);
        };

        for (const pkgName of EXTERNALIZED_PACKAGES) {
          try {
            const pkgMain = require.resolve(pkgName + '/package.json');
            const pkgDir = path.dirname(pkgMain);
            const distDir = path.join(pkgDir, 'dist');
            if (fs.existsSync(distDir)) {
              fs.watch(distDir, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.cjs'))) {
                  scheduleRestart();
                }
              });
            }
          } catch {
            // Package not installed — skip
          }
        }
      }
    },

    resolveId(id: string, importer) {
      if (id.startsWith(VIRTUAL_CSS_PREFIX)) return id;
      if (id.startsWith(HANDLER_PREFIX)) return id;
      if (id === '@noopjs/runtime' || id === '@noopjs/signals') return null;

      // Resolve virtual .noop.css imports from .noop.tsx files
      if (id.endsWith('.noop.css') && importer && NOOP_FILE_PATTERN.test(importer)) {
        const importerDir = importer.substring(0, importer.lastIndexOf('/'));
        const resolved = cssVirtualId(importerDir + '/' + id.replace(/^\.\//, ''));
        if (cssMap.has(resolved)) return resolved;
      }
      // Resolve virtual handler imports
      if (id.includes('__noop_handler__') && importer && NOOP_FILE_PATTERN.test(importer)) {
        const handlerId = id.match(/__noop_handler__(\w+)\.js/)?.[1];
        if (handlerId) {
          return HANDLER_PREFIX + handlerId;
        }
      }
      return null;
    },

    load(id: string) {
      if (id.startsWith(VIRTUAL_CSS_PREFIX) && cssMap.has(id)) {
        return cssMap.get(id);
      }
      if (id.startsWith(HANDLER_PREFIX)) {
        const handlerId = id.slice(HANDLER_PREFIX.length);
        const code = handlerCodeMap.get(handlerId);
        if (code) return code;
        // Fallback: return a noop handler
        return 'export default function(e) {}';
      }
      return null;
    },

    renderChunk(code, chunk) {
      // Emit preload headers for handler chunks
      if (options.extractHandlers && config?.command === 'build') {
        const handlerRefs = code.match(/__noop_handler__\w+\.js/g);
        if (handlerRefs) {
          const modules = [...new Set(handlerRefs)].map(h => `\0${h}`);
          return { code, map: null };
        }
      }
      return null;
    },

    async transform(code: string, id: string) {
      if (!NOOP_FILE_PATTERN.test(id)) return null;

      // Guard: if already compiled (has __noopId or __compId), skip
      if (code.includes('__noopId') || code.includes('__compId')) return null;

      try {
        let compiled;

        if (options.cssMode !== 'inline') {
          // Atomic mode: extract CSS, then compile the transformed source
          const cssResult = extractStyles(code);
          const cssId = cssVirtualId(id);

          // Compile the CSS-transformed source (styles export removed,
          // styles.xxx replaced with generated class names)
          compiled = compile(cssResult.transformedSource, {
            filename: id,
            sourceMaps: true,
            extractHandlers: options.extractHandlers ?? config?.command === 'build',
            tokenResolvers: options.tokenResolvers,
          });

          // Merge CSS from both extractStyles (export const styles) and compiler (inline style objects)
          let mergedCSS = cssResult.css || '';
          if (compiled.css) {
            mergedCSS = mergedCSS ? mergedCSS + '\n' + compiled.css : compiled.css;
          }

          if (mergedCSS) {
            cssMap.set(cssId, mergedCSS);
          }

          // Register extracted handlers for virtual chunk loading
          if (compiled.handlers) {
            for (const h of compiled.handlers) {
              handlerCodeMap.set(h.id, `export default function(e) { ${h.code} }`);
            }
          }

          // Add side-effect import for the virtual CSS module.
          // Vite's CSS pipeline picks this up and injects it.
          if (mergedCSS) {
            const cssFilePath = id.replace(NOOP_FILE_PATTERN, '.noop.css');
            const relativePath = './' + cssFilePath.split('/').pop();
            compiled = prependImport(compiled, relativePath);
          }
        } else {
          // Inline mode: compile the original source as-is
          compiled = compile(code, {
            filename: id,
            sourceMaps: true,
            extractHandlers: options.extractHandlers ?? config?.command === 'build',
            tokenResolvers: options.tokenResolvers,
          });

          if (compiled.handlers) {
            for (const h of compiled.handlers) {
              handlerCodeMap.set(h.id, `export default function(e) { ${h.code} }`);
            }
          }
        }

        // Add HMR boundary
        if (config && config.command === 'serve') {
          compiled.code += `\n\nif (import.meta.hot) {
  import.meta.hot.accept(mod => {
    if (mod && typeof mod.default === 'function') {
      const root = document.getElementById('root');
      if (root) {
        const newRoot = mod.default({}, 'c0');
        if (newRoot instanceof Node) {
          root.innerHTML = '';
          root.appendChild(newRoot);
        }
      }
    }
  });
}`;
        }

        return {
          code: compiled.code,
          map: compiled.map || null,
        };
      } catch (err: any) {
        this.error(`[Noop] Failed to compile ${id}: ${err.message}`);
        return null;
      }
    },

    handleHotUpdate(ctx) {
      if (NOOP_FILE_PATTERN.test(ctx.file)) {
        // Force full re-load and re-transform
        return ctx.modules;
      }
      return undefined;
    },
  };
}
