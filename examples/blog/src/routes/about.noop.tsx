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
  },
  footer: {
    color: '#94a3b8',
    fontSize: '14px',
    textAlign: 'center',
  },
};

export default function About() {
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: 'token.spacing.6', fontFamily: 'system-ui, sans-serif', color: '#1a1a2e' }}>
      <nav style={{ display: 'flex', gap: 'token.spacing.6', paddingTop: 'token.spacing.4', paddingBottom: 'token.spacing.4', borderBottom: '2px solid #e2e8f0', marginBottom: 'token.spacing.8' }}>
        <a href="/" className={styles.link}>Home</a>
        <a href="/about" className={styles.link}>About</a>
        <a href="/blog/hello-noop" className={styles.link}>Hello Aether</a>
        <a href="/blog/signals-explained" className={styles.link}>Signals</a>
      </nav>

      <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: 'token.spacing.4' }}>About This Blog</h1>
      <div className={styles.body}>
        <p>This blog is built with Aether, a zero-runtime framework for reactive web applications.</p>
        <p>Every page is server-side rendered, then resumed on the client with fine-grained signal bindings. Navigation uses the View Transitions API for smooth page transitions.</p>
        <p>The source for this example is available alongside the Aether framework packages.</p>
      </div>
      <footer className={styles.footer} style={{ marginTop: '48px', paddingTop: 'token.spacing.6', paddingBottom: 'token.spacing.6', borderTop: '2px solid #e2e8f0' }}>Powered by Aether</footer>
    </div>
  );
}
