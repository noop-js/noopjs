import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { renderToStream, generatePageBootstrap, type ClientLevel } from '@noopjs/server';
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
        const page = await render(routeName, params);
        const clientLevel: ClientLevel = page.clientLevel;
        const pageTitle = page.pageTitle || 'HN Noop';

        const clientScript = (clientLevel === 'spa' || clientLevel === 'full')
          ? '<script type="module" src="/src/main.ts"></script>' : '';

        // Build head from template
        let headHtml = '<meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />';
        headHtml += `\n  <title>${pageTitle}</title>`;
        headHtml += '\n  <script>(function(){var t=localStorage.getItem(\'hn-theme\')||\'light\';document.documentElement.setAttribute(\'data-theme\',t)})()</script>';

        const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: http://localhost:* https://hn.algolia.com; img-src 'self' https:; frame-src 'self' https:";
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Security-Policy': csp,
          'Transfer-Encoding': 'chunked',
        });

        // Stream shell immediately (head, open body + root)
        res.write('<!DOCTYPE html>\n<html lang="en">\n<head>\n  ');
        res.write(headHtml);
        res.write('\n</head>\n<body>\n<div id="root">');

        // Stream content via renderToStream — serializes incrementally
        const { stream, state: statePromise } = renderToStream(page.component, page.props, { clientLevel });
        const reader = stream.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        };
        await pump();

        // Get the serialized state from the stream result (matches the rendered HTML exactly)
        const streamState = await statePromise;
        const fullState = { ...streamState, pageTitle };
        const stateJson = JSON.stringify(fullState)
          .replace(/</g, '\\u003C')
          .replace(/>/g, '\\u003E')
          .replace(/-->/g, '--\\>');
        const stateScript = clientLevel !== 'none'
          ? `<script id="__NOOP_STATE__" type="application/json">${stateJson}</script>`
          : '';
        const bootstrap = generatePageBootstrap(fullState, clientLevel);

        // Stream footer (close root div, scripts, close body/html)
        res.write('</div>\n');
        if (stateScript) res.write(stateScript + '\n');
        if (bootstrap) res.write(bootstrap + '\n');
        if (clientScript) res.write(clientScript + '\n');
        res.write('</body>\n</html>');
        res.end();
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
