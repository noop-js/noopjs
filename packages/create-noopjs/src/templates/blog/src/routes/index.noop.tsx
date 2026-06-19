import { posts } from '../data';

const s = {
  container: { padding: '32px', fontFamily: 'sans-serif', maxWidth: '720px', margin: '0 auto' },
  nav: { marginBottom: '24px' },
  link: { color: '#4f46e5', textDecoration: 'none', marginRight: '16px' },
  title: { fontSize: '32px', fontWeight: 'bold' },
  subtitle: { color: '#666', marginBottom: '32px' },
  card: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '16px' },
  cardTitle: { fontSize: '20px', fontWeight: 'bold', color: '#4f46e5', textDecoration: 'none' },
  cardDate: { fontSize: '14px', color: '#999', marginTop: '4px' },
  cardExcerpt: { color: '#555', marginTop: '8px' },
  footer: { marginTop: '48px', color: '#999', fontSize: '14px', textAlign: 'center' },
};

export default function Home() {
  return (
    <div style={s.container}>
      <nav style={s.nav}>
        <a href="/" style={s.link}>Home</a>
        <a href="/about" style={s.link}>About</a>
      </nav>
      <h1 style={s.title}>Noop Blog</h1>
      <p style={s.subtitle}>A minimal blog built with Aether — zero-runtime SSR and signals.</p>
      {posts.map(post => (
        <div style={s.card}>
          <a href={`/blog/${post.slug}`} style={s.cardTitle}>{post.title}</a>
          <div style={s.cardDate}>{post.date}</div>
          <p style={s.cardExcerpt}>{post.excerpt}</p>
        </div>
      ))}
      <footer style={s.footer}>Powered by Aether</footer>
    </div>
  );
}
