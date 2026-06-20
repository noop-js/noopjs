// client: spa
import ThemeToggle from '../components/ThemeToggle.noop';
import Comment from '../components/Comment.noop';

export default function ItemPage(props: { item: any }) {
  var item = props.item;
  var hostname = '';
  if (item.url) {
    try { hostname = new URL(item.url).hostname; } catch(e) {}
  }

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
      <div style="margin-bottom:4px">
        {item.url ? <a href={item.url} style="font-size:16px;font-weight:bold;color:var(--text-link)">{item.title}</a> : <span style="font-size:16px;font-weight:bold">{item.title}</span>}
        {hostname ? <span style="font-size:12px;color:var(--text-muted);margin-left:6px">({hostname})</span> : null}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
        {item.points > 0 ? String(item.points) + ' points' : ''} by <a href={'/user/' + item.author}>{item.author}</a>
      </div>
      {item.text ? <div class="comment-body" style="margin-bottom:16px;font-size:13px">{item.text}</div> : null}
      <div style="font-size:13px;font-weight:bold;margin-bottom:8px;color:var(--text-muted)">Comments</div>
      {item.children && item.children.length > 0
        ? <Comment comment={item} />
        : <div style="color:var(--text-muted);font-size:12px">No comments yet</div>}
    </div>
  </div>;
}
