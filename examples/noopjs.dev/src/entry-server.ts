import type { ClientLevel } from '@noopjs/server';
import HomePage from './routes/index.noop';
import BlogIndex from './routes/blog/index.noop';

export interface PageEntry {
  component: (...args: any[]) => any;
  props: Record<string, any>;
  clientLevel: ClientLevel;
  pageTitle?: string;
  pageDescription?: string;
}

export async function render(routeName: string, params: Record<string, string>): Promise<PageEntry> {
  switch (routeName) {
    case 'index':
      return {
        component: () => HomePage(),
        props: {},
        clientLevel: (HomePage as any).clientLevel || 'spa',
        pageTitle: 'NoopJS — The Zero-Runtime Framework',
        pageDescription:
          'NoopJS — A zero-runtime JavaScript framework. Ships 0 KB on static pages, 466 B on interactive. True resumability, no hydration.',
      };
    case 'blog-index':
      return {
        component: () => BlogIndex(),
        props: {},
        clientLevel: (BlogIndex as any).clientLevel || 'spa',
        pageTitle: 'Blog — NoopJS',
        pageDescription: 'Thoughts on zero-runtime architecture, signals, and the future of web frameworks.',
      };
    case 'blog-post': {
      const slug = params.slug;
      const { posts } = await import('./content/blog.js');
      const post = posts.find((p: any) => p.slug === slug);
      if (!post) {
        const NotFound = (await import('./routes/blog/[slug].noop')).default;
        return {
          component: () => NotFound({ slug }),
          props: {},
          clientLevel: (NotFound as any).clientLevel || 'none',
          pageTitle: 'Post not found — NoopJS',
          pageDescription: '',
        };
      }
      const BlogPost = (await import('./routes/blog/[slug].noop')).default;
      return {
        component: () => BlogPost({ slug }),
        props: {},
        clientLevel: (BlogPost as any).clientLevel || 'none',
        pageTitle: `${post.title} — NoopJS`,
        pageDescription: post.excerpt,
      };
    }
    default:
      throw new Error(`Unknown route: ${routeName}`);
  }
}
