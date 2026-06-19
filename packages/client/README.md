# @noopjs/client

Client resumer for NoopJS. Re-attaches signal bindings to SSR-rendered DOM without re-running components — true resumability, not hydration.

```ts
import { init, navigate } from '@noopjs/client';

// Auto-initializes on DOMContentLoaded
// SPA navigation with View Transitions API
await navigate('/blog/post-1');
```

~1.0 KB gzipped. Features: signal restoration, SPA router, native `<link rel="prefetch">`, event re-delegation.

Part of the [NoopJS](https://github.com/noop-js/noopjs) framework.
