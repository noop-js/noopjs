const s = {
  container: { padding: '32px', fontFamily: 'sans-serif', maxWidth: '720px', margin: '0 auto' },
  nav: { marginBottom: '24px' },
  link: { color: '#4f46e5', textDecoration: 'none', marginRight: '16px' },
};

export default function About() {
  return (
    <div style={s.container}>
      <nav style={s.nav}>
        <a href="/" style={s.link}>Home</a>
        <a href="/about" style={s.link}>About</a>
      </nav>
      <h1>About This Blog</h1>
      <p>This blog is built with NoopJS, a zero-runtime framework for reactive web applications.</p>
      <p>Every page is server-side rendered, then resumed on the client with fine-grained signal bindings.</p>
    </div>
  );
}
