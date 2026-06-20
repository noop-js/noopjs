import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { SourceMapGenerator } from 'source-map-js';

export interface CompileOptions {
  filename?: string;
  extractHandlers?: boolean;
  /** Set to true to generate a source map */
  sourceMaps?: boolean;
  /** Token resolvers that map CSS property+value pairs to class names */
  tokenResolvers?: TokenResolver[];
}

export interface TokenResolver {
  name: string;
  /** Given a CSS property (kebab-case) and a string value, return a class name or null */
  resolve(prop: string, value: string): string | null;
}

export interface HandlerDescriptor {
  id: string;
  eventType: string;
  code: string;
  /** If true, handler is a module-level export for code splitting */
  extracted: boolean;
}

export type ClientLevel = 'none' | 'resume' | 'spa' | 'full';

export interface CompileResult {
  code: string;
  map?: any;
  bindings: BindingDescriptor[];
  componentId: string;
  customElementTag?: string;
  handlers?: HandlerDescriptor[];
  css?: string;
  clientLevel?: ClientLevel;
}

export interface BindingDescriptor {
  nodeId: string;
  type: 'text' | 'attribute';
  attributeName?: string;
  signalRef: string;
}

let compId = 0;
let varId = 0;
let handlerId = 0;
let bindings: BindingDescriptor[] = [];
let handlers: HandlerDescriptor[] = [];
let importedRuntimeFns: Set<string>;
let signalVars: Set<string>;
let compName: string;
let compIdStr: string;
let currentCompId: string;
let customElementTag: string | null = null;
let clientLevel: ClientLevel | null = null;
let extractHandlersMode = false;
let origParams: string | null = null;
let sourceMapGen: SourceMapGenerator | null = null;
let sourceMapFileName = '';
let outputLineCount = 0;
let collectedCSS: Map<string, string>;
let tokenResolvers: TokenResolver[];

function reset(): void {
  compId = 0;
  varId = 0;
  handlerId = 0;
  bindings = [];
  handlers = [];
  importedRuntimeFns = new Set();
  signalVars = new Set();
  compName = '';
  compIdStr = '';
  currentCompId = '';
  customElementTag = null;
  clientLevel = null;
  extractHandlersMode = false;
  origParams = null;
  sourceMapGen = null;
  sourceMapFileName = '';
  outputLineCount = 0;
  collectedCSS = new Map();
  tokenResolvers = [];
}

function v(prefix: string): string {
  return `_${prefix}_${varId++}`;
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  reset();
  if (options.extractHandlers) extractHandlersMode = true;
  if (options.tokenResolvers) tokenResolvers = options.tokenResolvers;

  const sourceMaps = options.sourceMaps ?? false;
  if (sourceMaps) {
    sourceMapGen = new SourceMapGenerator({ file: options.filename || 'unknown.noop.tsx' });
    sourceMapFileName = options.filename || 'unknown.noop.tsx';
  }

  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
    sourceLocations: sourceMaps,
  } as any);

  // Detect @noopjs customElement directive
  const directiveMatch = source.match(/@noopjs\s+customElement\s+['"]([^'"]+)['"]/);
  if (directiveMatch) {
    customElementTag = directiveMatch[1];
  }

  // Detect // client: directive
  const clientLevelMatch = source.match(/\/\/\s*client:\s*(none|resume|spa|full)\b/);
  if (clientLevelMatch) {
    clientLevel = clientLevelMatch[1] as ClientLevel;
  }

  // First pass: collect info
  traverse(ast, {
    ImportDeclaration(path) {
      const src = path.node.source.value;
      if (src === '@noopjs/signals') {
        for (const spec of path.node.specifiers) {
          if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported) && spec.imported.name === 'signal') {
            // signal import is kept; other framework imports removed
          }
        }
      }
    },
    VariableDeclarator(path) {
      if (
        t.isIdentifier(path.node.id) &&
        path.node.init &&
        t.isCallExpression(path.node.init) &&
        t.isIdentifier(path.node.init.callee) &&
        path.node.init.callee.name === 'signal'
      ) {
        signalVars.add(path.node.id.name);
      }
    },
    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      if (t.isFunctionDeclaration(decl) && decl.id) {
        compName = decl.id.name;
      } else if (t.isFunctionExpression(decl)) {
        compName = 'defaultExport';
      }
    },
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (t.isFunctionDeclaration(decl) && decl.id && !compName) {
        compName = decl.id.name;
      }
    },
  });

  if (!compName) {
    return { code: source, bindings: [], componentId: 'c0' };
  }

  compIdStr = 'c' + (compId++);

  // Second pass: generate transformed code
  // Find the component function body
  let body: t.BlockStatement | null = null;
  let isAsync = false;

  // Collect non-default function declarations (helper components)
  const helperFns: string[] = [];

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (t.isFunctionDeclaration(decl) && decl.id) {
        const fnName = decl.id.name;
        if (fnName !== compName) {
          const innerFns: string[] = [];
          processHelperFn(decl, fnName, innerFns);
          if (innerFns.length > 0) {
            helperFns.push(`export ${innerFns[0]}`);
          }
        }
      }
    },
    FunctionDeclaration(path) {
      // Module-level function declarations — skip if inside a named export
      // (handled by ExportNamedDeclaration) or if nested inside another function
      if (!path.node.id || path.getFunctionParent()) return;
      if (path.findParent(p => t.isExportNamedDeclaration(p.node))) return;
      const fnName = path.node.id.name;
      if (fnName !== compName) {
        processHelperFn(path.node, fnName, helperFns);
      }
    },
  });

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      if (t.isFunctionDeclaration(decl) && decl.body) {
        body = decl.body;
        isAsync = !!decl.async;
        if (decl.params.length > 0) {
          origParams = decl.params.map(p => generate(p).code).join(', ');
        }
      } else if (t.isFunctionExpression(decl) && decl.body) {
        body = t.isBlockStatement(decl.body) ? decl.body : null;
        isAsync = !!decl.async;
        if (decl.params.length > 0) {
          origParams = decl.params.map(p => generate(p).code).join(', ');
        }
      }
    },
  });

  if (!body) {
    return { code: source, bindings: [], componentId: compIdStr };
  }

  // Collect user imports (keep runtime imports; compiler adds missing ones)
  const userImports: string[] = [];
  traverse(ast, {
    ImportDeclaration(path) {
      userImports.push(generate(path.node).code);
    },
  });

  // Process function body first (this populates importedRuntimeFns)
  currentCompId = compIdStr;
  const bodyStmts: string[] = [];
  for (const stmt of (body as any).body) {
    const result = processStatement(stmt, 1);
    if (result) bodyStmts.push(result);
  }

  // Build the output
  const out: string[] = [];
  for (const ui of userImports) out.push(ui);
  if (userImports.length > 0) out.push('');

  // Add runtime imports (now correctly populated from body processing)
  if (importedRuntimeFns.size > 0) {
    out.push(`import { ${[...importedRuntimeFns].join(', ')} } from '@noopjs/runtime';`);
  }

  out.push('');

  // Emit helper functions (non-default function declarations)
  if (helperFns.length > 0) {
    for (const hf of helperFns) out.push(hf);
    out.push('');
  }

  // Generate the component function
  const funcHead = isAsync ? 'async ' : '';
  const funcName = compName;
  // Always emit (props, __noopId). If original params exist (e.g. destructuring),
  // use them as the first parameter instead of 'props'.
  let firstParam = origParams && origParams !== 'props' ? origParams : 'props';
  // Remove __noopId from original params if present (compiler adds it)
  firstParam = firstParam.replace(/,?\s*__noopId\s*,?\s*/g, '').replace(/,\s*$/, '').trim() || 'props';
  out.push(`export default ${funcHead}function ${funcName}(${firstParam}, __noopId) {`);
  out.push(`  __noopId = __noopId || '${compIdStr}';`);
  out.push(`  const __compId = __noopId;`);
  for (const stmt of bodyStmts) out.push(stmt);
  out.push('}');

  // Attach clientLevel as static property if directive was found
  if (clientLevel) {
    out.push(`${funcName}.clientLevel = '${clientLevel}';`);
  }

  let code = out.join('\n');

  // If custom element directive was found, wrap with CE registration
  if (customElementTag) {
    const compFnName = compName || 'defaultExport';
    code = `${code}

if (!customElements.get('${customElementTag}')) {
  customElements.define('${customElementTag}', class extends HTMLElement {
    connectedCallback() {
      const root = ${compFnName}({}, 'ce_${compIdStr}');
      this.appendChild(root);
    }
  });
}`;
  }

  // Build source map
  let map: any = undefined;
  if (sourceMaps) {
    // Map each output line to the original source using a heuristic:
    // find the first JSX element in the original source at or before the
    // approximate equivalent line
    const sourceLines = source.split('\n');
    const outputLines = code.split('\n');
    const jsxLines: number[] = [];

    // Collect all JSX opening element line numbers from source
    for (let i = 0; i < sourceLines.length; i++) {
      if (/<\w/.test(sourceLines[i]) && !sourceLines[i].includes('//') && !sourceLines[i].includes('import')) {
        jsxLines.push(i + 1);
      }
    }

    // For each output line, find the most likely original line
    // Lines that don't start with indentation or are boilerplate map to line 1
    for (let i = 0; i < outputLines.length; i++) {
      const line = outputLines[i];
      let origLine = 1;

      // Try to find matching content in original source
      for (let j = 0; j < sourceLines.length; j++) {
        const srcLine = sourceLines[j];
        // Check for matching patterns
        if (
          (line.includes('document.createElement') && srcLine.includes('<')) ||
          (line.includes('createTextNode') && (srcLine.includes('>') || srcLine.includes('{'))) ||
          (line.includes('function ') && srcLine.includes('function')) ||
          (line.includes('__noopId') && srcLine.includes('__noopId')) ||
          (line.includes('import ') && srcLine.includes('import'))
        ) {
          origLine = j + 1;
          break;
        }
      }

      // Fallback: map to nearest JSX line
      if (origLine === 1 && jsxLines.length > 0) {
        // Find last JSX line <= current output line ratio
        const ratio = i / outputLines.length;
        const srcIdx = Math.floor(ratio * sourceLines.length);
        const sorted = jsxLines.filter(l => l <= srcIdx + 1);
        origLine = sorted.length > 0 ? sorted[sorted.length - 1] : 1;
      }

      sourceMapGen!.addMapping({
        generated: { line: i + 1, column: 0 },
        original: { line: origLine, column: 0 },
        source: sourceMapFileName,
      });
    }

    map = sourceMapGen!.toJSON();
  }

  let css: string | undefined;
  if (collectedCSS.size > 0) {
    const parts: string[] = [];
    for (const [, rule] of collectedCSS) {
      parts.push(rule);
    }
    css = parts.join('\n');
  }

  return {
    code,
    map,
    bindings,
    componentId: compIdStr,
    customElementTag: customElementTag || undefined,
    handlers: handlers.length > 0 ? handlers : undefined,
    css,
    clientLevel: clientLevel || undefined,
  };
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function addLineTracked(lines: string[], code: string, sourceLine?: number): void {
  lines.push(code);
  if (sourceLine !== undefined && sourceMapGen) {
    sourceMapGen.addMapping({
      generated: { line: outputLineCount + 1, column: 0 },
      original: { line: sourceLine, column: 0 },
      source: sourceMapFileName,
    });
  }
  outputLineCount++;
}

function processStatement(stmt: t.Statement, depth: number): string {
  // Variable declarations (including signal calls)
  if (t.isVariableDeclaration(stmt)) {
    const parts: string[] = [];
    for (const decl of stmt.declarations) {
      const varName = t.isIdentifier(decl.id) ? decl.id.name : generate(decl.id).code;
      if (decl.init && t.isCallExpression(decl.init) && t.isIdentifier(decl.init.callee) && decl.init.callee.name === 'signal') {
        // Replace signal(init) with __noopCreateSignal(init, 'name', compId)
        importedRuntimeFns.add('__noopCreateSignal');
        const initArg = decl.init.arguments[0] ? generate(decl.init.arguments[0]).code : 'undefined';
        parts.push(`${varName} = __noopCreateSignal(${initArg}, '${varName}', __compId)`);
      } else if (decl.init) {
        const initCode = generate(decl.init).code;
        parts.push(`${varName} = ${initCode}`);
      } else {
        parts.push(varName);
      }
    }
    const kind = stmt.kind;
    return `${indent(depth)}${kind} ${parts.join(', ')};`;
  }

  // Return statement (may contain JSX)
  if (t.isReturnStatement(stmt)) {
    if (stmt.argument) {
      return processReturnExpr(stmt.argument, depth);
    }
    return `${indent(depth)}return;`;
  }

  // Expression statement
  if (t.isExpressionStatement(stmt)) {
    const code = generate(stmt).code;
    return `${indent(depth)}${code}`;
  }

  // If statement (may contain JSX in branches)
  if (t.isIfStatement(stmt)) {
    const testCode = generate(stmt.test).code;
    const lines: string[] = [];
    lines.push(`${indent(depth)}if (${testCode}) {`);

    if (t.isBlockStatement(stmt.consequent)) {
      for (const s of stmt.consequent.body) {
        const processed = processStatement(s, depth + 1);
        if (processed) lines.push(processed);
      }
    } else if (t.isReturnStatement(stmt.consequent)) {
      lines.push(processReturnExpr(stmt.consequent.argument!, depth + 1));
    } else if (t.isExpressionStatement(stmt.consequent)) {
      lines.push(`${indent(depth + 1)}${generate(stmt.consequent).code};`);
    } else {
      lines.push(`${indent(depth + 1)}${generate(stmt.consequent).code};`);
    }

    if (stmt.alternate) {
      lines.push(`${indent(depth)}} else {`);
      if (t.isBlockStatement(stmt.alternate)) {
        for (const s of stmt.alternate.body) {
          const processed = processStatement(s, depth + 1);
          if (processed) lines.push(processed);
        }
      } else if (t.isIfStatement(stmt.alternate)) {
        lines.push(processStatement(stmt.alternate, depth + 1));
      } else if (t.isReturnStatement(stmt.alternate)) {
        lines.push(processReturnExpr(stmt.alternate.argument!, depth + 1));
      } else {
        lines.push(`${indent(depth + 1)}${generate(stmt.alternate).code};`);
      }
    }

    lines.push(`${indent(depth)}}`);
    return lines.join('\n');
  }

  // Other statements (preserve as-is)
  const code = generate(stmt).code;
  if (code.trim()) {
    return `${indent(depth)}${code}`;
  }
  return '';
}

function processReturnExpr(expr: t.Expression, depth: number): string {
  if (t.isJSXElement(expr)) {
    const result = genJSXElement(expr, depth);
    return `${result.code}\n${indent(depth)}return ${result.var};`;
  }
  if (t.isJSXFragment(expr)) {
    const result = genJSXFragment(expr, depth);
    return `${result.code}\n${indent(depth)}return ${result.var};`;
  }
  return `${indent(depth)}return ${generate(expr).code};`;
}

interface GenResult {
  code: string;
  var: string;
}

function getJSXTagName(el: t.JSXOpeningElement): string {
  const tag = el.name;
  if (t.isJSXIdentifier(tag)) return tag.name;
  if (t.isJSXMemberExpression(tag)) {
    // e.g. Theme.Provider → generate full qualified name
    const object = t.isJSXIdentifier(tag.object) ? tag.object.name : '';
    const property = t.isJSXIdentifier(tag.property) ? tag.property.name : '';
    return `${object}.${property}`;
  }
  return '';
}

function normalizeJSXText(value: string, children: t.JSXElement['children'], childIndex: number): string | null {
  const collapsed = value.replace(/\s+/g, ' ');
  const trimmed = collapsed.trim();
  if (trimmed) {
    let text = trimmed;
    const origStartsNewline = /^[\n\r]/.test(value);
    const origEndsNewline = /[\n\r]$/.test(value);
    if (!origStartsNewline && collapsed.startsWith(' ')) text = ' ' + text;
    if (!origEndsNewline && collapsed.endsWith(' ')) text = text + ' ';
    return text;
  }
  if (collapsed) {
    const prevIsNonText = childIndex > 0 && !t.isJSXText(children[childIndex - 1]);
    const nextIsNonText = childIndex < children.length - 1 && !t.isJSXText(children[childIndex + 1]);
    if (prevIsNonText && nextIsNonText) return ' ';
  }
  return null;
}

function genJSXElement(el: t.JSXElement, depth: number): GenResult {
  const tagName = getJSXTagName(el.openingElement);

  // Component (uppercase first letter, or has dot like Theme.Provider)
  if (tagName && (tagName[0] === tagName[0].toUpperCase() || tagName.includes('.'))) {
    return genComponent(el, tagName, depth);
  }

  // DOM element
  return genDomElement(el, tagName, depth);
}

function genDomElement(el: t.JSXElement, tagName: string, depth: number): GenResult {
  const ev = v('el');
  const lines: string[] = [];

  lines.push(`${indent(depth)}const ${ev} = document.createElement('${tagName}');`);

  // Attributes
  for (const attr of el.openingElement.attributes) {
    if (t.isJSXAttribute(attr)) {
      const attrName = t.isJSXIdentifier(attr.name) ? attr.name.name : '';
      if (attrName === 'key') continue;
      if (attrName === 'class' || attrName === 'className') {
        if (!attr.value) {
          // noop
        } else if (t.isStringLiteral(attr.value)) {
          lines.push(`${indent(depth)}${ev}.className = ${JSON.stringify(attr.value.value)};`);
        } else if (t.isJSXExpressionContainer(attr.value)) {
          genDynamicAttr(ev, attrName, attr.value.expression as t.Expression, depth, lines);
        }
      } else if (attrName.startsWith('on') && attrName.length > 2) {
        const eventType = attrName[2].toLowerCase() + attrName.slice(3);
        if (attr.value && t.isJSXExpressionContainer(attr.value)) {
          genEventHandler(ev, eventType, attr.value.expression as t.Expression, depth, lines);
        }
      } else if (attrName === 'dangerouslySetInnerHTML' && attr.value && t.isJSXExpressionContainer(attr.value)) {
        // dangerouslySetInnerHTML={{ __html: '<b>raw</b>' }}
        // We generate: el.innerHTML = <expr>.__html
        lines.push(`${indent(depth)}${ev}.innerHTML = ${generate(attr.value.expression)}.__html;`);
      } else if (attrName === 'style' && attr.value && t.isJSXExpressionContainer(attr.value)) {
        if (t.isObjectExpression(attr.value.expression) && isFullyStaticObject(attr.value.expression)) {
          // Static style object → try token resolution, then fall back to NoopCSS
          const { tokenClasses, cssRules } = resolveStyleObject(attr.value.expression);
          const allClasses: string[] = [];

          if (tokenClasses.length > 0) {
            allClasses.push(...tokenClasses);
          }

          if (cssRules.length > 0) {
            const cssText = cssRules.join('; ');
            const className = styleHash(cssText);
            const rule = `.${className} { ${cssText}; }`;
            if (!collectedCSS.has(className)) {
              collectedCSS.set(className, rule);
            }
            allClasses.push(className);
          }

          if (allClasses.length > 0) {
            const classStr = allClasses.join(' ');
            lines.push(`${indent(depth)}${ev}.className = ${ev}.className ? ${ev}.className + ' ${classStr}' : '${classStr}';`);
          }
        } else if (t.isObjectExpression(attr.value.expression)) {
          // Dynamic style object with expressions → inline setAttribute
          const css = genStyleObject(attr.value.expression);
          lines.push(`${indent(depth)}${ev}.setAttribute('style', '${css}');`);
        } else {
          // Signal-driven or dynamic style expression
          importedRuntimeFns.add('bindStyle');
          const styleExpr = attr.value.expression as t.Expression;
          const code = generate(styleExpr).code;
          const sigs = findSignalNames(styleExpr);
          if (sigs.length > 0) {
            const fullRef = `${currentCompId}.${sigs[0]}`;
            lines.push(`${indent(depth)}bindStyle(${ev}, () => ${code}, '${fullRef}');`);
          } else {
            lines.push(`${indent(depth)}bindStyle(${ev}, () => ${code});`);
          }
        }
      } else {
        if (!attr.value) {
          if (isBooleanAttr(attrName)) {
            lines.push(`${indent(depth)}${ev}.${attrName} = true;`);
          } else {
            lines.push(`${indent(depth)}${ev}.setAttribute('${attrName}', '');`);
          }
        } else if (t.isStringLiteral(attr.value)) {
          if (isBooleanAttr(attrName)) {
            lines.push(`${indent(depth)}${ev}.${attrName} = ${JSON.stringify(attr.value.value)};`);
          } else {
            lines.push(`${indent(depth)}${ev}.setAttribute('${attrName}', ${JSON.stringify(attr.value.value)});`);
          }
        } else if (t.isJSXExpressionContainer(attr.value)) {
          genDynamicAttr(ev, attrName, attr.value.expression as t.Expression, depth, lines);
        }
      }
    }
  }

  // Spread attributes
  const spreadAttrs = el.openingElement.attributes.filter(a => t.isJSXSpreadAttribute(a));
  for (const spread of spreadAttrs) {
    const objCode = generate((spread as t.JSXSpreadAttribute).argument).code;
    lines.push(`${indent(depth)}for (const _k in ${objCode}) {`);
    lines.push(`${indent(depth + 1)}if (_k === 'className' || _k === 'class') ${ev}.className = ${objCode}[_k];`);
    lines.push(`${indent(depth + 1)}else ${ev}.setAttribute(_k, ${objCode}[_k]);`);
    lines.push(`${indent(depth)}}`);
  }

  // Children
  for (let ci = 0; ci < el.children.length; ci++) {
    const child = el.children[ci];
    if (t.isJSXText(child)) {
      const text = normalizeJSXText(child.value, el.children, ci);
      if (text) {
        const tv = v('txt');
        lines.push(`${indent(depth)}const ${tv} = document.createTextNode(${JSON.stringify(text)});`);
        lines.push(`${indent(depth)}${ev}.appendChild(${tv});`);
      }
    } else if (t.isJSXElement(child)) {
      const result = genJSXElement(child, depth);
      lines.push(result.code);
      lines.push(`${indent(depth)}${ev}.appendChild(${result.var});`);
    } else if (t.isJSXExpressionContainer(child)) {
      genDynamicText(ev, child.expression as t.Expression, depth, lines);
    } else if (t.isJSXFragment(child)) {
      const result = genJSXFragment(child, depth);
      lines.push(result.code);
      lines.push(`${indent(depth)}${ev}.appendChild(${result.var});`);
    }
  }

  return { code: lines.join('\n'), var: ev };
}

function genJSXFragment(frag: t.JSXFragment, depth: number): GenResult {
  const fv = v('frag');
  const lines: string[] = [];

  lines.push(`${indent(depth)}const ${fv} = document.createDocumentFragment();`);

  for (let ci = 0; ci < frag.children.length; ci++) {
    const child = frag.children[ci];
    if (t.isJSXText(child)) {
      const text = normalizeJSXText(child.value, frag.children, ci);
      if (text) {
        const tv = v('txt');
        lines.push(`${indent(depth)}const ${tv} = document.createTextNode(${JSON.stringify(text)});`);
        lines.push(`${indent(depth)}${fv}.appendChild(${tv});`);
      }
    } else if (t.isJSXElement(child)) {
      const result = genJSXElement(child, depth);
      lines.push(result.code);
      lines.push(`${indent(depth)}${fv}.appendChild(${result.var});`);
    } else if (t.isJSXExpressionContainer(child)) {
      genDynamicText(fv, child.expression as t.Expression, depth, lines);
    } else if (t.isJSXFragment(child)) {
      const result = genJSXFragment(child, depth);
      lines.push(result.code);
      lines.push(`${indent(depth)}${fv}.appendChild(${result.var});`);
    }
  }

  return { code: lines.join('\n'), var: fv };
}

function genComponent(el: t.JSXElement, tagName: string, depth: number): GenResult {
  const cv = v('child');
  const childCompId = 'c' + (compId++);
  const lines: string[] = [];

  const explicitProps: string[] = [`__noopId: '${childCompId}'`];
  const spreadArgs: string[] = [];
  let hasSpread = false;

  for (const attr of el.openingElement.attributes) {
    if (t.isJSXAttribute(attr)) {
      const attrName = t.isJSXIdentifier(attr.name) ? attr.name.name : '';
      if (!attr.value) {
        explicitProps.push(`${attrName}: true`);
      } else if (t.isStringLiteral(attr.value)) {
        explicitProps.push(`${attrName}: ${JSON.stringify(attr.value.value)}`);
      } else if (t.isJSXExpressionContainer(attr.value)) {
        if (t.isJSXElement(attr.value.expression) || t.isJSXFragment(attr.value.expression)) {
          const result = t.isJSXElement(attr.value.expression)
            ? genJSXElement(attr.value.expression, depth + 1)
            : genJSXFragment(attr.value.expression, depth + 1);
          explicitProps.push(`${attrName}: (() => { ${result.code}; return ${result.var}; })()`);
        } else {
          explicitProps.push(`${attrName}: ${generate(attr.value.expression).code}`);
        }
      }
    } else if (t.isJSXSpreadAttribute(attr)) {
      hasSpread = true;
      spreadArgs.push(generate(attr.argument).code);
    }
  }

  // Determine if children should be lazy (needed for ErrorBoundary, Context.Provider)
  const isLazyChildren = tagName === 'ErrorBoundary' || tagName === 'Suspense' || tagName.endsWith('.Provider');

  // Children (lazy for ErrorBoundary and Context.Provider)
  const childrenResult = genChildrenExpr(el.children, depth + 1);
  if (childrenResult !== null) {
    if (isLazyChildren) {
      if (childrenResult.preCode) {
        const tv = v('thunk');
        lines.push(`${indent(depth)}const ${tv} = () => {`);
        lines.push(childrenResult.preCode);
        lines.push(`${indent(depth + 1)}return ${childrenResult.expression};`);
        lines.push(`${indent(depth)}};`);
        explicitProps.push(`children: ${tv}`);
      } else {
        explicitProps.push(`children: () => ${childrenResult.expression}`);
      }
    } else {
      if (childrenResult.preCode) {
        lines.push(childrenResult.preCode);
      }
      explicitProps.push(`children: ${childrenResult.expression}`);
    }
  }

  if (hasSpread) {
    const explicitObj = `{ ${explicitProps.join(', ')} }`;
    const merged = `Object.assign(${explicitObj}, ${spreadArgs.join(', ')})`;
    lines.push(`${indent(depth)}const ${cv} = ${tagName}(${merged});`);
  } else {
    lines.push(`${indent(depth)}const ${cv} = ${tagName}({ ${explicitProps.join(', ')} });`);
  }

  return { code: lines.join('\n'), var: cv };
}

interface ChildrenResult {
  preCode: string | null;
  expression: string;
}

function genChildrenExpr(children: t.JSXElement['children'], depth: number): ChildrenResult | null {
  const nonEmpty = children.filter((c, i) => !(t.isJSXText(c) && !normalizeJSXText(c.value, children, i)));
  if (nonEmpty.length === 0) return null;

  // Single child
  if (nonEmpty.length === 1) {
    const c = nonEmpty[0];
    if (t.isJSXText(c)) {
      const text = normalizeJSXText(c.value, children, children.indexOf(c)) || '';
      return { preCode: null, expression: JSON.stringify(text) };
    }
    if (t.isJSXExpressionContainer(c)) {
      return { preCode: null, expression: generate(c.expression).code };
    }
    if (t.isJSXElement(c)) {
      const result = genJSXElement(c, depth);
      return { preCode: result.code, expression: result.var };
    }
    if (t.isJSXFragment(c)) {
      const result = genJSXFragment(c, depth);
      return { preCode: result.code, expression: result.var };
    }
  }

  // Multiple children — create fragment
  const fv = v('cfrag');
  const preLines: string[] = [];
  preLines.push(`${indent(depth)}const ${fv} = document.createDocumentFragment();`);
  for (const c of nonEmpty) {
    if (t.isJSXText(c)) {
      const text = normalizeJSXText(c.value, children, children.indexOf(c));
      if (text) {
        const tv = v('txt');
        preLines.push(`${indent(depth)}const ${tv} = document.createTextNode(${JSON.stringify(text)});`);
        preLines.push(`${indent(depth)}${fv}.appendChild(${tv});`);
      }
    } else if (t.isJSXExpressionContainer(c)) {
      const code = generate(c.expression).code;
      const tv = v('txt');
      preLines.push(`${indent(depth)}const ${tv} = document.createTextNode('');`);
      preLines.push(`${indent(depth)}${fv}.appendChild(${tv});`);
      preLines.push(`${indent(depth)}${tv}.nodeValue = ${code};`);
    } else if (t.isJSXElement(c)) {
      const result = genJSXElement(c, depth);
      preLines.push(result.code);
      preLines.push(`${indent(depth)}${fv}.appendChild(${result.var});`);
    } else if (t.isJSXFragment(c)) {
      const result = genJSXFragment(c, depth);
      preLines.push(result.code);
      preLines.push(`${indent(depth)}${fv}.appendChild(${result.var});`);
    }
  }
  return { preCode: preLines.join('\n'), expression: fv };
}

function genDynamicAttr(
  ev: string, attrName: string, expr: t.Expression, depth: number, lines: string[],
): void {
  const isClass = attrName === 'className' || attrName === 'class';
  const isBool = isBooleanAttr(attrName);
  const sigRef = extractSignalRef(expr);
  if (sigRef) {
    importedRuntimeFns.add('bindAttribute');
    const fullRef = `${currentCompId}.${sigRef}`;
    lines.push(`${indent(depth)}bindAttribute(${ev}, '${attrName}', () => ${sigRef}.get(), '${fullRef}');`);
    bindings.push({ nodeId: '', type: 'attribute', attributeName: attrName, signalRef: fullRef });
  } else {
    const code = generate(expr).code;
    const sigs = findSignalNames(expr);
    if (sigs.length > 0) {
      importedRuntimeFns.add('bindAttribute');
      const fullRef = `${currentCompId}.${sigs[0]}`;
      lines.push(`${indent(depth)}bindAttribute(${ev}, '${attrName}', () => ${code}, '${fullRef}');`);
    } else {
      if (isClass) {
        lines.push(`${indent(depth)}${ev}.className = ${code};`);
      } else if (isBool) {
        lines.push(`${indent(depth)}${ev}.${attrName} = !!(${code});`);
      } else {
        lines.push(`${indent(depth)}${ev}.setAttribute('${attrName}', ${code});`);
      }
    }
  }
}

function genDynamicText(
  pv: string, expr: t.Expression, depth: number, lines: string[],
): void {
  // Check for .map() calls that produce arrays of DOM nodes
  if (t.isCallExpression(expr) && t.isMemberExpression(expr.callee) &&
      t.isIdentifier(expr.callee.property) && expr.callee.property.name === 'map' &&
      expr.arguments.length > 0) {
    if (genMapExpression(pv, expr, depth, lines)) return;
  }

  // Check for literal arrays [<A/>, <B/>]
  if (t.isArrayExpression(expr)) {
    if (genArrayExpression(pv, expr, depth, lines)) return;
  }

  // Check for ternary/conditional expressions
  if (t.isConditionalExpression(expr)) {
    if (genConditionalExpression(pv, expr, depth, lines)) return;
  }

  // Check for logical expressions (&&, ||)
  if (t.isLogicalExpression(expr)) {
    if (genLogicalExpression(pv, expr, depth, lines)) return;
  }

  const tv = v('txt');
  lines.push(`${indent(depth)}const ${tv} = document.createTextNode('');`);
  lines.push(`${indent(depth)}${pv}.appendChild(${tv});`);

  const sigRef = extractSignalRef(expr);
  if (sigRef) {
    importedRuntimeFns.add('bindText');
    const fullRef = `${currentCompId}.${sigRef}`;
    lines.push(`${indent(depth)}bindText(${tv}, () => ${sigRef}.get(), '${fullRef}');`);
    bindings.push({ nodeId: '', type: 'text', signalRef: fullRef });
  } else {
    const code = generate(expr).code;
    const sigs = findSignalNames(expr);
    if (sigs.length > 0) {
      importedRuntimeFns.add('bindText');
      const fullRef = `${currentCompId}.${sigs[0]}`;
      lines.push(`${indent(depth)}bindText(${tv}, () => ${code}, '${fullRef}');`);
    } else {
      lines.push(`${indent(depth)}${tv}.nodeValue = ${code};`);
    }
  }
}

function genMapExpression(
  pv: string, expr: t.CallExpression, depth: number, lines: string[],
): boolean {
  const callee = expr.callee as t.MemberExpression;
  const arrayExpr = generate(callee.object).code;
  const callback = expr.arguments[0];

  if (!callback || (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback))) {
    return false;
  }

  const params = callback.params.map(p => generate(p).code).join(', ');
  const fnLines: string[] = [];

  // Check for key prop on the returned JSX element
  let keyExpr = '';
  if (t.isJSXElement(callback.body)) {
    for (const attr of callback.body.openingElement.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'key' && attr.value && t.isJSXExpressionContainer(attr.value)) {
        keyExpr = generate(attr.value.expression).code;
        break;
      }
    }
  }

  if (t.isBlockStatement(callback.body)) {
    for (const stmt of callback.body.body) {
      const compiled = processStatement(stmt, 2);
      if (compiled) fnLines.push(compiled);
    }
  } else if (t.isJSXElement(callback.body)) {
    const result = genJSXElement(callback.body, 2);
    fnLines.push(result.code);
    fnLines.push(`${indent(2)}return ${result.var};`);
  } else if (t.isJSXFragment(callback.body)) {
    const result = genJSXFragment(callback.body, 2);
    fnLines.push(result.code);
    fnLines.push(`${indent(2)}return ${result.var};`);
  } else {
    fnLines.push(`${indent(2)}return ${generate(callback.body).code};`);
  }

  if (keyExpr) {
    // Keyed reconciliation: compare old vs new by key
    importedRuntimeFns.add('__noopReconcile');
    lines.push(`${indent(depth)}${pv}.appendChild(__noopReconcile(${arrayExpr}, function(${params}) {\n${fnLines.join('\n')}\n${indent(depth)}}, function(${params.split(',')[0]}) { return ${keyExpr}; }, '${pv}'));`);
  } else {
    // Unkeyed: createDocumentFragment each time
    importedRuntimeFns.add('__noopEach');
    lines.push(`${indent(depth)}${pv}.appendChild(__noopEach(${arrayExpr}, function(${params}) {\n${fnLines.join('\n')}\n${indent(depth)}}));`);
  }
  return true;
}

function genArrayExpression(
  pv: string, expr: t.ArrayExpression, depth: number, lines: string[],
): boolean {
  const fv = v('afrag');
  lines.push(`${indent(depth)}const ${fv} = document.createDocumentFragment();`);
  for (const el of expr.elements) {
    if (!el) continue;
    if (t.isJSXElement(el)) {
      const result = genJSXElement(el, depth);
      lines.push(result.code);
      lines.push(`${indent(depth)}${fv}.appendChild(${result.var});`);
    } else if (t.isJSXFragment(el)) {
      const result = genJSXFragment(el, depth);
      lines.push(result.code);
      lines.push(`${indent(depth)}${fv}.appendChild(${result.var});`);
    } else if (t.isStringLiteral(el)) {
      const tv = v('txt');
      lines.push(`${indent(depth)}const ${tv} = document.createTextNode(${JSON.stringify(el.value)});`);
      lines.push(`${indent(depth)}${fv}.appendChild(${tv});`);
    }
  }
  lines.push(`${indent(depth)}${pv}.appendChild(${fv});`);
  return true;
}

function genConditionalExpression(
  pv: string, expr: t.ConditionalExpression, depth: number, lines: string[],
): boolean {
  const hasJSXConsequent = t.isJSXElement(expr.consequent) || t.isJSXFragment(expr.consequent);
  const hasJSXAlternate = expr.alternate && (t.isJSXElement(expr.alternate) || t.isJSXFragment(expr.alternate)) || t.isNullLiteral(expr.alternate);

  if (!hasJSXConsequent && !hasJSXAlternate) return false;

  const testCode = generate(expr.test).code;

  // Check if test involves signals → need reactive binding
  const sigs = findSignalNames(expr.test);
  if (sigs.length > 0) {
    importedRuntimeFns.add('bindCondition');
    const consVar = v('cons');
    const altVar = v('alt');
    const consLines: string[] = [];
    const altLines: string[] = [];

    if (t.isNullLiteral(expr.consequent)) {
      consLines.push(`${indent(depth + 1)}return document.createComment('');`);
    } else if (t.isJSXElement(expr.consequent)) {
      const result = genJSXElement(expr.consequent, depth + 1);
      consLines.push(result.code);
      consLines.push(`${indent(depth + 1)}return ${result.var};`);
    } else if (t.isJSXFragment(expr.consequent)) {
      const result = genJSXFragment(expr.consequent, depth + 1);
      consLines.push(result.code);
      consLines.push(`${indent(depth + 1)}return ${result.var};`);
    } else {
      consLines.push(`${indent(depth + 1)}return document.createTextNode(String(${generate(expr.consequent).code}));`);
    }

    if (t.isNullLiteral(expr.alternate)) {
      altLines.push(`${indent(depth + 1)}return document.createComment('');`);
    } else if (t.isJSXElement(expr.alternate)) {
      const result = genJSXElement(expr.alternate, depth + 1);
      altLines.push(result.code);
      altLines.push(`${indent(depth + 1)}return ${result.var};`);
    } else if (t.isJSXFragment(expr.alternate)) {
      const result = genJSXFragment(expr.alternate, depth + 1);
      altLines.push(result.code);
      altLines.push(`${indent(depth + 1)}return ${result.var};`);
    } else {
      altLines.push(`${indent(depth + 1)}return document.createTextNode(String(${generate(expr.alternate).code}));`);
    }

    lines.push(`${indent(depth)}const ${consVar} = () => {\n${consLines.join('\n')}\n${indent(depth)}};`);
    lines.push(`${indent(depth)}const ${altVar} = () => {\n${altLines.join('\n')}\n${indent(depth)}};`);
    lines.push(`${indent(depth)}bindCondition(${pv}, () => ${testCode}, ${consVar}, ${altVar});`);
    return true;
  }

  const cv = v('cond');
  lines.push(`${indent(depth)}let ${cv};`);
  lines.push(`${indent(depth)}if (${testCode}) {`);

  if (t.isNullLiteral(expr.consequent)) {
    lines.push(`${indent(depth + 1)}${cv} = document.createComment('');`);
  } else if (t.isJSXElement(expr.consequent)) {
    const result = genJSXElement(expr.consequent, depth + 1);
    lines.push(result.code);
    lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
  } else if (t.isJSXFragment(expr.consequent)) {
    const result = genJSXFragment(expr.consequent, depth + 1);
    lines.push(result.code);
    lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
  } else {
    lines.push(`${indent(depth + 1)}${cv} = document.createTextNode(String(${generate(expr.consequent).code}));`);
  }

  lines.push(`${indent(depth)}} else {`);

  if (t.isNullLiteral(expr.alternate)) {
    lines.push(`${indent(depth + 1)}${cv} = document.createComment('');`);
  } else if (t.isJSXElement(expr.alternate)) {
    const result = genJSXElement(expr.alternate, depth + 1);
    lines.push(result.code);
    lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
  } else if (t.isJSXFragment(expr.alternate)) {
    const result = genJSXFragment(expr.alternate, depth + 1);
    lines.push(result.code);
    lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
  } else {
    lines.push(`${indent(depth + 1)}${cv} = document.createTextNode(String(${generate(expr.alternate).code}));`);
  }

  lines.push(`${indent(depth)}}`);
  lines.push(`${indent(depth)}${pv}.appendChild(${cv});`);

  return true;
}

function genLogicalExpression(
  pv: string, expr: t.LogicalExpression, depth: number, lines: string[],
): boolean {
  const op = expr.operator;
  const hasJSXRight = t.isJSXElement(expr.right) || t.isJSXFragment(expr.right);

  if (!hasJSXRight) return false;

  const testVar = v('ltest');
  const cv = v('lcond');
  const testCode = generate(expr.left).code;

  // Check if left side involves signals → need reactive binding
  const sigs = findSignalNames(expr.left);

  if (op === '&&') {
    if (sigs.length > 0) {
      importedRuntimeFns.add('bindCondition');
      const thunkVar = v('thunk');
      let thunkBody: string;
      if (t.isJSXElement(expr.right)) {
        const result = genJSXElement(expr.right, depth + 1);
        thunkBody = `${result.code}\n${indent(depth + 1)}return ${result.var};`;
      } else if (t.isJSXFragment(expr.right)) {
        const result = genJSXFragment(expr.right, depth + 1);
        thunkBody = `${result.code}\n${indent(depth + 1)}return ${result.var};`;
      } else {
        thunkBody = `${indent(depth + 1)}return document.createComment('');`;
      }
      const elseThunk = v('ethunk');
      lines.push(`${indent(depth)}const ${thunkVar} = () => {\n${thunkBody}\n${indent(depth)}};`);
      lines.push(`${indent(depth)}const ${elseThunk} = () => document.createComment('');`);
      lines.push(`${indent(depth)}bindCondition(${pv}, () => ${testCode}, ${thunkVar}, ${elseThunk});`);
      return true;
    }

    lines.push(`${indent(depth)}const ${testVar} = ${testCode};`);
    lines.push(`${indent(depth)}let ${cv};`);
    lines.push(`${indent(depth)}if (${testVar}) {`);
    if (t.isJSXElement(expr.right)) {
      const result = genJSXElement(expr.right, depth + 1);
      lines.push(result.code);
      lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
    } else if (t.isJSXFragment(expr.right)) {
      const result = genJSXFragment(expr.right, depth + 1);
      lines.push(result.code);
      lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
    }
    lines.push(`${indent(depth)}} else {`);
    lines.push(`${indent(depth + 1)}${cv} = document.createComment('');`);
    lines.push(`${indent(depth)}}`);
    lines.push(`${indent(depth)}${pv}.appendChild(${cv});`);
    return true;
  }

  if (op === '||') {
    if (sigs.length > 0) {
      importedRuntimeFns.add('bindCondition');
      const elseThunk = v('ethunk');
      let elseBody: string;
      if (t.isJSXElement(expr.right)) {
        const result = genJSXElement(expr.right, depth + 1);
        elseBody = `${result.code}\n${indent(depth + 1)}return ${result.var};`;
      } else if (t.isJSXFragment(expr.right)) {
        const result = genJSXFragment(expr.right, depth + 1);
        elseBody = `${result.code}\n${indent(depth + 1)}return ${result.var};`;
      } else {
        elseBody = `${indent(depth + 1)}return document.createComment('');`;
      }
      const emptyThunk = v('mthunk');
      lines.push(`${indent(depth)}const ${emptyThunk} = () => document.createComment('');`);
      lines.push(`${indent(depth)}const ${elseThunk} = () => {\n${elseBody}\n${indent(depth)}};`);
      lines.push(`${indent(depth)}bindCondition(${pv}, () => ${testCode}, ${emptyThunk}, ${elseThunk});`);
      return true;
    }

    lines.push(`${indent(depth)}const ${testVar} = ${testCode};`);
    lines.push(`${indent(depth)}let ${cv};`);
    lines.push(`${indent(depth)}if (${testVar}) {`);
    lines.push(`${indent(depth + 1)}${cv} = document.createComment('');`);
    lines.push(`${indent(depth)}} else {`);
    if (t.isJSXElement(expr.right)) {
      const result = genJSXElement(expr.right, depth + 1);
      lines.push(result.code);
      lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
    } else if (t.isJSXFragment(expr.right)) {
      const result = genJSXFragment(expr.right, depth + 1);
      lines.push(result.code);
      lines.push(`${indent(depth + 1)}${cv} = ${result.var};`);
    }
    lines.push(`${indent(depth)}}`);
    lines.push(`${indent(depth)}${pv}.appendChild(${cv});`);
    return true;
  }

  return false;
}

function processHelperFn(node: t.FunctionDeclaration, fnName: string, helperFns: string[]): void {
  const asyncPrefix = node.async ? 'async ' : '';
  const params = node.params.map(p => {
    if (t.isIdentifier(p)) return p.name;
    if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return `${p.left.name} = ${generate(p.right).code}`;
    return generate(p).code;
  }).join(', ');

  if (!node.body) {
    helperFns.push(`${asyncPrefix}function ${fnName}(${params}) {}`);
    return;
  }

  // Check if function body contains JSX
  const block = node.body as t.BlockStatement;
  let hasJSX = false;
  for (const stmt of block.body) {
    if (stmtContainsJSX(stmt)) { hasJSX = true; break; }
  }

  if (hasJSX) {
    const processedStmts: string[] = [];
    for (const stmt of block.body) {
      const processed = processStatement(stmt, 1);
      if (processed) processedStmts.push(processed);
    }
    helperFns.push(`${asyncPrefix}function ${fnName}(${params}) {\n${processedStmts.join('\n')}\n}`);
  } else {
    const bodyCode = generate(node.body).code;
    helperFns.push(`${asyncPrefix}function ${fnName}(${params}) ${bodyCode}`);
  }
}

function stmtContainsJSX(stmt: t.Node): boolean {
  if (t.isJSXElement(stmt) || t.isJSXFragment(stmt)) return true;
  for (const key of t.VISITOR_KEYS[stmt.type] || []) {
    const val = (stmt as any)[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item.type === 'string' && stmtContainsJSX(item)) return true;
      }
    } else if (val && typeof val.type === 'string') {
      if (stmtContainsJSX(val)) return true;
    }
  }
  return false;
}

function stripTypeAnnotations(code: string): string {
  return code
    // Remove 'as Type' casts: (e.target as HTMLInputElement) → e.target
    .replace(/\s+as\s+\w+(?:\.\w+)?(?:<[^>]*>)?/g, '')
    // Remove parameter type annotations: (e: Event) → (e)
    .replace(/\(\s*(\w+)\s*:\s*\w+(?:<[^>]*>)?\s*(?:,\s*([^)]+))?\s*\)/g, (_, p1, rest) => {
      if (rest) return `(${p1}, ${rest})`;
      return `(${p1})`;
    })
    // Remove function return types: function(): void { → function() {
    .replace(/\)\s*:\s*\w+(?:<[^>]*>)?(?:\s*\[\])?\s*([={])/g, ')$1');
}

function genEventHandler(
  ev: string, eventType: string, expr: t.Expression, depth: number, lines: string[],
): void {
  const hid = '__h_' + handlerId++;
  const handlerCode = generate(expr).code;
  importedRuntimeFns.add('bindEvent');

  const cleanedCode = stripTypeAnnotations(handlerCode);

  if (extractHandlersMode) {
    handlers.push({
      id: hid,
      eventType,
      code: cleanedCode,
      extracted: true,
    });
    // Generate dynamic import for the handler chunk
    // The handler source is imported lazily from a virtual module
    lines.push(`${indent(depth)}const ${hid} = (e) => { import('./__noop_handler__${hid}.js').then(m => m.default(e)); };`);
    lines.push(`${indent(depth)}bindEvent(${ev}, '${eventType}', ${hid}, '${hid}');`);
  } else {
    lines.push(`${indent(depth)}bindEvent(${ev}, '${eventType}', ${cleanedCode}, '${hid}');`);
  }
}

function extractSignalRef(expr: t.Expression): string | null {
  if (t.isIdentifier(expr) && signalVars.has(expr.name)) {
    return expr.name;
  }
  if (
    t.isCallExpression(expr) &&
    t.isMemberExpression(expr.callee) &&
    t.isIdentifier(expr.callee.object) &&
    t.isIdentifier(expr.callee.property) &&
    expr.callee.property.name === 'get' &&
    signalVars.has(expr.callee.object.name)
  ) {
    return expr.callee.object.name;
  }
  return null;
}

const BOOLEAN_ATTRS = new Set([
  'disabled', 'checked', 'selected', 'readonly', 'required',
  'multiple', 'hidden', 'open', 'autofocus', 'formnovalidate',
  'ismap', 'itemscope', 'loop', 'muted', 'novalidate',
]);

function isBooleanAttr(name: string): boolean {
  return BOOLEAN_ATTRS.has(name);
}

function genStyleObject(obj: t.ObjectExpression): string {
  const parts: string[] = [];
  for (const prop of obj.properties) {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
      const cssName = prop.key.name.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      const val = prop.value;
      if (t.isStringLiteral(val)) {
        parts.push(`${cssName}: ${val.value}`);
      } else if (t.isNumericLiteral(val)) {
        parts.push(`${cssName}: ${val.value}px`);
      } else {
        parts.push(`${cssName}: ${generate(val).code}`);
      }
    }
  }
  return parts.join('; ');
}

interface ResolveResult {
  tokenClasses: string[];
  cssRules: string[];
}

function resolveStyleObject(obj: t.ObjectExpression): ResolveResult {
  const tokenClasses: string[] = [];
  const cssRules: string[] = [];

  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

    const cssProp = prop.key.name.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

    if (t.isStringLiteral(prop.value)) {
      let resolved = false;
      for (const resolver of tokenResolvers) {
        const className = resolver.resolve(cssProp, prop.value.value);
        if (className !== null) {
          tokenClasses.push(className);
          resolved = true;
          break;
        }
      }
      if (!resolved) {
        cssRules.push(`${cssProp}: ${prop.value.value}`);
      }
    } else if (t.isNumericLiteral(prop.value)) {
      cssRules.push(`${cssProp}: ${prop.value.value}px`);
    } else {
      cssRules.push(`${cssProp}: ${generate(prop.value).code}`);
    }
  }

  return { tokenClasses, cssRules };
}

function isFullyStaticObject(obj: t.ObjectExpression): boolean {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) return false;
    const val = prop.value;
    if (!t.isStringLiteral(val) && !t.isNumericLiteral(val) && !t.isBooleanLiteral(val) && !t.isNullLiteral(val)) {
      return false;
    }
  }
  return true;
}

function styleHash(cssText: string): string {
  let hash = 0;
  for (let i = 0; i < cssText.length; i++) {
    const char = cssText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '_a' + Math.abs(hash).toString(36).substring(0, 6);
}

function findSignalNames(expr: t.Expression): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  function walk(node: t.Node): void {
    if (t.isIdentifier(node) && signalVars.has(node.name) && !seen.has(node.name)) {
      seen.add(node.name);
      found.push(node.name);
    }
    for (const key of t.VISITOR_KEYS[node.type] || []) {
      const val = (node as any)[key];
      if (Array.isArray(val)) {
        val.forEach((v: any) => { if (v && typeof v.type === 'string') walk(v); });
      } else if (val && typeof val.type === 'string') {
        walk(val);
      }
    }
  }

  walk(expr);
  return found;
}

export { createTailwindResolver } from './tailwind.js';
