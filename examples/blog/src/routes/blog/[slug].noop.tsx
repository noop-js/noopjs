import { posts } from '../../data';

export const styles = {
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '16px',
  },
  body: {
    lineHeight: '1.8',
    fontSize: '17px',
    color: '#334155',
    whiteSpace: 'pre-line',
  },
  footer: {
    color: '#94a3b8',
    fontSize: '14px',
    textAlign: 'center',
  },
};

export default function BlogPost({ slug }: { slug: string }) {
  const post = posts.find(p => p.slug === slug);
  const title = post ? post.title : 'Post not found';
  const date = post ? post.date : '';
  const content = post ? post.content : 'The requested post was not found.';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: 'token.spacing.6', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <nav style={{ display: 'flex', gap: 'token.spacing.6', paddingTop: 'token.spacing.4', paddingBottom: 'token.spacing.4', borderBottom: '2px solid #e2e8f0', marginBottom: 'token.spacing.8' }}>
        <a href="/" className={styles.link}>Home</a>
        <a href="/about" className={styles.link}>About</a>
        <a href="/blog/hello-noop" className={styles.link}>Hello Aether</a>
        <a href="/blog/signals-explained" className={styles.link}>Signals</a>
      </nav>

      <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: 'token.spacing.2' }}>{title}</h1>
      <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: 'token.spacing.6' }}>{date}</div>
      <div className={styles.body}>{content}</div>

      <footer className={styles.footer} style={{ marginTop: '48px', paddingTop: 'token.spacing.6', paddingBottom: 'token.spacing.6', borderTop: '2px solid #e2e8f0' }}>Powered by Aether</footer>
    </div>
  );
}
