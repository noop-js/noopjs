import { describe, it, expect } from 'vitest';
import { buildRoutes, matchRoute, findLayouts } from '../src/router';
import { join } from 'path';

const fixturesDir = join(__dirname, 'fixtures', 'routes');

describe('file-system router', () => {
  it('builds routes from directory', () => {
    const routes = buildRoutes(fixturesDir);
    expect(routes.length).toBeGreaterThanOrEqual(3);
  });

  it('maps index to root', () => {
    const routes = buildRoutes(fixturesDir);
    const root = routes.find(r => r.pattern === '/');
    expect(root).toBeTruthy();
    expect(root!.filePath).toContain('index.noop.tsx');
  });

  it('maps about to /about', () => {
    const routes = buildRoutes(fixturesDir);
    const about = routes.find(r => r.pattern === '/about');
    expect(about).toBeTruthy();
  });

  it('maps [slug] to /blog/:slug with param', () => {
    const routes = buildRoutes(fixturesDir);
    const blog = routes.find(r => r.pattern === '/blog/:slug');
    expect(blog).toBeTruthy();
    expect(blog!.paramNames).toContain('slug');
  });

  it('matches a URL to a route', () => {
    const routes = buildRoutes(fixturesDir);
    const match = matchRoute('/about', routes);
    expect(match).toBeTruthy();
    expect(match!.route.pattern).toBe('/about');
  });

  it('matches dynamic routes with params', () => {
    const routes = buildRoutes(fixturesDir);
    const match = matchRoute('/blog/hello-world', routes);
    expect(match).toBeTruthy();
    expect(match!.params.slug).toBe('hello-world');
  });

  it('returns null for unmatched routes', () => {
    const routes = buildRoutes(fixturesDir);
    const match = matchRoute('/nonexistent', routes);
    expect(match).toBeNull();
  });

  it('detects layout files', () => {
    const routes = buildRoutes(fixturesDir);
    const layouts = routes.filter(r => r.isLayout);
    expect(layouts.length).toBeGreaterThanOrEqual(1);
    expect(layouts.some(l => l.filePath.includes('layout'))).toBe(true);
  });

  it('maps dashboard/page to /dashboard', () => {
    const routes = buildRoutes(fixturesDir);
    const dash = routes.find(r => r.pattern === '/dashboard' && !r.isLayout);
    expect(dash).toBeTruthy();
    expect(dash!.filePath).toContain('page.noop.tsx');
  });

  it('dashboard layout is separate from page', () => {
    const routes = buildRoutes(fixturesDir);
    const dashLayout = routes.find(r => r.pattern === '/dashboard' && r.isLayout);
    expect(dashLayout).toBeTruthy();
    expect(dashLayout!.filePath).toContain('layout.noop.tsx');
  });
});
