import { signal } from '@noopjs/signals';

export default function App() {
  const count = signal(0);

  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto' }}>
      <h1>NoopJS App</h1>
      <p style={{ fontSize: '24px', fontWeight: 'bold' }}>Count: {count}</p>
      <button
        style={{ padding: '8px 16px', fontSize: '18px', cursor: 'pointer' }}
        onClick={() => count.set(count.get() + 1)}
      >
        Increment
      </button>
    </div>
  );
}
