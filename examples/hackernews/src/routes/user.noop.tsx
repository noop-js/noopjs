// client: resume
import ThemeToggle from '../components/ThemeToggle.noop';

export default function UserPage(props: { user: any }) {
  var u = props.user;
  var userName = u.id || u.username || 'unknown';
  var created = u.created_at ? u.created_at.slice(0, 10) : 'unknown';
  return <div>
    <div style="background:var(--bg-secondary);padding:4px 8px;display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--accent)">
      <a href="/" style="font-weight:bold;color:var(--text);font-size:14px;text-decoration:none">
        <span style="color:var(--accent)">HN</span> Noop
      </a>
      <a href="/" style="font-size:12px;color:var(--text-muted)">new</a>
      <a href="/search" style="font-size:12px;color:var(--text-muted)">search</a>
      <a href="/about" style="font-size:12px;color:var(--text-muted)">about</a>
      <ThemeToggle />
    </div>
    <div style="padding:12px">
      <h1 style="font-size:18px;margin:0 0 8px 0">{userName}</h1>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
        karma: {u.karma != null ? String(u.karma) : '0'} | joined: {created}
      </div>
      {u.about ? <div class="comment-body" style="margin-bottom:12px;font-size:12px">{u.about}</div> : null}
      <div style="font-size:12px;color:var(--text-muted)">
        {u.submission_count != null ? String(u.submission_count) : '0'} submissions | {u.comment_count != null ? String(u.comment_count) : '0'} comments
      </div>
    </div>
  </div>;
}
