export { ServerDocument, ServerElement, ServerTextNode, type StreamWriter } from './dom.js';
export {
  renderToString,
  renderToStream,
  extractPrefetchLinks,
  prefetchLinkTags,
  generatePageBootstrap,
} from './render.js';

export type { RenderResult, ClientLevel } from './render.js';

export {
  createSSRContext,
  enterSSR,
  exitSSR,
  getSerializedState,
  getPerformanceMetrics,
} from './context.js';
export type { SSRContext, SerializedState, BindingRecord, HandlerRecord } from './context.js';
export { createNodeHandler, createExpressMiddleware } from './adapters.js';
