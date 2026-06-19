# @noopjs/css

Atomic CSS extractor for NoopJS. Converts static style objects to hashed utility classes at build time — zero runtime CSS-in-JS.

```ts
import { extractStyles } from '@noopjs/css';

const { classNames, css } = extractStyles({
  card: { padding: '16px', borderRadius: '8px' },
});
```

Part of the [NoopJS](https://github.com/noop-js/noopjs) framework.
