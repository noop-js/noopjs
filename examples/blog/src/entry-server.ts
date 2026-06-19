import { renderToString } from '@noopjs/server';
import type { ClientLevel } from '@noopjs/server';
import HomePage from './routes/index.noop';
import AboutPage from './routes/about.noop';
import BlogPost from './routes/blog/[slug].noop';
import FeedbackForm from './routes/form.noop';

interface PageEntry {
  component: (...args: any[]) => any;
  clientLevel: ClientLevel;
}

const pages: Record<string, PageEntry> = {
  'index': { component: () => HomePage(), clientLevel: (HomePage as any).clientLevel || 'spa' },
  'about': { component: () => AboutPage(), clientLevel: (AboutPage as any).clientLevel || 'spa' },
  'blog-post': { component: (params: Record<string, string>) => BlogPost({ slug: params.slug || '' }), clientLevel: (BlogPost as any).clientLevel || 'spa' },
  'form': { component: () => FeedbackForm(), clientLevel: (FeedbackForm as any).clientLevel || 'spa' },
};

export function render(routeName: string, params: Record<string, string>) {
  const entry = pages[routeName];
  if (!entry) throw new Error(`Unknown route: ${routeName}`);
  return renderToString(() => entry.component(params), {}, { clientLevel: entry.clientLevel });
}
