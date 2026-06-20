export const posts = [
  {
    slug: 'sentinel-mxss',
    title: 'Sentinel mXSS: Why Provenance Beats Sanitizers',
    date: '2026-06-20',
    excerpt:
      'Every SPA router that uses innerHTML to swap pages is vulnerable to mutation XSS. NoopJS takes a different approach — provable immunity through provenance verification.',
    content: `<p>Mutation XSS (mXSS) is a class of browser parser-confusion attacks that bypass every major HTML sanitizer on the market. DOMPurify, the gold standard, has had multiple mXSS bypasses — and will continue to, because the problem is fundamentally unsolvable at the sanitizer level.</p>

<p>NoopJS takes a different approach. Instead of trying to strip dangerous content from HTML strings (a denylist that can never be complete), the NoopJS SSR engine records a provenance manifest for every element it renders. On the client, before injecting server-rendered HTML, the verifier walks the parsed DOM and asks one question of each element: <strong>"did the SSR engine emit you?"</strong></p>

<p>If the element lacks a matching sentinel ID in the manifest, it's removed. If its tag doesn't match, it's removed. If it carries unexpected attributes, they're stripped. This isn't a denylist — it's a provenance check.</p>

<p>An attacker cannot forge a valid sentinel value because they don't control the SSR engine, and they cannot inject elements that survive the verification pass, because the browser's innerHTML parser cannot manufacture a valid sentinel.</p>

<p>The verifier is ~50 bytes gzipped — zero dependencies, no DOMPurify overhead. This is only possible because NoopJS controls both the SSR engine and the client runtime — the same vertical integration that enables true resumability without hydration.</p>

<p>All 18 known mXSS payloads are blocked. Zero bypasses. Not because we're better at writing sanitizers, but because we eliminated the need for them.</p>`,
  },
  {
    slug: 'noopjs-v1',
    title: 'NoopJS v1: Zero-Runtime, Real Numbers',
    date: '2026-06-15',
    excerpt:
      'NoopJS 1.0 is here. Ships 0 KB on static pages, 466 B on interactive. A real demo with 6 routes, 192 unit tests, 22 e2e tests — all green.',
    content: `<p>NoopJS 1.0 ships the core framework: a compiler that transforms JSX to vanilla DOM, a signals library following the TC39 proposal, an SSR engine with true resumability (not hydration), a resumable client runtime, an SPA router with sentinel-based mXSS protection, atomic CSS extraction, and first-class Tailwind v4 integration.</p>

<p>The numbers are real. The blog example achieves 0.06s LCP, 0 CLS, 40ms INP. The HN demo covers all six pages with real API data. All 192 unit tests and 22 e2e tests pass.</p>

<p>Layer 2 features already underway: DevTools (runtime bridge + floating panel), Streaming SSR (shell-first delivery), Form helpers (useField + Form with validation), and an ESLint plugin (4 lint rules for common footguns).</p>

<p>The architecture is sound, the numbers are real, the tests pass, the demo works. This is just the beginning.</p>`,
  },
];
