// client: spa
import { Form, useField } from '@noopjs/forms';
import { signal } from '@noopjs/signals';
import ThemeToggle from '../components/ThemeToggle.noop';

function RenderResults(props: { results: any }) {
  if (!props.results || !props.results.hits || props.results.hits.length === 0) {
    return document.createComment('');
  }
  var frag = document.createDocumentFragment();
  for (var i = 0; i < props.results.hits.length; i++) {
    var s = props.results.hits[i];
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

export default function SearchPage() {
  const query = useField('');
  const results = signal({ hits: [], nbPages: 0, page: 0, query: '' });
  const loading = signal(false);

  function doSearch() {
    if (!query.value.get()) return;
    loading.set(true);
    fetch('https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent(query.value.get()) + '&page=0').then(function(r) { return r.json(); }).then(function(r) { results.set(r); loading.set(false); }).catch(function() { loading.set(false); });
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
      <div style="margin-bottom:16px">
        <Form onSubmit={doSearch}>
          <input
            {...query.props}
            onInput={function(e: Event) { query.value.set((e.target as HTMLInputElement).value); }}
            placeholder="Search Hacker News..."
            style="width:100%;max-width:600px;padding:8px;font-size:14px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)"
          />
          <button
            style="margin-left:8px;padding:8px 16px;font-size:14px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer"
          >Search</button>
        </Form>
      </div>
      <div>Search results for: {query.value.get()}</div>
      <div>Results count: {String(results.get().hits ? results.get().hits.length : 0)}</div>
      {loading.get() ? <div style="color:var(--text-muted);font-size:12px;padding:8px 0">Searching...</div> : null}
      <div>
        <RenderResults results={results.get()} />
      </div>
    </div>
  </div>;
}
