export const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow dynamic DOM operations in client: resume components. Resume components cannot create or remove DOM nodes dynamically after SSR.',
      recommended: true,
    },
    schema: [],
    messages: {
      mapInResume:
        'Unexpected .map() in a client: resume component. Resume components have a fixed DOM structure — use client: spa if you need dynamic lists.',
      conditionalInResume:
        'Unexpected conditional JSX in a client: resume component. Resume components have a fixed DOM structure — use client: spa if you need conditional rendering.',
    },
  },
  create(context: any) {
    const sourceText = context.sourceCode.getText();
    const directive = getClientDirective(sourceText);
    if (directive !== 'resume') return {};

    let inJSXExpression = false;

    return {
      JSXExpressionContainer() {
        inJSXExpression = true;
      },
      'JSXExpressionContainer:exit'() {
        inJSXExpression = false;
      },

      CallExpression(node: any) {
        if (
          inJSXExpression &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'map'
        ) {
          context.report({ node, messageId: 'mapInResume' });
        }
      },

      ConditionalExpression(node: any) {
        if (inJSXExpression) {
          const hasJSX =
            (node.consequent.type === 'JSXElement' ||
              node.consequent.type === 'JSXFragment' ||
              node.alternate.type === 'JSXElement' ||
              node.alternate.type === 'JSXFragment');
          if (hasJSX) {
            context.report({ node, messageId: 'conditionalInResume' });
          }
        }
      },

      LogicalExpression(node: any) {
        if (inJSXExpression) {
          const hasJSX =
            node.right.type === 'JSXElement' ||
            node.right.type === 'JSXFragment';
          if (hasJSX) {
            context.report({ node, messageId: 'conditionalInResume' });
          }
        }
      },
    };
  },
};

function getClientDirective(sourceText: string): string | null {
  const match = sourceText.match(/\/\/\s*client:\s*(none|resume|spa|full)\b/);
  return match ? match[1] : null;
}
