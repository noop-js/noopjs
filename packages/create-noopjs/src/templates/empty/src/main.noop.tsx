import { signal } from '@noopjs/signals';

const count = signal(0);

export default function App() {
  return (
    <div>
      <h1>Hello Aether!</h1>
      <p>Count: {count}</p>
      <button onClick={() => count.set(count.get() + 1)}>+</button>
    </div>
  );
}
