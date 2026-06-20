// client: none
export default function NotFoundPage() {
  return <div>
    <div style="background:var(--bg-secondary);padding:4px 8px;display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--accent)">
      <a href="/" style="font-weight:bold;color:var(--text);font-size:14px;text-decoration:none">
        <span style="color:var(--accent)">HN</span> Noop
      </a>
      <a href="/" style="font-size:12px;color:var(--text-muted)">new</a>
      <a href="/search" style="font-size:12px;color:var(--text-muted)">search</a>
      <a href="/about" style="font-size:12px;color:var(--text-muted)">about</a>
    </div>
    <div style="padding:48px;text-align:center">
      <h1 style="font-size:48px;margin:0;color:var(--accent)">404</h1>
      <p style="font-size:16px;color:var(--text-muted);margin-top:8px">Page not found</p>
      <a href="/" style="color:var(--accent);font-size:14px">« back to front page</a>
    </div>
  </div>;
}
