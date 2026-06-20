import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { createTailwindResolver } from '@noopjs/compiler';
import tailwindcss from '@tailwindcss/vite';
import { generatePageBootstrap, type ClientLevel } from '@noopjs/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

const routeMap: Record<string, string> = {
  '/': 'index',
  '/docs': 'docs',
  '/examples': 'examples',
};

async function start() {
  const PORT = parseInt(process.env.PORT || '4000', 10);
  const vite = await createServer({
    root: __dirname,
    plugins: [
      tailwindcss(),
      noopVite({ ssr: true, tokenResolvers: [createTailwindResolver()] }),
    ],
    server: { middlewareMode: true, allowedHosts: ['noopjs.dev', 'www.noopjs.dev'] },
    appType: 'custom',
    ssr: { external: ['@noopjs/runtime', '@noopjs/signals'] },
  });

  const template = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/favicon.ico') { res.writeHead(404); res.end(); return; }

    try {
      vite.middlewares.handle(req, res, async () => {
        const routeName = routeMap[pathname];
        if (!routeName) { res.writeHead(404); res.end('Not found'); return; }

        // Generate and extract Tailwind CSS from Vite's transform pipeline
        let styleTag = '';
        try {
          const cssResult = await vite.transformRequest('/src/style.css');
          if (cssResult?.code) {
            const startMark = '__vite__css = "';
            const start = cssResult.code.indexOf(startMark);
            if (start >= 0) {
              let i = start + startMark.length;
              let css = '';
              const escapeMap = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"' };
              while (i < cssResult.code.length) {
                const ch = cssResult.code[i];
                if (ch === '\\') {
                  css += escapeMap[cssResult.code[i + 1] as keyof typeof escapeMap] || cssResult.code[i + 1];
                  i += 2;
                } else if (ch === '"') {
                  break;
                } else {
                  css += ch;
                  i++;
                }
              }
              if (css) styleTag = `<style>${css}</style>`;
            }
          }
        } catch {}

        const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
        const result = await render(routeName, {});
        const clientLevel: ClientLevel = result.clientLevel;
        const bootstrap = generatePageBootstrap(result.state, clientLevel);
        const clientScript = (clientLevel === 'spa' || clientLevel === 'full')
          ? '<script type="module" src="/src/main.ts"></script>' : '';
        const stateScript = clientLevel !== 'none'
          ? `<script id="__NOOP_STATE__" type="application/json">${
              JSON.stringify(result.state)
                .replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/-->/g, '--\\>')
            }</script>`
          : '';
        const html = template
          .replace('<!--ssr-content-->', result.html)
          .replace('<!--client-script-->', clientScript)
          .replace('</body>', stateScript + '\n' + bootstrap + '\n</body>')
          .replace('</head>', styleTag + '\n</head>')
          .replace(/<script[^>]*\/@vite\/client[^>]*><\/script>/g, '')
          .replace(/<script>\s*try\s*\{[^}]*__vite__injectQuery[^}]*\}\s*catch[^}]*\}\s*<\/script>/g, '');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      });
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(String(err));
    }
  });

  server.listen(PORT, () => {
    console.log(`NoopJS website at http://localhost:${PORT}`);
  });
}

start().catch(console.error);
