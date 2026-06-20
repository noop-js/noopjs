import { renderToString } from '@noopjs/server';
import type { ClientLevel } from '@noopjs/server';
import HomePage from './routes/index.noop';

interface PageEntry {
  component: (...args: any[]) => any;
  clientLevel: ClientLevel;
}

const pages: Record<string, PageEntry> = {
  'index': { component: () => HomePage(), clientLevel: (HomePage as any).clientLevel || 'spa' },
};

export function render(routeName: string, _params: Record<string, string>) {
  const entry = pages[routeName];
  if (!entry) throw new Error(`Unknown route: ${routeName}`);
  return renderToString(() => entry.component(_params), {}, { clientLevel: entry.clientLevel });
}
