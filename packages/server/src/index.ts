export { ServerDocument, ServerElement, ServerTextNode } from './dom';
export {
  renderToString,
  renderToStream,
  extractPrefetchLinks,
  prefetchLinkTags,
} from './render';

export type { RenderResult } from './render';

export {
  createSSRContext,
  enterSSR,
  exitSSR,
  getSerializedState,
  getPerformanceMetrics,
} from './context';
export type { SSRContext, SerializedState, BindingRecord, HandlerRecord } from './context';
export { createNodeHandler, createExpressMiddleware } from './adapters';
