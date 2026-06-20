import { renderToString, generatePageBootstrap, prefetchLinkTags } from '@noopjs/server';
import type { ClientLevel } from '@noopjs/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');
const template = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

const routeMap: Record<string, (params: Record<string, string>) => string | null> = {
  '/': () => 'index',
  '/blog': () => 'blog-index',
};

function matchRoute(pathname: string): { routeName: string; params: Record<string, string> } | null {
  const staticMatch = routeMap[pathname];
  if (staticMatch) return { routeName: staticMatch({}), params: {} };
  const blogMatch = pathname.match(/^\/blog\/(.+)$/);
  if (blogMatch) return { routeName: 'blog-post', params: { slug: blogMatch[1] } };
  return null;
}

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const filePath = resolve(distDir, url.pathname.replace(/^\//, ''));
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.end(content);
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function start() {
  const PORT = parseInt(process.env.PORT || '4000', 10);
  const entryServer = await import(resolve(distDir, 'server/entry-server.js'));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/favicon.ico') { res.writeHead(404); res.end(); return; }

    if (serveStatic(req, res)) return;

    try {
      const matched = matchRoute(pathname);
      if (!matched) { res.writeHead(404); res.end('Not found'); return; }

      const entry = await entryServer.render(matched.routeName, matched.params);
      const clientLevel: ClientLevel = entry.clientLevel;

      const result = await renderToString(entry.component, entry.props, { clientLevel });

      const bootstrap = generatePageBootstrap(result.state, clientLevel);
      const prefetchLinks = prefetchLinkTags(result.html);
      const clientScript = (clientLevel === 'spa' || clientLevel === 'full')
        ? '<script type="module" src="/assets/main.js"></script>' : '';

      const stateJson = JSON.stringify(result.state)
        .replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/-->/g, '--\\>');
      const stateScript = clientLevel !== 'none'
        ? `<script id="__NOOP_STATE__" type="application/json">${stateJson}</script>`
        : '';

      const desc = entry.pageDescription ? escapeHtml(entry.pageDescription) : '';

      let html = template
        .replace('<!--ssr-content-->', result.html)
        .replace('<!--client-script-->', clientScript);

      const styleLink = existsSync(resolve(distDir, 'assets/main.css'))
        ? '<link rel="stylesheet" href="/assets/main.css" />\n' : '';

      const headInsert = styleLink +
        (prefetchLinks ? prefetchLinks + '\n' : '') +
        (desc ? `<meta name="description" content="${desc}" />\n` : '');
      html = html.replace('</head>', headInsert + '</head>');

      const bodyInsert = (stateScript ? stateScript + '\n' : '') +
        (bootstrap ? bootstrap + '\n' : '');
      html = html.replace('</body>', bodyInsert + '</body>');

      if (entry.pageTitle) {
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(entry.pageTitle)}</title>`);
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(String(err));
    }
  });

  server.listen(PORT, () => {
    console.log(`NoopJS website (production) at http://localhost:${PORT}`);
  });
}

start().catch(console.error);
