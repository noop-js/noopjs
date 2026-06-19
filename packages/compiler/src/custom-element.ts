/**
 * Generate a Custom Element wrapper for an Aether component.
 *
 * Input: compiled component code (returns a DOM Node).
 * Output: component code + custom element class + registration.
 */
export function generateCustomElement(
  componentCode: string,
  tagName: string,
  componentFn: string,
): string {
  return `
${componentCode}

if (!customElements.get('${tagName}')) {
  customElements.define('${tagName}', class extends HTMLElement {
    static observedAttributes = [];

    connectedCallback() {
      const shadow = this.attachShadow({ mode: 'open' });
      const root = ${componentFn}({}, 'ce_root');
      shadow.appendChild(root);
    }

    disconnectedCallback() {
      // Cleanup effects if needed
    }
  });
}
`;
}
