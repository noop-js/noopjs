<p align="center">
  <img src="https://img.shields.io/badge/LCP-0.06s-brightgreen" alt="LCP 0.06s" />
  <img src="https://img.shields.io/badge/CLS-0-brightgreen" alt="CLS 0" />
  <img src="https://img.shields.io/badge/INP-40ms-brightgreen" alt="INP 40ms" />
  <img src="https://img.shields.io/badge/Client_JS-0_KB_(static)-blue" alt="0 KB JS for static pages" />
  <img src="https://img.shields.io/badge/version-0.5.0-blue" alt="Version 0.5.0" />
  <img src="https://img.shields.io/badge/license-ISC-blue" alt="ISC License" />
</p>

<h1 align="center">NoopJS</h1>
<p align="center"><strong>Zero-runtime · Resumable · Signal-based · Atomic CSS · Tailwind v4 · SSR · SPA</strong></p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="examples/blog">Live Demo</a> ·
  <a href="docs/index.html">Documentation</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

```
    ╔══════════════════════════════════════════════════════════╗
    ║  .noop.tsx   ──►  Compiler  ──►  Vanilla JS            ║
    ║                    │                                     ║
    ║                    ├── SSR:  HTML + Serialized State     ║
    ║                    │         │                           ║
    ║                    │         ▼                           ║
    ║                    │    Client Resumer  ◄── 1.5 KB       ║
    ║                    │    (No hydration — just resume)     ║
    ║                    │                                     ║
    ║                    └── Atomic CSS  +  Tailwind v4        ║
    ║                        (Zero runtime CSS-in-JS)         ║
    ╚══════════════════════════════════════════════════════════╝
```

---

## Why NoopJS Exists

**AI generates code now.** Frameworks built on hooks, rules, and runtime contracts (React, Vue, Angular) were designed for humans. An AI doesn't need rules — it needs a framework that compiles away. NoopJS components are plain functions. No `useMemo`, no `useCallback`, no rules of hooks. The compiler handles everything.

**Performance is no longer optional.** Core Web Vitals are SEO signals. NoopJS delivers a 0.06s LCP on an SSR page — not in a benchmark, but in a real blog application with Tailwind CSS.

**The silos must break.** Components should work everywhere. NoopJS components compile to native Custom Elements on demand. Write once, embed anywhere.

**JavaScript bundles must shrink.** The average React page ships ~45 KB of framework JS. NoopJS ships 0 KB for static pages. Interactive pages ship only the exact handler code, lazily loaded on first click. The resumer is 1.5 KB.

---

## What's in the Box

```bash
npm install @noopjs/vite
```

Then add one plugin to `vite.config.ts`:

```ts
import { noopVite } from '@noopjs/vite';

export default defineConfig({
  plugins: [noopVite()],
});
```

| What you get | Why it matters |
|---|---|
| **Compiler** | JSX → vanilla DOM. No framework code ships. |
| **Signals** | TC39-standard `signal`, `computed`, `effect`, `batch`. |
| **Atomic CSS** | Style objects → hashed utility classes. Zero runtime CSS-in-JS. |
| **SSR engine** | Render to HTML, serialize state, resume on client. True resumability. |
| **Client resumer** | ~1.5 KB. Re-attaches signals to DOM without re-running components. |
| **SPA router** | Intercepts `<a>` clicks. View Transitions API. Auto-prefetching. |
| **Event delegation** | Single global listener. Handlers loaded lazily on first interaction. |
| **Tailwind v4** | First-class token resolver. `token.spacing[6]` → `p-6`. |
| **Custom Elements** | Export as native Web Components via `@noopjs customElement` directive. |
| **CLI** | `dev`, `build`, `generate`, `analyze`, `check`, `init`. |
| **HMR** | Full hot module replacement in development. |

---

## Quick Start

```bash
npm create @noopjs
# Pick a template: counter, blog, or empty
```

Or add to any existing Vite project:

```bash
npm install @noopjs/vite
```

```ts
// vite.config.ts
import { noopVite } from '@noopjs/vite';
export default defineConfig({ plugins: [noopVite()] });
```

```tsx
// src/counter.noop.tsx
import { signal } from '@noopjs/signals';

export const styles = {
  count: { fontSize: '24px', fontWeight: 'bold' },
  button: { padding: '8px 16px', cursor: 'pointer' },
};

export default function Counter() {
  const count = signal(0);
  return (
    <div>
      <p className={styles.count}>{count}</p>
      <button className={styles.button} onClick={() => count.set(count.get() + 1)}>
        Increment
      </button>
    </div>
  );
}
```

```ts
// src/main.ts
import Counter from './counter.noop';
document.getElementById('root')!.appendChild(Counter());
```

```bash
npx vite              # dev server
npx noopjs build      # production build
```

---

## Core Concepts

### Signals

Fine-grained reactivity following the TC39 proposal.

```ts
import { signal, computed, effect, batch } from '@noopjs/signals';

const count = signal(0);
const doubled = computed(() => count.get() * 2);

effect(() => console.log(count.get()));

batch(() => {
  count.set(1);
  count.set(2);
}); // effect runs once
```

### Compilation

The compiler transforms `.noop.tsx` into vanilla JavaScript at build time.

```tsx
// You write:
export default function Greeting(props: { name: string }) {
  return <div>Hello, {props.name}!</div>;
}
```

```js
// The compiler generates (simplified):
export default function Greeting(props) {
  const el = document.createElement('div');
  const txt = document.createTextNode('Hello, ' + props.name);
  el.appendChild(txt);
  return el;
}
```

No JSX at runtime. No framework imports. No VDOM. Just DOM.

### Resumability (Not Hydration)

Hydration runs a component on the client and diffs its output against server HTML — duplicate work. Resumption serializes the reactive graph and re-attaches it without running a single line of component code.

```
         SSR                               Client
  ┌─────────────────┐              ┌──────────────────┐
  │                 │              │                  │
  │  signal(0)      │  ──state──►  │  signal(0)       │
  │  effect → DOM   │              │  effect → same   │
  │                 │   ◄─lazy──   │  DOM (no re-run) │
  │  handler click  │              │                  │
  └─────────────────┘              └──────────────────┘
```

### CSS

**NoopCSS** — Static style objects extract to atomic CSS classes at build time:

```tsx
export const styles = {
  card: { padding: '16px', borderRadius: '8px', display: 'flex', gap: '12px' },
};
// className={styles.card} → className="_a3f8b2 _c9e12a _e7d4b1"
```

**Tailwind v4** — First-class integration via token resolvers:

```tsx
import { token } from '@noopjs/runtime';

<div style={{ padding: token.spacing[6], color: token.color.blue[500] }}>
```

Resolves to `p-6`, `text-blue-500` at compile time. Both systems coexist on the same element:

```html
<div class="p-6 _a3f8b2">Tailwind + NoopCSS</div>
```

---

## Packages

| Package | Version | Description |
|---|---|---|
| `@noopjs/signals` | 0.5.0 | TC39 Signals — `signal`, `computed`, `effect`, `batch`, `untrack`, `readonly` |
| `@noopjs/compiler` | 0.5.0 | Compiles `.noop.tsx` to vanilla JS. Exports `createTailwindResolver`. |
| `@noopjs/runtime` | 0.5.0 | Browser runtime — `bindText`, `bindEvent`, `bindStyle`, `onMount`, Context, Portals, Suspense |
| `@noopjs/client` | 0.5.0 | Client resumer — SSR hydration, SPA router, prefetching |
| `@noopjs/server` | 0.5.0 | SSR engine — `renderToString`, `renderToStream`, file-based routing, caching |
| `@noopjs/vite` | 0.5.0 | Vite plugin — compiles `.noop.tsx`, extracts CSS, HMR, handler splitting |
| `@noopjs/css` | 0.5.0 | Atomic CSS extractor — `extractStyles()` converts style objects to atomic classes |
| `@noopjs/cli` | 0.5.0 | CLI — `dev`, `build`, `generate`, `analyze`, `check`, `init` |
| `@noopjs/create-noopjs` | 0.5.0 | `npm create @noopjs` — project scaffolding with templates |

---

## Examples

```bash
cd examples/counter       # Minimal interactive component
npm run dev               # Client-rendered, signals + atomic CSS

cd examples/blog          # Full SSR blog with Tailwind
npm run ssr               # → http://localhost:3000 (0.06s LCP)
```

The blog example demonstrates SSR + Tailwind v4 + NoopCSS + SPA navigation + lazy handler loading end-to-end.

---

## Roadmap

### Layer 1 — Foundation (current)
- ✅ Signals (TC39 proposal)
- ✅ Compiler (JSX → DOM)
- ✅ NoopCSS (atomic extraction)
- ✅ Tailwind v4 integration
- ✅ SSR + resumability
- ✅ SPA router
- ✅ Custom Elements export
- ✅ HMR / dev server
- ✅ CLI

### Layer 2 — Production (next)
- 🔲 Design-system libraries
- 🔲 Image optimization
- 🔲 Streaming SSR improvements
- 🔲 i18n / l10n primitives
- 🔲 Form helpers
- 🔲 Performance budgets tooling
- 🔲 ESLint plugin
- 🔲 DevTools extension

### Layer 3 — Ecosystem (future)
- 🔲 Noop Cloud (serverless edge SSR)
- 🔲 AI scaffolding
- 🔲 Component marketplace
- 🔲 First-class mobile

---

## Contributing

NoopJS is open-source. Contributions of all kinds welcome — code, docs, bug reports, ideas.

- [Open an issue](https://github.com/anomalyco/opencode/issues)
- Submit a PR
- Improve the documentation in `docs/`
- Build example projects

---

## Maintainers

**Mohammed Boukaba** — Creator and lead developer.

NoopJS is built on a simple philosophy: the web doesn't need another framework. It needs one that gets out of the way.

---

<p align="center">
  <strong>LCP 0.06s · CLS 0 · INP 40ms · 0 KB JS on static pages</strong><br>
  <em>v0.5.0</em>
</p>
