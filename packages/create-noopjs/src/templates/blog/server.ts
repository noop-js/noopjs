import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

const routeMap: Record<string, string> = {
  '/': 'index',
  '/about': 'about',
};

async function start() {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const vite = await createServer({
    root: __dirname,
    plugins: [noopVite({ ssr: true })],
    server: { middlewareMode: true },
    appType: 'custom',
    ssr: { external: ['@noopjs/runtime', '@noopjs/signals'] },
  });

  const template = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    let routeName = routeMap[pathname];
    const blogMatch = pathname.match(/^\/blog\/(.+)$/);
    if (blogMatch) routeName = 'blog-post';

    if (!routeName) { res.writeHead(404); res.end('Not found'); return; }

    const params: Record<string, string> = {};
    if (blogMatch) params.slug = blogMatch[1];

    try {
      vite.middlewares.handle(req, res, async () => {
        const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
        const isNav = req.headers['x-aether-navigate'] === '1';

        if (isNav) {
          const result = await render(routeName, params);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ html: result.html, state: result.state }));
        } else {
          const result = await render(routeName, params);
          const escaped = JSON.stringify(result.state)
            .replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/-->/g, '--\\>');
          const stateScript = `<script id="__NOOP_STATE__" type="application/json">${escaped}</script>`;
          const html = template
            .replace('<!--ssr-content-->', result.html)
            .replace('</body>', stateScript + '\n</body>');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        }
      });
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(String(err));
    }
  });

  server.listen(PORT, () => {
    console.log(`Noop Blog at http://localhost:${PORT}`);
  });
}

start().catch(console.error);
