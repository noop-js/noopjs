// client: none
import { posts } from '../../content/blog.js';

export default function BlogPost(props: { slug: string }) {
  const post = posts.find(p => p.slug === props.slug);
  if (!post) {
    return (
      <div className="bg-gray-950 text-gray-100 font-sans antialiased min-h-screen">
        <nav className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/75 border-b border-gray-800">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 text-lg font-bold">
              <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="#f59e0b"/><text x="16" y="22" textAnchor="middle" fill="#0f0f13" fontSize="20" fontWeight="900">Ø</text></svg>
              <span>NoopJS</span>
            </a>
            <a href="/" className="text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors">Home</a>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-6 pt-20 pb-24">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Post not found</h1>
          <a href="/blog" className="text-amber-400 hover:text-amber-300">&larr; Back to blog</a>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-gray-100 font-sans antialiased min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/75 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold">
            <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="#f59e0b"/><text x="16" y="22" textAnchor="middle" fill="#0f0f13" fontSize="20" fontWeight="900">Ø</text></svg>
            <span>NoopJS</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/blog" className="text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors">Blog</a>
            <a href="/" className="text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors">Home</a>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-24">
        <div className="text-xs text-gray-500 mb-4">{post.date}</div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-8">{post.title}</h1>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-4 text-lg" dangerouslySetInnerHTML={{ __html: post.content }} />
        <div className="mt-12 pt-8 border-t border-gray-800">
          <a href="/blog" className="text-amber-400 hover:text-amber-300 text-sm font-medium">&larr; Back to blog</a>
        </div>
      </main>
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">NoopJS — MIT</div>
          <div className="flex gap-5">
            <a href="https://github.com/noop-js/noopjs" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">GitHub</a>
            <a href="/" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">Home</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
