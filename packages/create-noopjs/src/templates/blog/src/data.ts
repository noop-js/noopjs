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
    content: `NoopJS is a new kind of framework that compiles JSX to direct DOM operations with no virtual DOM overhead. It uses signals for fine-grained reactivity and supports full SSR with client resumption.`,
  },
  {
    slug: 'signals-explained',
    title: 'NoopJS Signals Explained',
    date: '2026-02-01',
    excerpt: 'Understanding signals, computed values, and effects — the core primitives of NoopJS reactivity.',
    content: `Signals are the fundamental building block of reactivity in NoopJS. A signal is a container for a value that notifies subscribers when the value changes. Computed signals derive values from other signals, and effects run side effects when signals change.`,
  },
];
