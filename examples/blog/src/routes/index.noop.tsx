import { posts } from '../data';

export const styles = {
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '16px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '18px',
  },
  cardDate: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  cardExcerpt: {
    color: '#475569',
    lineHeight: '1.6',
  },
  footer: {
    color: '#94a3b8',
    fontSize: '14px',
    textAlign: 'center',
  },
};

export default function Home() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'token.spacing.6', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <nav style={{ display: 'flex', gap: 'token.spacing.6', paddingTop: 'token.spacing.4', paddingBottom: 'token.spacing.4', borderBottom: '2px solid #e2e8f0', marginBottom: 'token.spacing.8' }}>
        <a href="/" className={styles.link}>Home</a>
        <a href="/about" className={styles.link}>About</a>
        <a href="/blog/hello-noop" className={styles.link}>Hello NoopJS</a>
        <a href="/blog/signals-explained" className={styles.link}>Signals</a>
      </nav>

      <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: 'token.spacing.2' }}>Noop Blog</h1>
      <p className={styles.subtitle} style={{ marginBottom: 'token.spacing.10' }}>A minimal blog built with NoopJS — zero-runtime SSR and signals.</p>

      <div style={{ padding: 'token.spacing.6', borderRadius: '12px', backgroundColor: '#f8fafc', marginBottom: 'token.spacing.4', border: '1px solid #e2e8f0' }}>
        <a href={`/blog/${posts[0].slug}`} style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: 'token.spacing.2', textDecoration: 'none', display: 'block' }}>{posts[0].title}</a>
        <div className={styles.cardDate} style={{ marginBottom: '12px' }}>{posts[0].date}</div>
        <p className={styles.cardExcerpt}>{posts[0].excerpt}</p>
      </div>

      <div style={{ padding: 'token.spacing.6', borderRadius: '12px', backgroundColor: '#f8fafc', marginBottom: 'token.spacing.4', border: '1px solid #e2e8f0' }}>
        <a href={`/blog/${posts[1].slug}`} style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: 'token.spacing.2', textDecoration: 'none', display: 'block' }}>{posts[1].title}</a>
        <div className={styles.cardDate} style={{ marginBottom: '12px' }}>{posts[1].date}</div>
        <p className={styles.cardExcerpt}>{posts[1].excerpt}</p>
      </div>

      <footer className={styles.footer} style={{ marginTop: '48px', paddingTop: 'token.spacing.6', paddingBottom: 'token.spacing.6', borderTop: '2px solid #e2e8f0' }}>Powered by NoopJS</footer>
    </div>
  );
}
