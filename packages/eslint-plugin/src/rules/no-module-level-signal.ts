export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow signal() calls outside component functions',
      recommended: true,
    },
    schema: [],
    messages: {
      moduleLevel:
        'Do not call signal() at module level. Signal() must be called inside a component function (the default export). Module-level signals lose their state between renders and are not tracked by the SSR compiler.',
    },
  },
  create(context: any) {
    let functionDepth = 0;

    function enterFunction() { functionDepth++; }
    function exitFunction() { functionDepth--; }

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      'FunctionDeclaration:exit': exitFunction,
      'FunctionExpression:exit': exitFunction,
      'ArrowFunctionExpression:exit': exitFunction,

      CallExpression(node: any) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'signal' &&
          functionDepth === 0
        ) {
          context.report({
            node,
            messageId: 'moduleLevel',
          });
        }
      },
    };
  },
};
