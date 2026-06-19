import { renderToString } from '@noopjs/server';
import Counter from './main.noop';

export function render() {
  return renderToString(Counter);
}
