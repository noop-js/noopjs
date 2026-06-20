import { renderToString } from '@noopjs/server';
import type { ClientLevel } from '@noopjs/server';
import { fetchTopStories, fetchStory, fetchUser, searchStories } from './api';
import IndexPage from './routes/index.noop';
import AboutPage from './routes/about.noop';
import SearchPage from './routes/search.noop';
import NotFoundPage from './routes/not-found.noop';

export interface PageEntry {
  component: (...args: any[]) => any;
  props: Record<string, any>;
  clientLevel: ClientLevel;
  pageTitle?: string;
}

export async function render(routeName: string, params: Record<string, string>): Promise<PageEntry> {
  switch (routeName) {
    case 'index': {
      const data = await fetchTopStories(0);
      return {
        component: () => IndexPage({ stories: data.hits, page: data.page, nbPages: data.nbPages }),
        props: {},
        clientLevel: (IndexPage as any).clientLevel || 'spa',
        pageTitle: 'HN Noop',
      };
    }
    case 'item': {
      if (!params.id) throw new Error('Missing id param');
      const item = await fetchStory(params.id);
      const itemMod = await import('./routes/item.noop');
      return {
        component: () => itemMod.default({ item }),
        props: {},
        clientLevel: (itemMod.default as any).clientLevel || 'spa',
        pageTitle: `${item.title} — HN Noop`,
      };
    }
    case 'user': {
      if (!params.username) throw new Error('Missing username param');
      const user = await fetchUser(params.username);
      const userMod = await import('./routes/user.noop');
      return {
        component: () => userMod.default({ user }),
        props: {},
        clientLevel: (userMod.default as any).clientLevel || 'resume',
        pageTitle: `${user.id} — HN Noop`,
      };
    }
    case 'search': {
      const searchMod = await import('./routes/search.noop');
      return {
        component: () => searchMod.default({}),
        props: {},
        clientLevel: (searchMod.default as any).clientLevel || 'resume',
        pageTitle: 'Search — HN Noop',
      };
    }
    case 'about':
      return {
        component: () => AboutPage(),
        props: {},
        clientLevel: (AboutPage as any).clientLevel || 'none',
        pageTitle: 'About — HN Noop',
      };
    case 'not-found':
      return {
        component: () => NotFoundPage(),
        props: {},
        clientLevel: (NotFoundPage as any).clientLevel || 'none',
        pageTitle: '404 — HN Noop',
      };
    default:
      throw new Error(`Unknown route: ${routeName}`);
  }
}
