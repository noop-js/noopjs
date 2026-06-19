import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { type ClientLevel } from '@noopjs/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    if (url.pathname === '/favicon.ico') { res.writeHead(404); res.end(); return; }

    try {
      vite.middlewares.handle(req, res, async () => {
        if (url.pathname === '/') {
          const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
          const result = await render();
          const clientLevel: ClientLevel = result.clientLevel;
          const escaped = JSON.stringify(result.state)
            .replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/-->/g, '--\\>');
          const stateScript = `<script id="__NOOP_STATE__" type="application/json">${escaped}</script>`;
          const clientScript = clientLevel === 'none' ? '' : '<script type="module" src="/src/main.ts"></script>';
          const html = template
            .replace('<!--ssr-content-->', result.html)
            .replace('<!--client-script-->', clientScript)
            .replace('</body>', stateScript + '\n</body>');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(String(err));
    }
  });

  server.listen(PORT, () => {
    console.log(`NoopJS App at http://localhost:${PORT}`);
  });
}

start().catch(console.error);
