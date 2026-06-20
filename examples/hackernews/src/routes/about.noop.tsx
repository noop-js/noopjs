// client: none
export default function AboutPage() {
  return <div>
    <div style="background:var(--bg-secondary);padding:4px 8px;display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--accent)">
      <a href="/" style="font-weight:bold;color:var(--text);font-size:14px;text-decoration:none">
        <span style="color:var(--accent)">HN</span> Noop
      </a>
      <a href="/" style="font-size:12px;color:var(--text-muted)">new</a>
      <a href="/search" style="font-size:12px;color:var(--text-muted)">search</a>
      <a href="/about" style="font-size:12px;color:var(--text-muted)">about</a>
    </div>
    <div style="padding:24px;max-width:600px;margin:0 auto">
      <h1 style="font-size:24px;margin-bottom:16px">About HN Noop</h1>
      <div style="font-size:13px;line-height:1.7;color:var(--text)">
        <p style="margin-bottom:12px">A Hacker News clone built with NoopJS — a zero-runtime resumable web framework.</p>
        <p style="margin-bottom:12px">The front page ships 317 B of JS, the search page ships 466 B, and this about page ships 0 KB of JavaScript.</p>
        <p style="margin-bottom:12px">User-generated HTML comments are rendered server-side and navigated via a sentinel-based SPA router that is provably mXSS-safe.</p>
        <p style="margin-bottom:12px">Built with the four capability levels: <strong>spa</strong> (front page + item), <strong>resume</strong> (search + user), and <strong>none</strong> (about + 404).</p>
        <p><a href="/" style="color:var(--accent)">« back to front page</a></p>
      </div>
    </div>
  </div>;
}
