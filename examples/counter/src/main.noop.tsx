import { signal } from '@noopjs/signals';

export const styles = {
  container: {
    padding: '32px',
    fontFamily: 'sans-serif',
    maxWidth: '400px',
    margin: '0 auto',
  },
  count: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  button: {
    padding: '8px 16px',
    fontSize: '18px',
    cursor: 'pointer',
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
  },
};

export default function Counter() {
  const count = signal(0);

  return (
    <div className={styles.container}>
      <h1>Noop Counter</h1>
      <p className={styles.count}>Count: {count}</p>
      <button className={styles.button} onClick={() => count.set(count.get() + 1)}>
        Increment
      </button>
    </div>
  );
}
