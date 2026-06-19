import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { extractPrefetchLinks, generatePageBootstrap, type ClientLevel } from '@noopjs/server';
import { createTailwindResolver } from '@noopjs/compiler';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function start() {
  const vite = await createServer({
    root: __dirname,
    plugins: [
      tailwindcss(),
      noopVite({ ssr: true, tokenResolvers: [createTailwindResolver()] }),
    ],
    server: { middlewareMode: true },
    appType: 'custom',
    ssr: {
      external: ['@noopjs/runtime', '@noopjs/signals'],
    },
  });

  const template = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

  const routeMap: Record<string, string> = {
    '/': 'index',
    '/about': 'about',
    '/form': 'form',
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Let Vite handle all non-page requests (assets, modules, HMR)
    vite.middlewares.handle(req, res, async () => {
      // This callback only runs if Vite middleware didn't handle the request
      // Match page routes
      let routeName: string | undefined;
      const blogMatch = pathname.match(/^\/blog\/(.+)$/);
      if (routeMap[pathname]) {
        routeName = routeMap[pathname];
      } else if (blogMatch) {
        routeName = 'blog-post';
      }

      if (!routeName) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const params: Record<string, string> = {};
      if (blogMatch) {
        params.slug = blogMatch[1];
      }

      try {
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
        const html = template
          .replace('<!--ssr-content-->', result.html)
          .replace('</head>', prefetchLinks ? `  ${prefetchLinks}\n  </head>` : '</head>')
          .replace('<!--client-script-->', clientScript)
          .replace('</body>', stateScript + '\n' + bootstrap + '\n</body>');
        const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: http://localhost:*";
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
    console.log('Noop Blog at http://localhost:' + PORT);
  });
}

start().catch(console.error);
