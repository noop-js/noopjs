// client: spa
import Pagination from '../components/Pagination.noop';
import ThemeToggle from '../components/ThemeToggle.noop';

function StoryList(props: { stories: any[] }) {
  var frag = document.createDocumentFragment();
  for (var i = 0; i < props.stories.length; i++) {
    var s = props.stories[i];
    var el = document.createElement('div');
    el.className = 'story-card';
    var titleDiv = document.createElement('div');
    titleDiv.className = 'story-title';
    var link = document.createElement('a');
    link.setAttribute('href', s.url || '/item/' + s.objectID);
    if (s.url) link.setAttribute('target', '_blank');
    link.appendChild(document.createTextNode(s.title));
    titleDiv.appendChild(link);
    el.appendChild(titleDiv);
    var meta = document.createElement('div');
    meta.className = 'story-meta';
    meta.innerHTML = String(s.points) + ' points by <a href="/user/' + s.author + '">' + s.author + '</a> | <a href="/item/' + s.objectID + '">' + (s.num_comments > 0 ? String(s.num_comments) + ' comments' : 'discuss') + '</a>';
    el.appendChild(meta);
    frag.appendChild(el);
  }
  return frag;
}

export default function IndexPage(props: { stories: any[]; page: number; nbPages: number }) {
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
    <div style="padding:8px">
      {props.stories.length > 0 ? <StoryList stories={props.stories} /> : <div style="padding:12px;color:var(--text-muted)">Loading stories...</div>}
    </div>
    <Pagination current={props.page} total={props.nbPages} base="/" />
  </div>;
}
