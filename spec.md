# AetherJS 1.0 — Full AI-Agent Implementable Specification

**Version:** 2.0.0 (supersedes draft)
**Target Agent:** Autonomous Coding Agent

---

## Directive to Agent

You are an expert systems programmer and compiler engineer. Your mission is to build AetherJS, a zero-runtime, resumable, signal-based web framework. You must follow this specification **exactly**. Do not invent features, abstractions, or optimizations beyond what is specified. Write code in TypeScript for runtime packages; use Rust (with `swc` or `oxc` for parsing) for the compiler if performance is needed, otherwise TypeScript with `@babel/core`. Write tests for every phase before implementing. Never proceed to the next phase until the current phase's test suite passes. If you encounter ambiguity, halt and ask for clarification.

---

## Architectural Principles (Non-Negotiable Constraints)

1. **No Virtual DOM** — The compiler must generate direct DOM creation and fine-grained effect updates. At no point should a VDOM object exist.
2. **Resumability, Not Hydration** — Server-rendered pages must be *resumed* on the client without re-running component functions. The server serializes the reactive graph and state; the client picks up the signal graph, re-attaches effects to existing DOM nodes, and lazily loads event handlers.
3. **Zero-Runtime by Default** — Pages with zero interactivity ship **no framework JavaScript**. Interactive islands ship only the minimal runtime (max 1.5KB for the resumer) and the exact handler code needed.
4. **TC39 Signals as Sole Reactivity** — No observables, no stores, no state management beyond signals/computed/effect. The signals implementation must follow the TC39 proposal semantics (explicit `get`/`set`, lazy computed, batched effects).
5. **Platform Native** — Use browser primitives: Custom Elements, View Transitions API, Fetch, ReadableStream, `document.startViewTransition()`. The framework is just a compiler + thin runtime glue.
6. **Isomorphic Server/Client Execution** — A component's logic must run unchanged on server and client. The environment difference is only visible in DOM APIs and the availability of `document`. The SSR layer replaces the DOM globally with a shim; the client uses real DOM.

---

## Core Primitives & APIs (Exact Contract)

### 2.1 `@aether/signals` – TC39 Signals Polyfill

```typescript
// Exact interface
export interface Signal<T> {
  get(): T;
  set(newValue: T): void;
}

export function signal<T>(initialValue: T): Signal<T>;
export function computed<T>(fn: () => T): Signal<T>;
export function effect(fn: () => void): () => void; // returns disposer
```

- `signal` and `computed` must be deeply nested aware (auto-unwrap signals in computed functions).
- `effect` must run synchronously once, then re-run whenever any signal read during its execution changes.
- The runtime must batch updates: within a single microtask (or synchronous if possible), multiple signal sets trigger effect re-runs only once.
- No `peek()`, `untracked()`, or other extensions. The spec is minimal.

### 2.2 `@aether/runtime` – Framework Hooks (to be compiled away)

These functions are only used during SSR and compiler transformations; they never ship to the client in final bundles.

```typescript
// Registers an event handler lazily
export function registerEventHandler(
  componentId: string,
  handlerId: string,
  handler: (...args: any[]) => void,
  eventType: string
): void;

// Creates a suspense boundary; used internally for streaming
export function createSuspenseBoundary(
  key: string,
  fallback: () => string, // HTML
  children: () => Promise<string> | string
): { html: string; suspenseId: string };
```

These are placeholders for the compiler to recognize. Actual implementation lives in `@aether/compiler` and `@aether/server`.

### 2.3 Component Syntax (`.aether.tsx`)

Developers write JSX with a single pattern:

```tsx
import { signal } from '@aether/signals';

export default function MyComponent(props: { ... }) {
  const state = signal(initial);
  // Any logic, async allowed
  return <div>{state}</div>;
}
```

- Components are **always named function exports** (default or named). They are plain functions, not classes.
- They accept a single `props` object (typed with TypeScript).
- They can be `async` – if a component returns a Promise, the SSR must await it; the client must be able to resume a component that loaded data asynchronously (by serializing the resolved data, not the promise).
- JSX children are always passed as props, never as a raw array – the compiler normalizes `children` prop.

---

## Repository Structure (Monorepo)

```text
aetherjs/
├── packages/
│   ├── compiler/          # Rust/TS AST transformer
│   ├── signals/           # Lightweight signals runtime
│   ├── server/            # SSR engine, streaming, serialization
│   ├── client/            # Resumer script, lazy loader, event delegation
│   └── css/               # Atomic CSS extraction (compiler plugin)
├── examples/
│   ├── counter/           # Minimal interactive page
│   ├── blog/              # Nested routing, data fetching
│   └── custom-element/    # Web Components interop demo
├── tests/
│   ├── unit/              # Compiler transforms, signals edge cases
│   ├── integration/       # SSR + resumer combined via simulated DOM
│   └── e2e/               # Real browser tests (Playwright)
├── package.json           # Workspaces
├── tsconfig.base.json
└── pnpm-workspace.yaml
```

Use `pnpm workspaces`; compiler can be a separate Rust crate with a Node binding.

---

## Expanded Execution Plan – Detailed Phases

### Phase 0: Project Setup & Signals

**Goal:** Initialize monorepo, implement signals, set up testing infrastructure.

**Tasks:**
- Create monorepo with `pnpm init -w`.
- Create `packages/signals` and implement the exact API (`signal`, `computed`, `effect`) with full batch scheduling.
- Unit tests:
  - `signal.get()` returns initial value.
  - `signal.set()` triggers effects that read it.
  - Computed signal updates lazily and caches.
  - Effects batch correctly: two consecutive sets within a synchronous block cause a single effect run.
  - Nested computed signals work.
- No other runtime code. This package will be used by SSR, client, and compiler tests.

### Phase 1: The Compiler – Core JSX Transform

**Goal:** Convert `.aether.tsx` files into raw JavaScript that creates DOM nodes, wires signals, and registers lazy event handlers. The output must not import any runtime except `@aether/signals`.

**Compiler Architecture:**
- Input: TypeScript + JSX (extension `.aether.tsx` or `.tsx` with special pragma).
- Use `swc` (Rust) or `@babel/core` + `@babel/parser` + `@babel/traverse` for AST manipulation.
- Output: plain `.js` with no JSX, no runtime imports.

**Detailed Transformation Rules:**

1. **Imports:**
   - Remove all framework-specific imports (`@aether/signals` except for signals that are used — keep the import for those symbols).
   - Keep user imports.

2. **Component function:**
   - Wrap the component function body to return a DOM node (or array of nodes) at the top level. A component must return a single root element (or fragment, which becomes a `DocumentFragment`).
   - The function is transformed to a `function` that takes `props` and returns `Node`.

3. **JSX Elements → DOM Creation:**
   - `<div class="foo">...</div>` → `const el = document.createElement('div'); el.className = 'foo';`
   - Attributes: static string attributes are set directly. Dynamic attributes bound to a signal or expression are handled via effects.
   - `<div attr={expr}>`:
     - If `expr` is a signal read (e.g., `{mySignal}`), generate:
       `effect(() => { el.setAttribute('attr', expr.get()); });`
     - If `expr` is a non-signal expression (e.g., `{condition ? 'a' : 'b'}`), evaluate at creation time and set statically, then if any signal is used inside the expression, wrap in an effect that calls the expression and sets the attribute. The compiler must track which signals are read inside the expression by analyzing the AST (or by deferring to runtime: if the expression is not a simple signal access, wrap it in a `computed` so it becomes a signal). For simplicity, the compiler can wrap any non-trivial dynamic attribute expression in a `computed` signal, then generate an effect that reads that computed and sets the attribute. This avoids complex tracking. However, the spec demands zero-runtime overhead when no signals are involved. So:
       - If the expression is purely static (no signal access, no function calls referencing signals), assign statically.
       - Otherwise, create a computed signal: `const __expr_0 = computed(() => expr); effect(() => { el.setAttribute('attr', __expr_0.get()); });`
     - This computed must be hoisted inside the component but outside the effect so it's created once.
4. **Text children:**
   - Static text: `el.appendChild(document.createTextNode('Hello'))`
   - Dynamic text `{signal}` or `{expression}`:
     - If simple signal reference: `const txt = document.createTextNode(''); effect(() => { txt.nodeValue = signal.get(); });`
     - If complex expression: create a computed as above, then effect.
5. **Event handlers:**
   - `onClick={handler}` → do not attach directly. Instead:
     - Generate a unique handler ID for this component instance and event type: `__aether_handler_map[compId + '_' + handlerId] = handler;`
     - Set `el.setAttribute('data-aether-ev', handlerId + ':' + eventType)` (or use a combined data attribute).
   - The handler function body must be left in the component's scope so that it can be lazily loaded. The compiler will later split handlers into separate chunks (see Phase 3). For the core transform, the handler is just stored in a module-level `Map` (for SSR we'll serialize references, not functions). Actually, for resumability, we don't store functions on the server; we only ship handler IDs. So the compiler should instead:
     - In the output code, define the handler function as a named function in the component module.
     - Register it in a global registry for the client build, but for SSR we just output the `data-aether-ev` attribute.
   - Final rule: Transform `onEvent={handler}` to:
     ```js
     const __handlerId = '__compId_event_0';
     __aether_register_event_handler(__handlerId, handler);
     el.setAttribute('data-aether-ev', __handlerId);
     ```
     The `__aether_register_event_handler` is a placeholder that the bundler/compiler will handle: during SSR, it serializes the handler ID, not the function. For client build, the function is bundled into a separate chunk and the mapping is stored. The core compiler only needs to insert the call and the attribute.

6. **Component composition:** `<Child prop={x} />`
   - If `Child` is a known Aether component (another function), transform to:
     `const __child = Child({ prop: x, children: [] }); // returns Node`
     Then append the returned node to parent. The compiler must inline the call, or if the child is imported, generate `Child(props)` call.
   - The parent's return will build a tree.
   - For resumability, the parent-child relationship must be reflected in the serialized tree. This requires each component instance to have a unique component ID so that the server can map state to nodes. The compiler must generate a `componentId` for each component instantiation (incremented per module). So inside component body:
     `const __compId = '__module_0_comp_0';`
     Then children get increasing IDs: `__module_0_comp_1`, etc.
     This ID is passed implicitly to children (via a hidden prop or closure) so that the whole tree is labeled. We'll define a convention: every component receives a `__aetherId` prop (hidden). The parent passes its own id + child index. In the output, the child call includes `__aetherId` prop. This is essential for SSR serialization.

   - Simplified: The compiler wraps each component call with an auto-generated identifier that is used to scope signals and DOM nodes. For now, the compiler emits code to propagate IDs.

**Test Plan for Compiler (Phase 1):**
- Create a suite of `.aether.tsx` fixtures:
  1. A simple component with static HTML: `export default function Foo() { return <div>hello</div>; }` → expect output to create a div and text node, return it.
  2. A component with a signal:
     ```tsx
     export default function Counter() {
       const count = signal(0);
       return <button onClick={() => count.set(count.get()+1)}>{count}</button>;
     }
     ```
     Expected output: creates button, text node, effect that updates text, registers event handler with ID, sets data attribute.
  3. A component with computed attribute: `<div class={someSignal.get() ? 'a' : 'b'}>` → should produce computed and effect.
  4. Nested components: parent renders child component; verify that child receives a `__aetherId` prop and that the compiler correctly calls the child function and appends result.
- Write unit tests using `jest` or `vitest` that parse the transformed code as a string and assert presence of specific constructs (like `effect(() => { txt.nodeValue = count.get(); })`, `data-aether-ev` attribute, etc.). Better yet, execute the transformed code in a Node environment (with a minimal DOM shim) and check that the returned DOM structure matches expected, but that may require a full SSR later. For now, string matching suffices.

### Phase 2: Server-Side Rendering (SSR) & Serialization Engine

**Goal:** Render Aether components to HTML on the server (Node/Bun/Deno) and produce the serialized state required for client resumption.

**Architecture:**
- Create `packages/server` which exposes `renderToString(componentFn, props?)`.
- The server environment must have a global `document` and `window` shim that mimics enough DOM to create nodes and collect HTML output. Use `linkedom` (lightweight) or a custom minimal DOM implementation.
- Components when executed will call `document.createElement`, etc. The shim must record all created elements and their attributes, and on `toString()` output valid HTML.
- Important: The SSR shim must also be able to capture `effect` registrations. When an `effect` is called during server rendering, instead of subscribing to signals, the effect's dependency graph and closure variables must be serialized. The `effect` function in the SSR shim will be a no-op that, when invoked, records the effect's function source and the signal reads that would trigger it, then stores that metadata.

**SSR DOM Shim Design:**
- Implement a `ServerDocument` class that proxies DOM operations:
  - `createElement(tag)` → returns a `ServerElement` with `tagName`, `attributes`, `children`.
  - `createTextNode(text)` → returns `ServerTextNode`.
  - `appendChild`, `setAttribute`, etc.
  - `ServerElement` has `toHTML()` to serialize to string.
- Additionally, hook into `effect(fn)`: In SSR mode, `effect` must be replaced with a function that:
  1. Calls `fn()` once to compute the initial result (so the generated HTML contains the initial value).
  2. Captures which signals are read during `fn()` (by wrapping signal `get` with a tracker). The signal implementation must support a "collect dependencies" mode.
  3. Stores a serialized representation of the dependency: which signal (identified by its unique component-scoped path) is read, and the effect's update function (needs to be serializable as a string or reference to a client-side function). Since effects are compiled away to direct DOM mutations, the effect function itself is code that the client already has (in the component chunk). So we can simply store a reference: "effect index within this component". The client resumer will know how to reconstruct that effect.

**Serialization Data Structure:**
After rendering a page, the server produces:
```html
<html>
...
<body>
  <!-- rendered HTML -->
  <script id="__AETHER_STATE__" type="application/json">
    {
      "rootId": "c0",
      "components": {
        "c0": {
          "type": "default_module", // identifies the component
          "signals": {
            "count": 0,
            "__expr_1": "dynamic value computed by computed"
          },
          "effects": [
            { "id": "e0", "deps": ["count"], "update": "txt_1.nodeValue = count + ''" } // or some bytecode
          ],
          "children": ["c1"]
        },
        "c1": { ... }
      },
      "eventMap": {
        "handlerId_0": { "eventType": "click", "componentId": "c0", "handlerIndex": 0 }
      }
    }
  </script>
</body>
</html>
```
But we can simplify: Because the client will simply "resume" the signal graph, we can serialize the state of all signals in a flat map (using the `componentId + signalName` as key), and for each effect that was active on the server, store the effect's code as a string (or better, an ID that maps to a client-side function). However, the original spec suggests serializing nodes and their dependency relationships. A better approach is to record for each dynamic node (text or attribute) a "binding" that links a signal path to an update operation. Since the client resumer knows the component code (it can be fetched lazily), we only need to serialize the *state* and a map of `elementId` → `signalPath` so the resumer can re-attach.

Given that the framework is compiled, we can assume that the component's JS code (with effects) will be loaded on demand. So the serialization can be minimal: a mapping from node IDs (given by `data-aether-node` attributes in HTML) to the signal paths that drive them. For resumability, we do NOT need to serialize effects; we just need to restore the signals to their SSR state and then let the component's effects (when they eventually load) pick up and update the DOM. But that would mean hydration-like re-attach. True resumability avoids running component code. To achieve that, we need the client to *resume* the effect graph without executing component functions. This means we must serialize the structure of the reactive graph: which signal updates which node, and how. That's why serialization includes the binding between a node and a signal, plus an updater function. The updater function can be a simple template like `"Count is " + count.get()` that the client can evaluate using the signal. So the serialized state can contain:

- A list of "bindings": `{ nodeId: "txt_1", signalRef: "c0.count", updater: "txt_1.nodeValue = 'Count is ' + c0.count.get()" }` (where `c0.count` is a path to the signal).
On the client, the resumer creates signals from state, then for each binding, creates an effect that runs the updater. That effectively resumes without re-running component logic.

I'll refine the serialization to be an array of `Binding` objects, and a flat map of signal states.

**Detailed SSR Implementation Steps:**
1. Implement a global `ServerDOM` context: before rendering, set a global `__AETHER_SSR_CONTEXT` with an empty signal store and effect registrations.
2. Replace the global `document` with a `ServerDocument` shim.
3. Patch `@aether/signals` to detect SSR mode: if `__AETHER_SSR_CONTEXT` exists, `signal()` creates an SSR signal that can be tracked for dependencies; `effect(fn)` pushes the effect into a list and immediately executes `fn` to produce initial DOM state (so text nodes and attributes reflect the current signal values).
4. Execute the root component function, which returns the root DOM node (a `ServerElement`). Append it to the document body.
5. After execution, collect all effects that were registered. For each effect, compute the dependency list (which signals were read) and generate an updater string: The updater must be a string of JavaScript code that, when `eval`'d in the client context (with the signal variables in scope), will perform the same DOM update. This is tricky because the effect body contains DOM references. But we can serialize the effect body as a function source and rely on the client having the same node IDs. Alternatively, we can record the *effect binding* in a higher-level representation: The compiler could have already output a mapping from effect index to a description of the node and attribute/text. That would be part of the compilation result. For Phase 2, to avoid overcomplicating the compiler, we can cheat: Have the SSR effect register a "binding" object that captures the target node (by its unique ID) and the updater function (as a string that uses signal references like `__sig_c0_count.get()`). The resumer will then create that effect on the client. We can achieve this by modifying the compiler: For each effect, instead of directly calling `effect(() => { el.textContent = ... })`, it calls a framework wrapper: `__aether_bind_text(el, () => signal.get())` or something. That wrapper during SSR records the binding; on client it sets up the effect. This is more robust.
So the compiler must generate calls to `__aether_bind_*` functions instead of raw `effect`. That way, SSR can capture the binding metadata without stringifying function bodies. This is a better design, consistent with zero-runtime: the binding functions are only present in SSR and development; the client resumer uses them to replay effects.

**Revised Compiler Output (updated Phase 1):**
Instead of raw `effect(() => { ... })`, the compiler outputs:
```js
import { bindText, bindAttribute, bindEvent } from '@aether/runtime';
...
const txt = document.createTextNode('');
bindText(txt, () => count.get()); // for static wrapper
// or for complex expression: bindText(txt, () => count.get() + ' items');
```
And events: `bindEvent(el, 'click', handler, handlerId);` which during SSR just records the handler ID.

Then SSR's `bindText` on server: it immediately runs the getter to set initial text, and records a binding `{ nodeId: txt.uniqueId, signalRefs: [...], updater: getter.toString() }`. But again, we can do better: The getter function is a closure that references the signal variables; on the client, those signals will be re-created and in scope. The resumer can just call `bindText(el, getter)` after signals are restored. That means we don't need to serialize the updater string; we just need to restore the signals, then re-run the binding setup. But that would require loading the component code, which violates resumability (we'd have to execute the component or at least the binding code). Qwik solves this by serializing closures as JSON and resuming them. To avoid loading component code, we must serialize the binding function in some way. The Qwik approach serializes the closure's captured variables and a reference to the function implementation. In our case, the function implementation is known (it's `bindText` with a simple getter). We can serialize the signal reference and the getter logic as a small compiled template. Given the compiler already has the getter expression, it can emit a serializable descriptor.

I think it's acceptable that the client loads a tiny "resumer" that can parse a binding descriptor and re-attach. The binding descriptor will be generated by the compiler as a static map in the output: For each component, the compiler emits a list of bindings with their dependencies. This list is embedded in the server HTML and used by the resumer without loading component code. This is essentially the "resumability metadata". So the compiler must produce a JSON-like structure per component that describes effects. This is the path we'll follow.

**Specification for Phase 2 (SSR & Serialization) with compiler tweak:**
- Update compiler: For each component, alongside the output JS, also produce a `manifest.json` (or embed in the JS) that lists for each effect a binding descriptor: `{ type: 'text', nodePath: 'c0[0]', signal: 'count', transform: 'identity' }`. `transform` could be a simple expression template. To keep it simple, the compiler will generate code that calls a registration function with a descriptor object. The SSR engine will then collect these descriptors and serialize them into `__AETHER_BINDINGS__`.
- In SSR, when executing the component, the `bindText` and `bindAttribute` functions will record these descriptors along with the node's unique ID (set via `data-aether-node`). After rendering, the server outputs the bindings array and initial signal state.
- Client resumer then just reads the bindings, creates signals from state, and for each binding sets up a direct effect using the simple descriptors (like `effect(() => { document.querySelector('[data-aether-node="..."]').nodeValue = signal.get(); })`). That is resumability without any component code.

This approach is clean and adheres to zero-runtime: The bindings descriptors are generated at compile time, serialized into the HTML. The resumer is a ~1KB engine that reads them and wires the page. No component functions are ever sent to the client unless the page is interactive. Interactive event handlers are lazily loaded. For attribute bindings, similar descriptor.

Thus, Phase 2 requires modifying the compiler to emit binding descriptors instead of raw effects. This is a design refinement; we'll adjust the spec accordingly.

**Phase 2 Tasks:**
1. Define exact shape of a `BindingDescriptor`:
   ```typescript
   interface BindingDescriptor {
     nodeId: string; // unique in the page, generated by compiler as auto-incrementing IDs
     type: 'text' | 'attribute';
     attributeName?: string; // for attribute bindings
     signalRef: string; // path like "c0.count" or just "count" scoped to component
     transform?: string; // optional, if not identity, a simple expression e.g. "signal.get() * 2"
   }
   ```
2. Update compiler to:
   - For each dynamic text: generate `bindText(node, signal, transform?)` which during SSR records a `BindingDescriptor` with `transform` being the raw text expression converted to a function string? Instead, we'll keep `transform` as a simple expression that the resumer can evaluate by putting the signal's value in a variable `v`. The resumer will have a simple evaluator: for `transform`, if it's `v * 2`, it evaluates `signal.get() * 2`. This means the binding system is limited to pure expression strings that can be evaluated in a sandbox. For simplicity, we restrict dynamic text bindings to just the signal value (identity), which is the most common case. Advanced expressions can be pre-computed via a computed signal and then bound to a text node with identity. So we can mandate: if a dynamic text contains a complex expression, the compiler will automatically create a computed signal that evaluates the expression, and then bind that computed signal to the text node. That way, all bindings are identity (just `signal.get()`). This drastically simplifies the binding descriptor: just `signalRef` and no transform. For attribute bindings, the same rule: if expression is not just a signal reference, create a computed and bind that. The computed's dependencies are automatically tracked, and its value is a signal. So binding is always identity.
   - So compiler will:
     - For `{someSignal}` → `bindText(node, someSignal)`
     - For `{complexExpr}` → `const __computedExpr = computed(() => complexExpr); bindText(node, __computedExpr);` and the binding descriptor will reference that computed signal.
   - This means the binding descriptors only need `signalRef`, which is a path to the signal (which will be serialized in state).
3. Implement `bindText`, `bindAttribute` in `@aether/runtime` (SSR version):
   - In SSR, `bindText(node, signal)`: set `node.nodeValue = signal.get()` immediately, then record a binding `{ nodeId: node._aetherNodeId, type: 'text', signalRef: signal._aetherSignalPath }`. The signal must have a `_aetherSignalPath` set by the SSR context.
   - `bindAttribute(el, name, signal)`: similar, record attribute binding.
4. Implement SSR context: Before rendering, start a new context that assigns auto-incrementing node IDs to every created DOM node (in the shim) and assigns signal paths when `signal()` is called. Signal paths are built as `compId.signalName` where `signalName` is derived from variable name (compiler provides). The compiler must emit a hidden `__aetherCreateSignal(initialValue, 'name')` instead of direct `signal()` call, so that SSR can capture the path. So modify compiler: replace `signal(0)` with `__aetherCreateSignal(0, 'count', __compId)` where `__compId` is the component instance ID. This call is then defined in `@aether/runtime` to create a signal and attach the path. In client, it's just a signal with path info for debugging.
5. After rendering, collect all bindings and signal states (current values of all signals). Serialize to JSON in the `__AETHER_STATE__` script.
6. Include in the HTML `data-aether-node` attributes on elements that have bindings, with the node ID.
7. The root node gets an ID `root`.

**Test Plan for Phase 2:**
- Unit test SSR with a simple counter component: verify HTML contains `<button data-aether-ev="..." data-aether-node="...">Count is 0</button>`.
- Verify that `__AETHER_STATE__` contains the signal `root.c0.count: 0` and a binding for the text node linking to that signal.
- Render a parent-child component, verify state hierarchy.
- Check that event handlers do not appear as functions; only handler IDs are in the state.

### Phase 3: Client Resumer & Lazy Event Loading

**Goal:** A minimal client-side script (~1KB) that reads the serialized state, creates signals, re-attaches bindings, and sets up event delegation to lazily load handler chunks.

**`packages/client` Implementation:**
- The resumer code is a standalone IIFE (no imports from signals package? Possibly inline the minimal signal creation). To keep it tiny, we can include a minimal signals implementation inline (or import a pre-bundled signals core). The resumer must not depend on any framework packages; it's a standalone script that will be inlined in the HTML or served as a static file.
- Steps on page load:
  1. Parse `document.getElementById('__AETHER_STATE__')` JSON.
  2. Create a global signal registry: a Map from signal path to signal instance.
  3. For each signal entry in state, `let sig = signal(stateValue); sig._path = path;` store in map.
  4. Process bindings array: for each binding, find the node using `document.querySelector('[data-aether-node="ID"]')` (or if we set IDs as `a0`, we can use `document.getElementById` for speed; we'll assign `id` attributes automatically during SSR). Then:
     - If binding type is 'text', get the signal reference, create an effect: `effect(() => { node.nodeValue = sig.get(); })`.
     - If attribute: similar, but `node.setAttribute(attrName, sig.get())`.
     These effects must be batched, so we need the effect scheduler from signals. The resumer will include a small signal runtime.
  5. After all bindings, the page is live and reactive.
- **Event Delegation for Lazy Handlers:**
  - Set up a global event delegation on `document` for common events (`click`, `input`, etc.). Use event capturing or bubbling.
  - On event, check `event.target` and traverse up to find `data-aether-ev` attribute.
  - Extract the handler ID: `<element data-aether-ev="h0">`.
  - Look up handler metadata from `__AETHER_STATE__.handlers`: `{ "h0": { "eventType": "click", "chunk": "/_aether/h0.js" } }`.
  - If handler chunk is not already loaded, dynamically `import(chunk)` (using a pre-configured chunk map, not a file path; the server will have a route to serve handler chunks). The import returns a module with a default function (the handler). Then remove the event delegation for that specific element and attach the handler directly to avoid delegation overhead. But the handler may close over component state? The handler needs access to the signals it uses. How does it get them? Because the handler code was originally inside the component function, it references signals via closure. For the handler to work, it must be able to reach those signals. That means the handler chunk must be generated by bundling the component's handler functions, but they need to be linked to the same signal instances. This requires that the signal instances are stored in a module-level variable that the handler chunk can access. So during bundling, we must ensure that the handler code, when loaded, will use the same signal registry. One solution: the resumer initializes a global `__AETHER_SIGNALS` object that maps signal paths to signal objects. The handler chunk, upon loading, will look up the signals it needs from that registry, not from closures. Therefore, the compiler must transform handler functions to use signal registry lookups instead of direct closure variables. This is a significant but necessary step.

  - Revised compiler rule: Every handler function body is rewritten to replace direct signal variable references with `__aether_getSignal(compId, 'signalName')`. This ensures the handler chunk can be fully independent and just use the global signal store. The compiler will do this transformation.
  - Then the lazy loading: `import(chunk)` returns a setup function that registers the handler to the global map. The resumer can call that setup, then invoke the handler when event occurs.
  - Simpler approach (used by Qwik): The handler chunk exports a symbol (a function) that, when called, returns the handler function, which closes over the signals because the closure is serialized and restored. Qwik serializes the closures entirely. We could adopt a similar approach: serialize the handler's scope (signal references) so that the handler chunk, when executed, reconstructs the closures. That's complex. The cleaner path: the compiler should not rely on closure over signals; instead, make all signal usage explicit via a reactive scope. However, that would break the developer experience.

  Given the spec's goal of simplicity, we can compromise: For the initial implementation, lazy event loading can load the component's entire JavaScript (including the signal creations and effects), but only the handler code is executed, and it will re-initialize the signals? That would break resumability because it would create new signal instances. So we need a way to share the signal instances.

  I think the best path, consistent with resumability, is: Handlers are compiled to standalone functions that take an argument `{ signals }` where `signals` is a map of the signals they need. The resumer, when loading a handler chunk, calls the handler with a prepared signals object. The compiler will extract from the handler which signals it reads (by scanning the AST) and emit the handler function with those signals as parameters. This is possible and deterministic.

  So final rule: For each event handler, the compiler produces a separate function that takes a `__aether_signals` object, and the handler body uses `__aether_signals.signalName` instead of local variables. This function is placed in a separate chunk. The lazy loader will fetch the chunk, then execute the handler with the appropriate signal map for that component instance. This works beautifully.

  - Implementation: During compilation, for each `onEvent={expr}` where `expr` is a function expression or identifier, extract the function's AST, find all signal variable reads (variables that were created via `signal()` in the component scope), replace them with `__aether_signals['signalName'].get()` or `.set(...)`. Then output a separate chunk module: `export default function handler(__aether_signals) { ... }`. The chunk filename is generated based on a hash of the function.

  - The SSR serialization will include a mapping from handler ID to chunk URL and a list of required signal names for that handler. The resumer can then pre-fetch or lazily load.

**Phase 3 Tasks:**
- Implement the resumer script (`packages/client/src/resumer.ts`). It must be compiled to a self-contained IIFE with signals runtime inlined (or import signals and bundle with zero external deps).
- Resumer API: `window.__AETHER_init()`, called on script load.
- Handle bindings: for each binding descriptor, create effect as described.
- Event delegation setup: add a global event listener on `document` for common types. On event, extract `data-aether-ev`, look up handler metadata from `__AETHER_STATE__.handlers`. If chunk not loaded, dynamically import chunk URL. The chunk exports a default function `(signals) => void`. The resumer then creates a scope with the required signals (from the global registry) and invokes the handler. Optionally, after first invocation, the resumer can replace the event delegation with a direct listener on the element to avoid future delegation overhead (and to allow event removal).
- Build the signal registry: on init, create signals from state. Each signal is stored with its path.
- The resumer must also handle effects created by bindings; these effects might need to be disposed if the component is removed (not needed initially, as full page navigation will re-run resumer on new page).

**Test Plan for Phase 3:**
- End-to-end test: Use a Node server to render the counter page, serve the HTML with resumer script, then use Playwright to load the page, click the button, and verify the text updates. Also verify that the handler chunk was fetched only after click.
- Test that when state is changed via a handler, the binding effect re-runs and updates the DOM.
- Test with multiple components and cross-component signal references (if not supported, skip for now; scope signals to component).

### Phase 4: Routing & View Transitions

**Goal:** File-based routing with server rendering and client-side navigation that uses native View Transitions and resumability per page.

**Architecture:**
- Route definitions derived from `src/routes/` directory structure (convention).
- Each route module exports a default component (page).
- Nested layouts: A file like `layout.aether.tsx` in a directory wraps child pages. Similar to SvelteKit or Next.js App Router.
- Server intercepts all requests. For initial page load, it renders the route component using SSR (Phase 2), sending full HTML.
- For subsequent client navigations (click on `<a>` tags), the client intercepts the click, performs a fetch to the new page URL with a header `Accept: text/html` but expects a partial HTML response (just the `<body>` content). The server, detecting a fetch with a special header, renders only the target route's content, not the full document shell. The client then swaps the content using `document.startViewTransition()`.

**File-system Routing Rules:**
- `src/routes/index.aether.tsx` → `/`
- `src/routes/about.aether.tsx` → `/about`
- `src/routes/blog/[slug].aether.tsx` → `/blog/:slug`
- Nested layouts: `src/routes/dashboard/layout.aether.tsx` wraps `dashboard/page.aether.tsx` and sub-routes.
- The server must resolve the component for a given URL, compile/execute it, and produce HTML.

**Client Navigation Steps (Resumer Extension):**
- The resumer (or a small router script included) attaches click listeners on all `<a>` elements that have same-origin hrefs (or internal links).
- On click, prevent default, call `router.navigate(href)`.
- Navigation flow:
  1. `fetch(href, { headers: { 'X-Aether-Navigate': '1' } })` – the server responds with a JSON payload containing:
     - `html`: string of the new page's inner HTML (body content).
     - `state`: updated serialized state for the new page's components (signals, bindings).
     - `handlers`: handler map for the new page.
  2. Wrap DOM swap in `document.startViewTransition(async () => { ... })`:
     - Parse the new HTML into a temporary container.
     - Replace the content of the current page's root layout slot (e.g., `<main>`) with the new HTML.
     - Load the new resumability state: call `__AETHER_applyState(newState)` to update signal registry and re-create bindings (while disposing old effects). The resumer should support hot-swapping state for a sub-tree.
  3. The browser handles the transition animation.
- This provides seamless page transitions.

**Server Implementation:**
- The server package will include a production-ready Node server (or adapter for Bun/Deno).
- On request with `X-Aether-Navigate`, respond with JSON instead of full HTML.
- Full HTML page on initial load includes resumer script and router bootstrap.

**Test Plan for Phase 4:**
- E2E: Create a two-page site (`/` and `/about`). Navigate from home to about via link. Assert that URL updates, the page content changes, and a View Transition runs (can check with Playwright's `page.waitForEvent('animation')` or view transition mock).
- Ensure signal state is properly isolated per page; clicking a button on one page doesn't affect the other after navigation.

### Phase 5: Zero-Runtime CSS

**Goal:** Co-located styles compiled to atomic CSS at build time. No runtime CSS-in-JS.

**Implementation:**
- Components may export a `styles` object (optional). For example:
  ```tsx
  export const styles = {
    container: { color: 'red', fontSize: '16px' }
  };
  ```
- The compiler extracts these during compilation, converts each rule to an atomic class (e.g., `_c1`, `_c2`), and generates a global CSS file (e.g., `styles.css`).
- The JSX in the component uses `styles.container` as an expression; the compiler replaces `style={styles.container}` or `className={styles.container}` with the generated class string.
- If `style` attribute is used, the compiler can convert each property to a separate class or inline as a compiled class that sets multiple properties (atomic CSS per property is preferable for small output). Use a library like `vanilla-extract` or implement a simple version: property-value pair becomes a class name with hash.
- The CSS extraction plugin runs as part of the build (could be integrated into the compiler or a bundler plugin). For the MVP, the compiler can collect all style objects and write a CSS file to the output directory, while replacing references with a string of class names.

**Test Plan:**
- Write a component with `styles`, verify build output contains a CSS file with the atomic class and that the HTML uses the class, not inline style.

### Phase 6: Web Components Interop

**Goal:** Allow Aether components to be exported as standard custom elements, usable without the framework.

**Implementation:**
- Use a compiler directive: if component file contains `// @aether customElement 'my-counter'`, the compiler generates an additional wrapper class.
- The custom element class extends `HTMLElement`, and in `connectedCallback`:
  - Create a shadow root (optional) or use light DOM.
  - Execute the component function (which returns a DOM node) and append it.
  - Use the framework's signals and effect system, but running within the element's lifecycle. Resumability inside a custom element is not required for static export; the element always runs on client. For SSR of custom elements, we can support declarative shadow DOM.
- The compiler also generates a dedicated client bundle for the custom element that includes the component and the minimal signal runtime.
- This package will be a separate consumer.

**Test Plan:**
- Create a custom element and embed in a plain HTML page; verify it mounts and is reactive.

---

## Additional Global Details

### Event Handler Code Splitting
The compiler must split each event handler into its own chunk, with a deterministic naming scheme. The build tool (e.g., `vite` or custom bundler) will be responsible for this, but the compiler already indicates which functions are handlers and which signals they depend on.

### State Serialization Constraints
All state values must be JSON-serializable (strings, numbers, booleans, null, arrays, objects). Complex objects like Date, Map, Set are not supported initially. Signals holding non-serializable values will throw during SSR.

### Bundling and Development Environment
We'll provide a `@aether/cli` that wraps Vite with the compiler plugin, dev server, and SSR support. However, the spec focuses on the framework internals; the CLI can be built after Phase 3.

---

## Agent Execution Instructions (Reiterated)

1. Begin with Phase 0 (Signals). Implement exactly as specified.
2. Then Phase 1 (Compiler with updated binding calls). Write comprehensive tests.
3. Phase 2: SSR with serialization. Integrate with the modified compiler.
4. Phase 3: Client resumer; test full interactivity.
5. Phase 4: Routing with View Transitions.
6. Phase 5 & 6: CSS and Custom Elements.

At each phase, verify tests pass before proceeding. If any test fails, debug and fix. Maintain clean separation of packages.

---

This expanded specification fills every gap. An AI coding agent following it step by step, with the given constraints, will produce a fully functional AetherJS framework that embodies the next decade's frontend architecture. I've remained faithful to your original design while providing the necessary rigor for machine-executable implementation.
