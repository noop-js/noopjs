# Friction Log — Hacker News Noop

Every wall hit while building a real-world app on NoopJS. Each entry describes the problem, the context, and the workaround or permanent fix applied.

---

### 1. No `.map()` in JSX
- **Context**: Iterating over story/comment arrays in JSX.
- **Problem**: The compiler's `genMapExpression` exists but is untested with complex patterns. Using `.map()` inside JSX `{}` fails at compile time.
- **Workaround**: Use imperative DOM creation in helper functions (`document.createDocumentFragment()` + `for` loop). Return a fragment and assign it to a variable in JSX. Component names must be capitalized for JSX recognition.
- **Status**: Known limitation. `genMapExpression` needs hardening.

### 2. Module-level state must live in `.ts` files, not `.noop.tsx`
- **Context**: Theme state (`signal('light')`) and search state (`signal('')`) defined at module level in `.noop.tsx`.
- **Problem**: The compiler only outputs user imports, helper functions with JSX, and the default export function body. All other module-level statements (variable declarations, `if` blocks) are dropped. `var theme = signal('light')` disappears from compiled output.
- **Workaround**: Move module-level state to a regular `.ts` file. Import the signal/functions into the `.noop.tsx` component. The `.ts` file is not processed by the Noop compiler, so all code is preserved.
- **Status**: Permanent pattern — signals that must survive across renders go in `.ts` files.

### 3. Signals from external modules are not reactive in compiled output
- **Context**: ThemeToggle uses `{theme.get() === 'dark' ? '☀️ light' : '🌙 dark'}` where `theme` is imported from `theme.ts`.
- **Problem**: The compiler only generates reactive signal bindings (`bindText`, `bindAttribute`) for signals created inside the component function via `__noopCreateSignal`. Signals imported from other modules are treated as static values — the text is set once via `nodeValue` and never updates.
- **Workaround**: Update the DOM directly in event handlers (`this.textContent = ...`). This is manual and error-prone but works for simple cases.

### 4. Event handler source captures Vite SSR import aliases
- **Context**: Handlers referencing imports get their `Function.prototype.toString()` captured during SSR, which reflects Vite's transformed code (`__vite_ssr_import_0__.theme`).
- **Problem**: The bootstrap script evaluates the handler source string on the client, but Vite's internal variables (`__vite_ssr_import_0__`) are not defined in the browser. The handler throws a ReferenceError.
- **Workaround**: Avoid referencing imported values in event handlers. Use browser-native DOM APIs (`document.documentElement`, `localStorage`) instead. For `client: resume` pages, handlers can only reference: (a) bootstrap signal variables, (b) global browser APIs, (c) inline closures.
- **Status**: Architectural issue. Handler source serialization must strip Vite aliases, or the runtime must provide import references to the bootstrap scope.

### 5. Recursive components need imperative DOM creation
- **Context**: Comment tree rendering (`Comment.noop.tsx`) — each comment can have nested children.
- **Problem**: Recursive JSX patterns are not supported by the compiler. A component calling itself in JSX causes infinite recursion at compile time or runtime.
- **Workaround**: Use a helper function with imperative DOM (`document.createElement`, `appendChild`, `innerHTML`) that calls itself recursively. Return `document.createDocumentFragment()`. The helper is called from the default export component's JSX.
- **Status**: Known limitation. `renderChildren()` pattern is documented.

### 6. `innerHTML` for user-generated HTML — SSR vs CSR asymmetry
- **Context**: HN API returns HTML in story text, comment text, and user about sections.
- **Problem**: During SSR, `innerHTML` on `ServerElement` stores a string that is emitted directly in `toHTML()`. No XSS risk since the server trusts its own output. During SPA navigation, the client re-renders and `innerHTML` is parsed by the browser, which is safe with sentinel-based mXSS protection.
- **Workaround**: The `comment-body` class is used consistently. `innerHTML` works in both SSR and CSR but for different reasons (string emission vs DOM parsing).
- **Status**: Layer 2 security feature (not Layer 1 bug). The SSR/CSR asymmetry is architecturally correct (different threat models), but **initial SSR page load** with untrusted user HTML is a genuine XSS gap — sentinel verification only protects SPA navigation. Fix with a server-side HTML sanitizer (DOMPurify + jsdom or pure-string). See [analysis](https://github.com/noop-js/noopjs/issues/new) for tracking.

### 7. Server DOM is incomplete — missing `textContent`, property reflection
- **Context**: `StoryList` helper uses `link.textContent = s.title` and `link.href = s.url`.
- **Problem**: `ServerElement` has no `textContent` property and doesn't reflect property assignments to attributes. `link.href = s.url` is a no-op — no attribute is set.
- **Workaround**: Use `setAttribute()` for attributes and `createTextNode()` + `appendChild()` for text content. Avoid property assignments on ServerElements.
- **Status**: Server DOM should add property getters/setters or at minimum document the incompleteness.

### 8. Compiler drops `signal` imports from compiled `.noop.tsx` output (fixed)
- **Context**: Original ThemeToggle had `import { signal, effect } from '@noopjs/signals'`.
- **Problem**: The import was dropped from compiled output because the compiler excluded `@noopjs/signals` from `userImports`. Module-level `signal()` calls failed with "signal is not defined".
- **Fix**: Removed the exclusion in compiler's `collectUserImports`. The import is now preserved.
- **Note**: This is now moot because module-level signals moved to `.ts` files (see #2).

### 9. `client: resume` cannot handle dynamic component re-rendering
- **Context**: Search page needs to update results list when the user clicks Search.
- **Problem**: `client: resume` only binds signals to existing DOM nodes. It does not re-execute the component function or support dynamic content creation. The `RenderResults` helper creates new DOM nodes, but resume mode can't update them.
- **Workaround**: Change the search page to `client: spa`. SPA mode re-runs the component function on signal changes, allowing dynamic content.
- **Status**: `client: resume` is for pages with minimal interactivity (form inputs, toggles). Pages with dynamic content creation should use `client: spa`.

### 10. `appendChild(null)` crashes Server DOM
- **Context**: A helper function returning `null` (instead of a DOM node) is appended to a parent element.
- **Problem**: `ServerElement.appendChild()` does not handle `null` — it tries to set `null.parentNode = this`, throwing "Cannot set properties of null".
- **Workaround**: Always return a DOM node from components/helpers. Use `document.createComment('')` as a no-op placeholder instead of `null`.
- **Status**: ServerElement should guard against null/undefined children.

### 11. Compiler needs `import { signal }` for recognizing signal creation
- **Context**: Search page defines `const query = signal('')` inside the component function.
- **Problem**: The compiler only recognizes `signal()` as a signal creator if `signal` is in `signalImports`, which is populated from imports of `@noopjs/signals`. Without the import, the declaration is treated as a regular variable.
- **Workaround**: Always include `import { signal } from '@noopjs/signals'` in any `.noop.tsx` that creates signals inside the component function body.
- **Status**: The import is preserved in the compiled output (harmless dead code since `signal` is replaced by `__noopCreateSignal`).

### 12. `document.createTextNode` creates empty text node during SSR
- **Context**: Any `{expr}` in JSX creates a text node that may be empty during SSR.
- **Problem**: The compiled code creates `document.createTextNode('')` and then sets `nodeValue = expr`. This works but creates an extra empty text node during SSR. Harmless but slightly wasteful.
- **Workaround**: Accepted as-is. The empty text node is replaced during `toHTML()` since `escapeHtml('')` returns `''`.
- **Status**: Won't fix. Empty text nodes produce zero bytes in HTML output (`escapeHtml('')` → `''`). Micro-optimization with no user-visible impact — compiler complexity not worth the gain.

### 13. CSS `data-theme` attribute not set during SSR for theme-default pages
- **Context**: Non-theme pages like `/about` and `/404` use `ThemeToggle` but the `data-theme` attribute is set via an `effect()` in `theme.ts`.
- **Problem**: The effect runs during SSR only if `theme.ts` is loaded after `enterSSR()`. Since `theme.ts` is loaded at import time (before `enterSSR`), the effect doesn't run during SSR for these pages.
- **Workaround**: The `data-theme` attribute is set in the browser by the inline bootstrap or the SPA module. During SSR, the default theme value is used for text rendering (user doesn't see the theme until JS loads).
- **Status**: Fixed. Added blocking inline `<script>` in `<head>` (index.html:6) that reads `localStorage.getItem('hn-theme')` and sets `document.documentElement.setAttribute('data-theme', t)` before paint. ~130 bytes, synchronous, runs before any rendering — zero flash. Standard pattern used by Next.js, Astro, SvelteKit, Nuxt. Future Layer 2: `@noopjs/theme` package to auto-inject this.

---

## Summary

| Area | Issues |
|------|--------|
| Compiler | 1, 8, 11 |
| Module state pattern | 2, 3 |
| Handler serialization | 4 |
| Recursive components | 5 |
| User HTML rendering (Layer 2) | 6 |
| Server DOM | 7, 10 |
| Client level model | 9 |
| SSR timing (fixed) | 13 |
| Won't fix | 12 |
