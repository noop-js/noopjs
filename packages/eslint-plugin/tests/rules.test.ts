import { describe, it, expect } from 'vitest';
import { RuleTester } from '@typescript-eslint/utils/ts-eslint';
import { rule as noModuleLevelSignal } from '../src/rules/no-module-level-signal.js';
import { rule as noDynamicInResume } from '../src/rules/no-dynamic-in-resume.js';
import { rule as requireKeyInMap } from '../src/rules/require-key-in-map.js';
import { rule as noDangerousHtml } from '../src/rules/no-dangerous-html.js';

const tester = new RuleTester({
  languageOptions: {
    parser: (await import('@typescript-eslint/parser')).default,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

describe('no-module-level-signal', () => {
  tester.run('no-module-level-signal', noModuleLevelSignal, {
    valid: [
      {
        name: 'signal() inside component function',
        code: `
          import { signal } from '@noopjs/signals';
          export default function Counter() {
            const count = signal(0);
            return <div>{count.get()}</div>;
          }
        `,
      },
      {
        name: 'no signal() call at all',
        code: `
          export default function Page() {
            return <div>Hello</div>;
          }
        `,
      },
    ],
    invalid: [
      {
        name: 'signal() at module level',
        code: `
          import { signal } from '@noopjs/signals';
          const count = signal(0);
          export default function Counter() {
            return <div>{count.get()}</div>;
          }
        `,
        errors: [{ messageId: 'moduleLevel' as const }],
      },
    ],
  });
});

describe('no-dynamic-in-resume', () => {
  tester.run('no-dynamic-in-resume', noDynamicInResume, {
    valid: [
      {
        name: 'resume component without .map()',
        code: `
          // client: resume
          import { signal } from '@noopjs/signals';
          export default function UserPage(props: { user: any }) {
            return <div>{props.user.name}</div>;
          }
        `,
      },
      {
        name: 'spa component with .map()',
        code: `
          // client: spa
          import { signal } from '@noopjs/signals';
          export default function ListPage() {
            const items = signal(['a', 'b']);
            return <ul>{items.get().map(item => <li>{item}</li>)}</ul>;
          }
        `,
      },
    ],
    invalid: [
      {
        name: 'resume component with .map()',
        code: `
          // client: resume
          import { signal } from '@noopjs/signals';
          export default function ListPage() {
            const items = signal(['a', 'b']);
            return <ul>{items.get().map(item => <li>{item}</li>)}</ul>;
          }
        `,
        errors: [{ messageId: 'mapInResume' as const }],
      },
      {
        name: 'resume component with ternary JSX',
        code: `
          // client: resume
          import { signal } from '@noopjs/signals';
          export default function Toggle() {
            const show = signal(false);
            return <div>{show.get() ? <span>yes</span> : <span>no</span>}</div>;
          }
        `,
        errors: [{ messageId: 'conditionalInResume' as const }],
      },
      {
        name: 'resume component with logical JSX',
        code: `
          // client: resume
          import { signal } from '@noopjs/signals';
          export default function Show() {
            const show = signal(false);
            return <div>{show.get() && <span>visible</span>}</div>;
          }
        `,
        errors: [{ messageId: 'conditionalInResume' as const }],
      },
    ],
  });
});

describe('require-key-in-map', () => {
  tester.run('require-key-in-map', requireKeyInMap, {
    valid: [
      {
        name: '.map() with key prop',
        code: `
          export default function List() {
            const items = ['a', 'b'];
            return <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;
          }
        `,
      },
    ],
    invalid: [
      {
        name: '.map() without key prop',
        code: `
          export default function List() {
            const items = ['a', 'b'];
            return <ul>{items.map(item => <li>{item}</li>)}</ul>;
          }
        `,
        errors: [{ messageId: 'missingKey' as const }],
      },
    ],
  });
});

describe('no-dangerous-html', () => {
  tester.run('no-dangerous-html', noDangerousHtml, {
    valid: [
      {
        name: 'literal string',
        code: `
          export default function Page() {
            return <div dangerouslySetInnerHTML={{ __html: '<b>safe</b>' }} />;
          }
        `,
      },
    ],
    invalid: [
      {
        name: 'template literal',
        code: `
          export default function Page() {
            const html = '<b>user input</b>';
            return <div dangerouslySetInnerHTML={{ __html: html }} />;
          }
        `,
        errors: [{ messageId: 'dangerous' as const }],
      },
      {
        name: 'binary expression',
        code: `
          export default function Page() {
            const prefix = '<b>';
            return <div dangerouslySetInnerHTML={{ __html: prefix + 'user' + '</b>' }} />;
          }
        `,
        errors: [{ messageId: 'dangerous' as const }],
      },
    ],
  });
});
