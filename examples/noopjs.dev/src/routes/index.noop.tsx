// client: spa
import { signal } from '@noopjs/signals';

export default function HomePage() {
  const count = signal(0);

  return (
    <div className="bg-gray-950 text-gray-100 font-sans antialiased min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/75 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold">
            <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="#f59e0b"/><text x="16" y="22" textAnchor="middle" fill="#0f0f13" fontSize="20" fontWeight="900">Ø</text></svg>
            <span>NoopJS</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="https://github.com/noop-js/noopjs" className="text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors">GitHub</a>
            <a href="https://github.com/noop-js/noopjs" target="_blank" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500 hover:bg-gray-800 transition-all">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Star
            </a>
          </div>
        </div>
      </nav>

      <main>
      <section className="text-center px-6 pt-28 pb-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-400/10 border border-amber-400/20 text-amber-400 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          v1.1.0 — The zero-runtime framework is here
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-5">
          The{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">Zero-Runtime</span>
          <br />
          JavaScript Framework
        </h1>
        <p className="text-gray-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10">
          Ships <strong className="text-gray-100 font-semibold">0 KB</strong> on static pages.{' '}
          <strong className="text-gray-100 font-semibold">464 B</strong> on interactive pages.{' '}
          No hydration. No virtual DOM. Just compiled JavaScript.
        </p>
        <div className="flex justify-center gap-3 flex-wrap mb-16">
          <a href="https://github.com/noop-js/noopjs" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-400 to-purple-400 text-gray-950 hover:opacity-90 transition-opacity">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            Star on GitHub
          </a>
          <a href="#demo" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500 hover:bg-gray-800 transition-all">
            See Live Demo
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden text-left shadow-2xl shadow-black/40">
          <div className="flex gap-2 px-5 py-3.5 border-b border-gray-800 bg-gray-900">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
          </div>
          <div className="p-6 font-mono text-sm leading-loose">
            <div><span className="text-emerald-400">$</span><span className="text-gray-400 ml-2">npm create noopjs@latest</span></div>
            <div className="text-gray-400 pl-5">Creating your NoopJS project...</div>
            <div className="text-emerald-400 pl-5">✔ Project created in 0.3s</div>
            <div className="text-amber-400 pl-5">✔ 0 KB framework JS on static pages</div>
            <div className="text-amber-400 pl-5">✔ 464 B on interactive pages</div>
            <div className="text-gray-400 pl-5">Ready! cd my-app &amp;&amp; npm run dev</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-emerald-400">❯</span>
              <span className="w-2 h-4 bg-amber-400 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      <section className="text-center px-6 py-24">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          How It{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">Works</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-16">
          NoopJS compiles your framework code away at build time. Zero runtime overhead on static pages, minimal JS on interactive ones.
        </p>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-9 h-9 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-sm font-bold mx-auto mb-4">1</div>
            <h3 className="text-base font-bold mb-2">Write Components</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">Use familiar JSX with signals. NoopJS compiles your components ahead of time — no virtual DOM, no hydration.</p>
          </div>
          <div className="text-center">
            <div className="w-9 h-9 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-sm font-bold mx-auto mb-4">2</div>
            <h3 className="text-base font-bold mb-2">Compile at Build</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">Each page is compiled to a minimal bootstrap script. Interactive pages get ~464 B of inline JS. Static pages get 0 KB.</p>
          </div>
          <div className="text-center">
            <div className="w-9 h-9 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-sm font-bold mx-auto mb-4">3</div>
            <h3 className="text-base font-bold mb-2">Serve &amp; Resume</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">SSR generates fully-formed HTML. The inline bootstrap resumes interactivity without re-running the entire component.</p>
          </div>
        </div>
      </section>

      <section className="text-center px-6 py-24 bg-gray-900/30">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          Bundle Size{' '}
          <span className="bg-gradient-to-r from-amber-300 to-emerald-400 bg-clip-text text-transparent">Comparison</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-16">
          Framework JS loaded per page. NoopJS ships 0 KB for static and 464 B for interactive pages.
        </p>
        <div className="max-w-xl mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 text-left">
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">NoopJS (static)</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-emerald-400 w-[2%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">0 KB</span></div>
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">NoopJS (interactive)</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-amber-400 w-[3%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">464 B</span></div>
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">Qwik</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-purple-400 w-[5%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">~1 KB</span></div>
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">SolidJS</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-blue-500 w-[18%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">~7 KB</span></div>
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">Svelte</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-orange-500 w-[26%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">~10 KB</span></div>
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">Vue</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-emerald-500 w-[38%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">~16 KB</span></div>
          <div className="flex items-center gap-3 py-2 border-b border-gray-800/50"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">React</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-cyan-400 w-full" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">~45 KB</span></div>
          <div className="flex items-center gap-3 py-2"><span className="w-36 text-sm font-medium text-gray-200 flex-shrink-0">Angular</span><div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden"><div className="h-full rounded bg-red-500 w-[144%]" /></div><span className="w-14 text-right font-mono text-xs text-gray-400 flex-shrink-0">~65 KB</span></div>
        </div>
      </section>

      <section className="text-center px-6 py-24">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          Everything You Need,{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">Nothing You Don't</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-16">
          A modern DX with signals, SSR, SPA routing, and resumability — compiled away to minimal per-page JavaScript.
        </p>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
          <div className="p-7 bg-gray-900 border border-gray-800 rounded-2xl hover:border-amber-400/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-400/15 flex items-center justify-center text-lg mb-4">⚡</div>
            <h3 className="text-base font-bold mb-2">Blazing Fast</h3>
            <p className="text-sm text-gray-400 leading-relaxed">Ships 0 KB on static pages, 464 B on interactive. No hydration, no virtual DOM — just compiled JavaScript that runs instantly.</p>
          </div>
          <div className="p-7 bg-gray-900 border border-gray-800 rounded-2xl hover:border-emerald-400/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/15 flex items-center justify-center text-lg mb-4">♻️</div>
            <h3 className="text-base font-bold mb-2">True Resumability</h3>
            <p className="text-sm text-gray-400 leading-relaxed">SSR generates HTML with embedded signal state. The client resumes interactivity inline without re-running components or parsing a framework bundle.</p>
          </div>
          <div className="p-7 bg-gray-900 border border-gray-800 rounded-2xl hover:border-purple-400/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-purple-400/15 flex items-center justify-center text-lg mb-4">🔀</div>
            <h3 className="text-base font-bold mb-2">SPA Routing</h3>
            <p className="text-sm text-gray-400 leading-relaxed">Client-side navigation with sentinel-based mXSS protection. Full page transitions, history management, and scroll restoration out of the box.</p>
          </div>
        </div>
      </section>

      <section id="demo" className="text-center px-6 py-24 bg-gray-900/30">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
          See It{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">In Action</span>
        </h2>
        <p className="text-gray-400 text-lg mb-12 max-w-[480px] mx-auto">
          A fully interactive counter that ships 464 B gzipped — try it below.
        </p>
        <div className="max-w-sm mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="flex items-center gap-4 justify-center p-5 bg-amber-400/[0.06] rounded-xl border border-amber-400/15">
            <span className="font-mono text-2xl font-bold text-gray-100 min-w-[3rem] text-center">{count}</span>
            <button onClick={() => count.set(count.get() + 1)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm cursor-pointer border-none bg-amber-400 text-gray-950 hover:opacity-85 transition-opacity">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Increment
            </button>
            <span className="font-mono text-xs text-emerald-400">464 B</span>
          </div>
        </div>
      </section>

      </main>
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="#f59e0b"/><text x="16" y="22" textAnchor="middle" fill="#0f0f13" fontSize="20" fontWeight="900">Ø</text></svg>
            NoopJS — MIT
          </div>
          <div className="flex gap-5">
            <a href="https://github.com/noop-js/noopjs" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">GitHub</a>
            <a href="https://github.com/noop-js/noopjs/issues" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">Issues</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
