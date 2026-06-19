# @noopjs/compiler

Compiles `.noop.tsx` files to vanilla JavaScript at build time. Transforms JSX into direct DOM operations — no virtual DOM, no runtime framework.

```ts
import { compile } from '@noopjs/compiler';

const result = compile(source, { filename: 'app.noop.tsx' });
console.log(result.code); // vanilla JS
```

Also exports `createTailwindResolver` for Tailwind v4 token integration.

Part of the [NoopJS](https://github.com/noop-js/noopjs) framework.
