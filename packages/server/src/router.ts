import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export interface Route {
  pattern: string;
  filePath: string;
  paramNames: string[];
  regex: RegExp;
  isLayout: boolean;
}

/**
 * Builds a route map from a directory of .noop.tsx files.
 *
 * Convention:
 *   src/routes/index.noop.tsx       -> /
 *   src/routes/about.noop.tsx       -> /about
 *   src/routes/blog/[slug].noop.tsx -> /blog/:slug
 *   src/routes/dashboard/page.noop.tsx -> /dashboard
 *   src/routes/dashboard/layout.noop.tsx -> layout wrapper (not a page)
 */
export function buildRoutes(routesDir: string): Route[] {
  const routes: Route[] = [];

  function scan(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (entry.endsWith('.noop.tsx') || entry.endsWith('.noop.ts')) {
        const relPath = relative(routesDir, fullPath);
        const route = parseRouteFile(relPath, fullPath);
        if (route) routes.push(route);
      }
    }
  }

  scan(routesDir);
  return routes;
}

function parseRouteFile(relPath: string, filePath: string): Route | null {
  // Remove extension
  let name = relPath.replace(/\.noop\.(tsx|ts)$/, '');

  const isLayout = name.endsWith('/layout');
  if (isLayout) {
    name = name.replace(/\/layout$/, '');
  }

  // Map /page to parent directory (e.g. dashboard/page → /dashboard)
  if (name.endsWith('/page')) {
    name = name.replace(/\/page$/, '');
  }

  // If it's just "index" or ends with "/index", map to parent directory
  if (name === 'index' || name.endsWith('/index')) {
    name = name.replace(/\/?index$/, '');
  }

  // Build pattern and extract param names
  const parts = name.split('/').filter(Boolean);
  const paramNames: string[] = [];
  const regexParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const paramName = part.slice(1, -1);
      paramNames.push(paramName);
      regexParts.push('([^/]+)');
    } else {
      regexParts.push(escapeRegex(part));
    }
  }

  const displayParts = parts.map(p =>
    p.startsWith('[') && p.endsWith(']') ? ':' + p.slice(1, -1) : p,
  );
  const pattern = '/' + displayParts.join('/');
  const regex = new RegExp(`^/${regexParts.join('/')}$`);

  return { pattern, filePath, paramNames, regex, isLayout };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match a URL path against the route table.
 * Returns the matching route and extracted params, or null.
 */
export function matchRoute(url: string, routes: Route[]): {
  route: Route;
  params: Record<string, string>;
} | null {
  const path = new URL(url, 'http://localhost').pathname;

  for (const route of routes) {
    if (route.isLayout) continue;
    const match = path.match(route.regex);
    if (match) {
      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
      }
      return { route, params };
    }
  }

  return null;
}

/**
 * Find layout files for a given route.
 * Walks up the directory tree to find layout.noop.tsx files.
 */
export function findLayouts(routesDir: string, route: Route): string[] {
  const layouts: string[] = [];
  const dir = route.filePath.substring(0, route.filePath.lastIndexOf('/'));

  // Walk up from the route's directory to the routes root
  let current = dir;
  while (current.startsWith(routesDir)) {
    const layoutPath = join(current, 'layout.noop.tsx');
    try {
      if (statSync(layoutPath).isFile()) {
        layouts.unshift(layoutPath);
      }
    } catch {
      // No layout here
    }
    if (current === routesDir) break;
    current = current.substring(0, current.lastIndexOf('/'));
    if (!current) break;
  }

  return layouts;
}
