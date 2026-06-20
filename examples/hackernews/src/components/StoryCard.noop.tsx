export default function StoryCard(props: { story: { objectID: string; title: string; url: string | null; points: number; author: string; created_at: string; num_comments: number } }) {
  return <div class="story-card">
    <div class="story-title">
      <a href={props.story.url || '/item/' + props.story.objectID} target={props.story.url ? '_blank' : ''}>{props.story.title}</a>
    </div>
    <div class="story-meta">
      {String(props.story.points)} points by <a href={'/user/' + props.story.author}>{props.story.author}</a>
      {' | '}
      <a href={'/item/' + props.story.objectID}>{props.story.num_comments > 0 ? String(props.story.num_comments) + ' comments' : 'discuss'}</a>
    </div>
  </div>;
}
