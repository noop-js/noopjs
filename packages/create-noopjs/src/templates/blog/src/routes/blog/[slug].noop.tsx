import { posts } from '../data';

const s = {
  container: { padding: '32px', fontFamily: 'sans-serif', maxWidth: '720px', margin: '0 auto' },
  nav: { marginBottom: '24px' },
  link: { color: '#4f46e5', textDecoration: 'none', marginRight: '16px' },
  date: { fontSize: '14px', color: '#999', marginTop: '8px' },
  body: { lineHeight: '1.8', color: '#333', marginTop: '24px' },
};

export default function BlogPost({ slug }: { slug: string }) {
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return (
      <div style={s.container}>
        <nav style={s.nav}>
          <a href="/" style={s.link}>Home</a>
        </nav>
        <h1>Post not found</h1>
        <p>The requested post was not found.</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <nav style={s.nav}>
        <a href="/" style={s.link}>Home</a>
        <a href="/about" style={s.link}>About</a>
      </nav>
      <h1>{post.title}</h1>
      <div style={s.date}>{post.date}</div>
      <div style={s.body}>{post.content}</div>
    </div>
  );
}
