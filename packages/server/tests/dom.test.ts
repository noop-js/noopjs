import { describe, it, expect } from 'vitest';
import { ServerDocument, ServerElement, ServerTextNode } from '../src/dom';

describe('ServerDocument shim', () => {
  it('creates elements and serializes to HTML', () => {
    const doc = new ServerDocument();
    const div = doc.createElement('div');
    div.className = 'container';
    const txt = doc.createTextNode('hello');
    div.appendChild(txt);
    doc.body.appendChild(div);

    const html = doc.toHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div class="container">');
    expect(html).toContain('hello');
    expect(html).toContain('</div>');
  });

  it('handles nested elements', () => {
    const doc = new ServerDocument();
    const div = doc.createElement('div');
    const span = doc.createElement('span');
    span.appendChild(doc.createTextNode('nested'));
    div.appendChild(span);
    doc.body.appendChild(div);

    const html = doc.toHTML();
    expect(html).toContain('<div><span>nested</span></div>');
  });

  it('handles void elements', () => {
    const doc = new ServerDocument();
    const input = doc.createElement('input');
    input.setAttribute('type', 'text');
    doc.body.appendChild(input);

    const html = doc.toHTML();
    expect(html).toContain('<input type="text">');
  });

  it('handles attributes', () => {
    const doc = new ServerDocument();
    const div = doc.createElement('div');
    div.setAttribute('data-x', '10');
    div.setAttribute('aria-label', 'test');
    doc.body.appendChild(div);

    const html = doc.toHTML();
    expect(html).toContain('data-x="10"');
    expect(html).toContain('aria-label="test"');
  });

  it('escapes attribute values', () => {
    const doc = new ServerDocument();
    const div = doc.createElement('div');
    div.setAttribute('title', 'a & "b"');
    doc.body.appendChild(div);

    const html = doc.toHTML();
    expect(html).toContain('a &amp; &quot;b&quot;');
  });

  it('handles fragments', () => {
    const doc = new ServerDocument();
    const frag = doc.createDocumentFragment();
    const a = doc.createElement('span');
    a.appendChild(doc.createTextNode('a'));
    const b = doc.createElement('span');
    b.appendChild(doc.createTextNode('b'));
    frag.appendChild(a);
    frag.appendChild(b);
    doc.body.appendChild(frag);

    const html = doc.toHTML();
    expect(html).toContain('<span>a</span><span>b</span>');
  });
});
