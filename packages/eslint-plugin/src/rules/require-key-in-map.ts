export const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require key prop when rendering lists with .map() in JSX. Without a key, NoopJS falls back to unkeyed reconciliation which can cause unnecessary DOM churn.',
      recommended: true,
    },
    schema: [],
    messages: {
      missingKey:
        'Missing key prop on JSX element inside .map(). Add a unique key prop for efficient list reconciliation.',
    },
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'map' ||
          node.arguments.length === 0
        ) {
          return;
        }

        const callback = node.arguments[0];
        const body =
          callback.type === 'ArrowFunctionExpression'
            ? callback.body
            : callback.type === 'FunctionExpression'
              ? callback.body
              : null;
        if (!body) return;

        let jsxElement: any = null;
        if (body.type === 'JSXElement') {
          jsxElement = body;
        } else if (body.type === 'BlockStatement') {
          const returnStmt = body.body.find(
            (s: any) => s.type === 'ReturnStatement' && s.argument,
          );
          if (returnStmt && returnStmt.argument.type === 'JSXElement') {
            jsxElement = returnStmt.argument;
          }
        }
        if (!jsxElement) return;

        const hasKey = jsxElement.openingElement.attributes.some(
          (attr: any) =>
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'key',
        );
        if (!hasKey) {
          context.report({ node: jsxElement, messageId: 'missingKey' });
        }
      },
    };
  },
};
