import { renderToString } from '@noopjs/server';
import type { ClientLevel } from '@noopjs/server';
import { fetchTopStories, fetchStory, fetchUser, searchStories } from './api';
import IndexPage from './routes/index.noop';
import AboutPage from './routes/about.noop';
import SearchPage from './routes/search.noop';
import NotFoundPage from './routes/not-found.noop';

interface PageEntry {
  component: (...args: any[]) => any;
  clientLevel: ClientLevel;
  pageTitle?: string;
}

function createComponent(fn: (...args: any[]) => any, clientLevel: ClientLevel, pageTitle?: string): PageEntry {
  return { component: fn, clientLevel, pageTitle };
}

export async function render(routeName: string, params: Record<string, string>) {
  let entry: PageEntry;

  switch (routeName) {
    case 'index': {
      const data = await fetchTopStories(0);
      entry = createComponent(() => IndexPage({ stories: data.hits, page: data.page, nbPages: data.nbPages }), (IndexPage as any).clientLevel || 'spa', 'HN Noop');
      break;
    }
    case 'item': {
      if (!params.id) throw new Error('Missing id param');
      const item = await fetchStory(params.id);
      const itemMod = await import('./routes/item.noop');
      entry = createComponent(() => itemMod.default({ item }), (itemMod.default as any).clientLevel || 'spa', `${item.title} — HN Noop`);
      break;
    }
    case 'user': {
      if (!params.username) throw new Error('Missing username param');
      const user = await fetchUser(params.username);
      const userMod = await import('./routes/user.noop');
      entry = createComponent(() => userMod.default({ user }), (userMod.default as any).clientLevel || 'resume', `${user.id} — HN Noop`);
      break;
    }
    case 'search': {
      const searchMod = await import('./routes/search.noop');
      entry = createComponent(() => searchMod.default({}), (searchMod.default as any).clientLevel || 'resume', 'Search — HN Noop');
      break;
    }
    case 'about':
      entry = createComponent(() => AboutPage(), (AboutPage as any).clientLevel || 'none', 'About — HN Noop');
      break;
    case 'not-found':
      entry = createComponent(() => NotFoundPage(), (NotFoundPage as any).clientLevel || 'none', '404 — HN Noop');
      break;
    default:
      throw new Error(`Unknown route: ${routeName}`);
  }

  const result = await renderToString(entry.component, {}, { clientLevel: entry.clientLevel });
  return {
    ...result,
    state: { ...result.state, pageTitle: entry.pageTitle },
  };
}
