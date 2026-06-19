export type ClientLevel = 'none' | 'resume' | 'spa' | 'full';

export interface NodeManifestEntry {
  tag: string;
  attrs: string[];
}

export interface BindingDescriptor {
  nodeId: string;
  type: 'text' | 'attribute';
  attributeName?: string;
  signalRef: string;
  parentNodeId?: string;
  childIndex?: number;
  /** Parts of the parent's text content, with '{0}' placeholders for signal values.
   *  Only set when parent has mixed static+dynamic content (childIndex >= 1).
   *  Bootstrap uses this to reconstruct full text via string concatenation,
   *  avoiding the SSR text-node merging issue. */
  textParts?: string[];
}

export interface HandlerMeta {
  eventType: string;
  componentId: string;
  handlerIndex: number;
}

export interface SerializedState {
  signals: Record<string, any>;
  bindings: BindingDescriptor[];
  handlers: Record<string, HandlerMeta>;
  rootId: string;
  contextValues?: Record<string, any>;
  nodeManifest?: Record<number, NodeManifestEntry>;
  clientLevel?: ClientLevel;
}
