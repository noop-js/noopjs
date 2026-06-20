export const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn on dangerouslySetInnerHTML with non-literal values. Static string values are safe; dynamic values may expose the application to XSS attacks.',
      recommended: true,
    },
    schema: [],
    messages: {
      dangerous:
        'Avoid dangerouslySetInnerHTML with dynamic values. Use a static literal or ensure the content is sanitized server-side.',
    },
  },
  create(context: any) {
    return {
      JSXAttribute(node: any) {
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'dangerouslySetInnerHTML'
        ) {
          const value = node.value;
          if (value && value.type === 'JSXExpressionContainer') {
            const expr = value.expression;
            if (
              expr.type === 'ObjectExpression' &&
              expr.properties.length === 1 &&
              expr.properties[0].type === 'Property' &&
              expr.properties[0].key.type === 'Identifier' &&
              expr.properties[0].key.name === '__html'
            ) {
              const htmlValue = expr.properties[0].value;
              const isLiteral = htmlValue.type === 'Literal' && typeof htmlValue.value === 'string';
              if (!isLiteral) {
                context.report({ node, messageId: 'dangerous' });
              }
            }
          }
        }
      },
    };
  },
};
