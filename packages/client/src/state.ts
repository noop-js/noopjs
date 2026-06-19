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
