// client: spa
import { signal } from '@noopjs/signals';
import { posts, type BlogPost } from '../../content/blog.js';

export default function BlogIndex() {
  const search = signal('');

  const filtered = () => {
    const q = search.get().toLowerCase();
    if (!q) return posts;
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q)
    );
  };

  return (
    <div className="bg-gray-950 text-gray-100 font-sans antialiased min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/75 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold">
            <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="#f59e0b"/><text x="16" y="22" textAnchor="middle" fill="#0f0f13" fontSize="20" fontWeight="900">Ø</text></svg>
            <span>NoopJS</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors">Home</a>
            <a href="/blog" className="text-amber-400 text-sm font-medium">Blog</a>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-24">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">Blog</span>
        </h1>
        <p className="text-gray-400 text-lg mb-10">Thoughts on zero-runtime architecture, signals, and the future of web frameworks.</p>
        <div className="space-y-6">
          {filtered().map((p: BlogPost) => (
            <a key={p.slug} href={'/blog/' + p.slug} className="block p-6 bg-gray-900 border border-gray-800 rounded-2xl hover:border-amber-400/40 transition-all group">
              <div className="text-xs text-gray-500 mb-2">{p.date}</div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-amber-400 transition-colors">{p.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{p.excerpt}</p>
            </a>
          ))}
        </div>
      </main>
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            NoopJS — MIT
          </div>
          <div className="flex gap-5">
            <a href="https://github.com/noop-js/noopjs" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">GitHub</a>
            <a href="/" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">Home</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
