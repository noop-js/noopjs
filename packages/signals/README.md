# @noopjs/signals

TC39-standard reactive primitives: `signal`, `computed`, `effect`, `batch`, `untrack`.

```ts
import { signal, computed, effect } from '@noopjs/signals';

const count = signal(0);
const doubled = computed(() => count.get() * 2);
effect(() => console.log(count.get()));
```

Part of the [NoopJS](https://github.com/noop-js/noopjs) framework.
