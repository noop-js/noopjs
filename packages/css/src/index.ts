import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

interface StyleRule {
  className: string;
  property: string;
  value: string;
}

export interface ExtractResult {
  css: string;
  transformedSource: string;
  styleNames: Record<string, string>; // e.g. { "container": "_a3f8b2 _c9e12a" }
}

/**
 * Extract styles from component source and generate atomic CSS.
 *
 * Convention:
 *   export const styles = {
 *     container: { color: 'red', fontSize: '16px' }
 *   };
 *
 * Becomes:
 *   ._aXXXX { color: red; }
 *   ._aYYYY { font-size: 16px; }
 *
 * And JSX: `className={styles.container}` → `className="_aXXXX _aYYYY"`
 */
export function extractStyles(source: string): ExtractResult {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const ruleMap = new Map<string, StyleRule>();
  const styleNames: Record<string, string> = {};

  // Find export const styles = { ... }
  traverse(ast, {
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (!t.isVariableDeclaration(decl)) return;

      for (const declarator of decl.declarations) {
        if (
          t.isIdentifier(declarator.id) &&
          declarator.id.name === 'styles' &&
          declarator.init &&
          t.isObjectExpression(declarator.init)
        ) {
          for (const prop of declarator.init.properties) {
            if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

            const styleName: string = prop.key.name;
            if (!t.isObjectExpression(prop.value)) continue;

            const classes: string[] = [];
            for (const rule of prop.value.properties) {
              if (!t.isObjectProperty(rule) || !t.isIdentifier(rule.key)) continue;

              const cssProp = camelToKebab(rule.key.name);
              let cssValue: string;

              if (t.isStringLiteral(rule.value)) {
                cssValue = rule.value.value;
              } else if (t.isNumericLiteral(rule.value)) {
                cssValue = rule.value.value + (isNaN(Number(rule.value.value)) ? '' : 'px');
              } else {
                cssValue = generate(rule.value).code;
              }

              const className = generateClassName(cssProp, cssValue);
              classes.push(className);

              if (!ruleMap.has(className)) {
                ruleMap.set(className, { className, property: cssProp, value: cssValue });
              }
            }

            styleNames[styleName] = classes.join(' ');
          }

          // Remove the styles export from the output
          // (CSS is extracted, so runtime doesn't need it)
          path.remove();
        }
      }
    },

    // Replace className={styles.name} with generated class names
    JSXExpressionContainer(path) {
      const expr = path.node.expression;
      if (
        t.isMemberExpression(expr) &&
        t.isIdentifier(expr.object) &&
        expr.object.name === 'styles' &&
        t.isIdentifier(expr.property)
      ) {
        const name = expr.property.name;
        if (styleNames[name]) {
          path.replaceWith(t.stringLiteral(styleNames[name]));
        }
      }
    },
  });

  // Generate CSS
  let css = '';
  for (const [, rule] of ruleMap) {
    css += `.${rule.className} { ${rule.property}: ${rule.value}; }\n`;
  }

  const transformedSource = generate(ast).code;

  return { css, transformedSource, styleNames };
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function generateClassName(prop: string, value: string): string {
  const hash = simpleHash(prop + ':' + value);
  return `_a${hash}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}
