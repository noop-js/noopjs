/**
 * Minimal server-side DOM shim for NoopJS SSR.
 * Implements just enough of the DOM API for compiled NoopJS components.
 */

export interface NodeManifestEntry {
  tag: string;
  attrs: string[];
}

export interface SentinelHost {
  allocateSentinelId(tag: string): number;
  recordNodeAttribute(sentinelId: number, attr: string): void;
}

export class ServerTextNode {
  nodeType = 3;
  nodeName = '#text';
  _value: string;
  parentNode: ServerElement | null = null;
  _noopNodeId: string | null = null;

  constructor(text: string) {
    this._value = text;
  }

  get nodeValue(): string {
    return this._value;
  }

  set nodeValue(v: string) {
    this._value = v;
  }

  toHTML(): string {
    return escapeHtml(this._value);
  }
}

export class ServerComment {
  nodeType = 8;
  nodeName = '#comment';
  _value: string;
  parentNode: ServerElement | null = null;
  _noopNodeId: string | null = null;

  constructor(text: string) {
    this._value = text;
  }

  toHTML(): string {
    return `<!--${this._value}-->`;
  }
}

export class ServerElement {
  nodeType = 1;
  tagName: string;
  attributes: Map<string, string> = new Map();
  children: any[] = [];
  parentNode: any = null;
  _noopNodeId: string | null = null;
  _isFragment: boolean = false;
  className: string = '';
  innerHTML: string = '';
  _sentinelId: number = -1;
  _sentinelActive: boolean = false;
  _sentinelHost: SentinelHost | null = null;

  get childNodes(): (ServerElement | ServerTextNode)[] {
    return this.children;
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    if (name === 'class' || name === 'className') {
      this.className = value;
    }
    this.attributes.set(name, value);
    if (this._sentinelActive && this._sentinelId >= 0 && this._sentinelHost) {
      this._sentinelHost.recordNodeAttribute(this._sentinelId, name);
    }
  }

  getAttribute(name: string): string | null {
    if ((name === 'class' || name === 'className') && this.className) {
      return this.className;
    }
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  appendChild(child: ServerElement | ServerTextNode | ServerComment): void {
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(child: ServerElement | ServerTextNode | ServerComment, ref: ServerElement | ServerTextNode | ServerComment | null): void {
    if (!ref) {
      this.appendChild(child);
      return;
    }
    const idx = this.children.indexOf(ref);
    if (idx >= 0) {
      child.parentNode = this;
      this.children.splice(idx, 0, child);
    }
  }

  replaceChild(newChild: ServerElement | ServerTextNode | ServerComment, oldChild: ServerElement | ServerTextNode | ServerComment): void {
    const idx = this.children.indexOf(oldChild);
    if (idx >= 0) {
      oldChild.parentNode = null;
      newChild.parentNode = this;
      this.children.splice(idx, 1, newChild);
    }
  }

  removeChild(child: ServerElement | ServerTextNode | ServerComment): void {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      child.parentNode = null;
      this.children.splice(idx, 1);
    }
  }

  toHTML(): string {
    if (this._isFragment) return this._innerHTML();

    const tag = this.tagName.toLowerCase();

    if (tag === 'html') {
      return `<!DOCTYPE html>\n<html${this._attrs()}>${this._innerHTML()}</html>`;
    }

    if (isVoidElement(tag)) {
      return `<${tag}${this._attrs()}>`;
    }

    return `<${tag}${this._attrs()}>${this._innerHTML()}</${tag}>`;
  }

  private _attrs(): string {
    const parts: string[] = [];
    if (this.className) {
      parts.push(` class="${escapeAttr(this.className)}"`);
    }
    for (const [key, val] of this.attributes) {
      parts.push(` ${key}="${escapeAttr(val)}"`);
    }
    if (this._sentinelId >= 0) {
      parts.push(` data-n="${this._sentinelId}"`);
    }
    return parts.join('');
  }

  private _innerHTML(): string {
    if (this.innerHTML) return this.innerHTML;

    // For <select>, set selected on the matching <option> based on the value attribute
    if (this.tagName === 'SELECT' && this.attributes.has('value')) {
      const selectValue = this.attributes.get('value')!;
      for (const child of this.children) {
        if (child instanceof ServerElement && child.tagName === 'OPTION') {
          child.attributes.delete('selected');
          if (child.attributes.get('value') === selectValue) {
            child.attributes.set('selected', '');
          }
        }
      }
    }

    return this.children.map(c => c.toHTML()).join('');
  }
}

export class ServerDocument {
  body: ServerElement;
  head: ServerElement;
  private _root: ServerElement;
  _sentinelHost: SentinelHost | null = null;

  constructor() {
    this._root = new ServerElement('html');
    this.body = new ServerElement('body');
    this.head = new ServerElement('head');
    this._root.appendChild(this.head);
    this._root.appendChild(this.body);
  }

  createElement(tagName: string): ServerElement {
    const el = new ServerElement(tagName);
    if (this._sentinelHost) {
      el._sentinelId = this._sentinelHost.allocateSentinelId(tagName);
      el._sentinelActive = true;
      el._sentinelHost = this._sentinelHost;
    }
    return el;
  }

  createTextNode(text: string): ServerTextNode {
    return new ServerTextNode(text);
  }

  createDocumentFragment(): ServerElement {
    const frag = new ServerElement('fragment');
    frag._isFragment = true;
    return frag;
  }

  createComment(text: string): ServerComment {
    return new ServerComment(text);
  }

  get documentElement(): ServerElement {
    return this._root;
  }

  toHTML(): string {
    return this._root.toHTML();
  }

  querySelector(_sel: string): ServerElement | null {
    return null;
  }

  getElementById(_id: string): ServerElement | null {
    return null;
  }
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function isVoidElement(tag: string): boolean {
  return VOID_ELEMENTS.has(tag);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
