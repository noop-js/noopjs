import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { extractPrefetchLinks, generatePageBootstrap, type ClientLevel } from '@noopjs/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function start() {
  const vite = await createServer({
    root: __dirname,
    plugins: [
      noopVite({ ssr: true }),
    ],
    server: { middlewareMode: true },
    appType: 'custom',
    ssr: {
      external: ['@noopjs/runtime', '@noopjs/signals'],
    },
  });

  const template = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    vite.middlewares.handle(req, res, async () => {
      try {
        let routeName: string;
        const params: Record<string, string> = {};

        const itemMatch = pathname.match(/^\/item\/(\d+)$/);
        const userMatch = pathname.match(/^\/user\/(\w+)$/);

        if (pathname === '/') {
          routeName = 'index';
        } else if (pathname === '/about') {
          routeName = 'about';
        } else if (pathname === '/search') {
          routeName = 'search';
        } else if (pathname === '/404') {
          routeName = 'not-found';
        } else if (itemMatch) {
          routeName = 'item';
          params.id = itemMatch[1];
        } else if (userMatch) {
          routeName = 'user';
          params.username = userMatch[1];
        } else {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
        const result = await render(routeName, params);
        const clientLevel: ClientLevel = result.clientLevel;
        const stateScript = clientLevel !== 'none'
          ? `<script id="__NOOP_STATE__" type="application/json">${
              JSON.stringify(result.state)
                .replace(/</g, '\\u003C')
                .replace(/>/g, '\\u003E')
                .replace(/-->/g, '--\\>')
            }</script>`
          : '';
        const bootstrap = generatePageBootstrap(result.state, clientLevel);
        const clientScript = (clientLevel === 'spa' || clientLevel === 'full')
          ? '<script type="module" src="/src/main.ts"></script>' : '';
        const prefetchLinks = extractPrefetchLinks(result.html)
          .map(href => `<link rel="prefetch" href="${href}">`)
          .join('\n    ');

        let html = template
          .replace('<!--ssr-content-->', result.html)
          .replace('</head>', prefetchLinks ? `  ${prefetchLinks}\n  </head>` : '</head>')
          .replace('<!--client-script-->', clientScript)
          .replace('</body>', stateScript + '\n' + bootstrap + '\n</body>');

        // Set page title from response if provided
        if (result.state.pageTitle) {
          html = html.replace('<title>HN Noop</title>', `<title>${result.state.pageTitle}</title>`);
        }

        const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: http://localhost:* https://hn.algolia.com; img-src 'self' https:; frame-src 'self' https:";
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Security-Policy': csp,
        });
        res.end(html);
      } catch (err) {
        console.error('SSR error:', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(String(err));
      }
    });
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  server.listen(PORT, () => {
    console.log('HN Noop at http://localhost:' + PORT);
  });
}

start().catch(console.error);
