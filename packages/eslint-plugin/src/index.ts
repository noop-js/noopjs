import * as noModuleLevelSignal from './rules/no-module-level-signal.js';
import * as noDynamicInResume from './rules/no-dynamic-in-resume.js';
import * as requireKeyInMap from './rules/require-key-in-map.js';
import * as noDangerousHtml from './rules/no-dangerous-html.js';

const plugin = {
  rules: {
    'no-module-level-signal': noModuleLevelSignal.rule,
    'no-dynamic-in-resume': noDynamicInResume.rule,
    'require-key-in-map': requireKeyInMap.rule,
    'no-dangerous-html': noDangerousHtml.rule,
  },
  configs: {
    recommended: {
      plugins: ['@noopjs'],
      rules: {
        '@noopjs/no-module-level-signal': 'error',
        '@noopjs/no-dynamic-in-resume': 'warn',
        '@noopjs/require-key-in-map': 'warn',
        '@noopjs/no-dangerous-html': 'warn',
      },
    },
  },
};

export default plugin;
