import { createServer } from 'vite';
import { noopVite } from '@noopjs/vite';
import { createTailwindResolver } from '@noopjs/compiler';
import tailwindcss from '@tailwindcss/vite';
import { renderToString, generatePageBootstrap, type ClientLevel } from '@noopjs/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function start() {
  const PORT = parseInt(process.env.PORT || '4000', 10);
  const vite = await createServer({
    root: __dirname,
    configFile: false,
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
        const matched = matchRoute(pathname);
        if (!matched) { res.writeHead(404); res.end('Not found'); return; }

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
        const entry = await render(matched.routeName, matched.params);
        const clientLevel: ClientLevel = entry.clientLevel;

        const result = await renderToString(
          entry.component,
          entry.props,
          { clientLevel },
        );

        const bootstrap = generatePageBootstrap(result.state, clientLevel);
        const clientScript = (clientLevel === 'spa' || clientLevel === 'full')
          ? '<script type="module" src="/src/main.ts"></script>' : '';

        const stateJson = JSON.stringify(result.state)
          .replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/-->/g, '--\\>');
        const stateScript = clientLevel !== 'none'
          ? `<script id="__NOOP_STATE__" type="application/json">${stateJson}</script>`
          : '';

        const desc = entry.pageDescription ? escapeHtml(entry.pageDescription) : '';

        let html = template
          .replace('<!--ssr-content-->', result.html)
          .replace('<!--client-script-->', clientScript);

        // Inject into <head> and </body>
        const headInsert = (styleTag ? styleTag + '\n' : '') +
          (desc ? `<meta name="description" content="${desc}" />\n` : '');
        html = html.replace('</head>', headInsert + '</head>');

        const bodyInsert = (stateScript ? stateScript + '\n' : '') +
          (bootstrap ? bootstrap + '\n' : '');
        html = html.replace('</body>', bodyInsert + '</body>');

        // Strip Vite client injection
        html = html
          .replace(/<script[^>]*\/@vite\/client[^>]*><\/script>/g, '')
          .replace(/<script>\s*try\s*\{[^}]*__vite__injectQuery[^}]*\}\s*catch[^}]*\}\s*<\/script>/g, '');

        // Update title per-page
        if (entry.pageTitle) {
          html = html.replace(
            /<title>[^<]*<\/title>/,
            `<title>${escapeHtml(entry.pageTitle)}</title>`,
          );
        }

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

start().catch(console.error);
