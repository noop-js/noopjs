import { renderToString } from '@noopjs/server';
import HomePage from './routes/index.noop';
import AboutPage from './routes/about.noop';
import BlogPost from './routes/blog/[slug].noop';

const pages: Record<string, (params: Record<string, string>) => any> = {
  'index': () => HomePage(),
  'about': () => AboutPage(),
  'blog-post': (params) => BlogPost({ slug: params.slug || '' }),
};

export function render(routeName: string, params: Record<string, string>) {
  const pageFn = pages[routeName];
  if (!pageFn) throw new Error(`Unknown route: ${routeName}`);
  return renderToString(() => pageFn(params));
}
