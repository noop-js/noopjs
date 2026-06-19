import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function start() {
  const vite = await createServer({
    root: __dirname,
    plugins: [noopVite({ ssr: true })],
    server: { middlewareMode: true },
    appType: 'custom',
    ssr: {
      external: ['@noopjs/runtime', '@noopjs/signals'],
    },
  });

  const template = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/favicon.ico') {
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      // Let Vite handle static assets and client-side modules
      vite.middlewares.handle(req, res, async () => {
        if (url.pathname === '/') {
          // SSR render
          const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
          const rendered = await render();
          const stateScript = `<script id="__NOOP_STATE__" type="application/json">${JSON.stringify(rendered.state)}</script>`;
          const html = template
            .replace('<!--ssr-content-->', rendered.html)
            .replace('</body>', stateScript + '\n</body>');
          const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
          res.writeHead(200, {
            'Content-Type': 'text/html',
            'Content-Security-Policy': csp,
          });
          res.end(html);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
    } catch (err) {
      console.error('SSR error:', err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(String(err));
    }
  });

  server.listen(3000, () => {
    console.log('Aether SSR dev server at http://localhost:3000');
  });
}

start().catch(console.error);
