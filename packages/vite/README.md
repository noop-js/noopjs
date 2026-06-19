# @noopjs/vite

Vite plugin for NoopJS. Compiles `.noop.tsx` files, extracts atomic CSS, enables HMR, and splits handler code for lazy loading.

```ts
// vite.config.ts
import { noopVite } from '@noopjs/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [noopVite()],
});
```

That's all you need to add NoopJS to any Vite project — the plugin includes the compiler, runtime, CSS extractor, and signals.

Part of the [NoopJS](https://github.com/noop-js/noopjs) framework.
