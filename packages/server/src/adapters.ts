import { renderToString } from './render';
import type { IncomingMessage, ServerResponse } from 'http';

export interface AetherRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface AetherResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function buildPage(result: { html: string; state: any }): string {
  const stateJson = JSON.stringify(result.state)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/-->/g, '--\\>');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div id="root">${result.html}</div>
  <script id="__NOOP_STATE__" type="application/json">${stateJson}</script>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>`;
}

/** Create a Node.js http server handler */
export function createNodeHandler(
  componentFn: (...args: any[]) => any,
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const result = await renderToString(componentFn);
      const html = buildPage(result);
      const etag = '"' + Buffer.from(html).length + '-' + Date.now().toString(36) + '"';

      // ETag / 304 handling
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { 'ETag': etag });
        res.end();
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/html',
        'ETag': etag,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Internal Server Error</h1>');
    }
  };
}

/** Create an Express-compatible middleware */
export function createExpressMiddleware(
  componentFn: (...args: any[]) => any,
) {
  return async (req: any, res: any, next: any) => {
    try {
      const result = await renderToString(componentFn);

      const stateJson = JSON.stringify(result.state)
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/-->/g, '--\\>');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div id="root">${result.html}</div>
  <script id="__NOOP_STATE__" type="application/json">${stateJson}</script>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>`;

      res.type('html').send(html);
    } catch (err) {
      next(err);
    }
  };
}
