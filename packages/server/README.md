# @noopjs/server

SSR engine for NoopJS. Renders components to HTML with serialized state for client resumption.

```ts
import { renderToString, createExpressMiddleware } from '@noopjs/server';

// Full-page SSR
const { html, state } = await renderToString(MyComponent);

// Express middleware
app.use(createExpressMiddleware(MyComponent));
```

Features: `renderToString`, `renderToStream`, file-based routing (`buildRoutes`), caching, state serialization, Suspense support.

Part of the [NoopJS](https://github.com/noop-js/noopjs) framework.
