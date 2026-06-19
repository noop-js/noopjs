export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
}

export const posts: Post[] = [
  {
    slug: 'hello-noop',
    title: 'Hello, Noop!',
    date: '2026-01-15',
    excerpt: 'Introducing NoopJS — a zero-runtime framework for building reactive web apps with signals and SSR.',
    content: `NoopJS is a new kind of framework. Instead of shipping a heavy runtime to the browser, NoopJS compiles your components at build time into vanilla JavaScript that creates DOM nodes directly.

Signals provide fine-grained reactivity — when a signal changes, only the specific DOM nodes that depend on it are updated. No virtual DOM, no diffing, no overhead.

With server-side rendering, NoopJS generates HTML on the server, serializes the signal state, and resumes it on the client with zero additional work from you.`,
  },
  {
    slug: 'signals-explained',
    title: 'Aether Signals Explained',
    date: '2026-02-01',
    excerpt: 'Understanding signals, computed values, and effects — the core primitives of NoopJS reactivity.',
    content: `Signals are the fundamental building block of reactivity in NoopJS.

A signal is a value that can change over time. When you read a signal inside an effect or a computed, the system automatically tracks which signals you accessed. When any of those signals change, the effect re-runs or the computed recalculates.

This automatic dependency tracking means you never need to declare dependencies manually. The system figures it out.`,
  },
];
