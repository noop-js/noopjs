import { TokenResolver } from './index';

/**
 * Tailwind v4 CSS property → utility class prefix mapping.
 *
 * Maps standard CSS properties to their Tailwind utility prefix.
 * E.g., `padding` → `p`, `margin-top` → `mt`, `gap` → `gap`.
 */
const PROP_TO_PREFIX: Record<string, string> = {
  padding: 'p',
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  'padding-block': 'py',
  'padding-inline': 'px',
  margin: 'm',
  'margin-top': 'mt',
  'margin-right': 'mr',
  'margin-bottom': 'mb',
  'margin-left': 'ml',
  'margin-block': 'my',
  'margin-inline': 'mx',
  gap: 'gap',
  'column-gap': 'gap-x',
  'row-gap': 'gap-y',
  width: 'w',
  height: 'h',
  'min-width': 'min-w',
  'min-height': 'min-h',
  'max-width': 'max-w',
  'max-height': 'max-h',
  'border-radius': 'rounded',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
  'outline-width': 'outline',
  'outline-offset': 'outline-offset',
};

/**
 * Valid Tailwind spacing scale keys.
 * Maps `0` through `96` plus special keys like `px`, `0.5`.
 */
const SPACING_KEYS = new Set([
  '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5',
  '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16',
  '20', '24', '28', '32', '36', '40', '44', '48', '52', '56',
  '60', '64', '72', '80', '96', 'px',
]);

/**
 * Tailwind named color scale keys.
 */
const COLOR_KEYS = new Set([
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange',
  'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink',
  'rose', 'mauve', 'olive', 'mist', 'taupe',
  'white', 'black', 'transparent', 'current', 'inherit',
]);

/**
 * Create a TokenResolver for Tailwind CSS v4.x.
 *
 * Resolves `token.spacing.<key>` → Tailwind spacing utility classes
 * (e.g., `token.spacing.4` + `padding` → `p-4`).
 */
export function createTailwindResolver(): TokenResolver {
  return {
    name: 'tailwind',
    resolve(prop: string, value: string): string | null {
      const tokenMatch = value.match(/^token\.(\w+)\.(.+)$/);
      if (!tokenMatch) return null;

      const namespace = tokenMatch[1];
      const key = tokenMatch[2];

      if (namespace === 'spacing') {
        if (!SPACING_KEYS.has(key)) return null;
        const prefix = PROP_TO_PREFIX[prop];
        if (!prefix) return null;
        return `${prefix}-${key}`;
      }

      if (namespace === 'color') {
        // token.color.blue.500 → needs multi-level extraction
        // value is like "token.color.blue.500" which parsed as ns="color", key="blue.500"
        return resolveColor(prop, key);
      }

      return null;
    },
  };
}

function resolveColor(prop: string, key: string): string | null {
  // key is like "blue.500", "red.100", "white"
  if (prop === 'color') {
    if (COLOR_KEYS.has(key)) return `text-${key}`;
    const [colorName, shade] = key.split('.');
    if (COLOR_KEYS.has(colorName) && shade) {
      return `text-${colorName}-${shade}`;
    }
    return null;
  }

  if (prop === 'background-color' || prop === 'background') {
    if (COLOR_KEYS.has(key)) return `bg-${key}`;
    const [colorName, shade] = key.split('.');
    if (COLOR_KEYS.has(colorName) && shade) {
      return `bg-${colorName}-${shade}`;
    }
    return null;
  }

  if (prop === 'border-color') {
    if (COLOR_KEYS.has(key)) return `border-${key}`;
    const [colorName, shade] = key.split('.');
    if (COLOR_KEYS.has(colorName) && shade) {
      return `border-${colorName}-${shade}`;
    }
    return null;
  }

  // outline-color
  if (prop === 'outline-color') {
    if (COLOR_KEYS.has(key)) return `outline-${key}`;
    const [colorName, shade] = key.split('.');
    if (COLOR_KEYS.has(colorName) && shade) {
      return `outline-${colorName}-${shade}`;
    }
    return null;
  }

  return null;
}
