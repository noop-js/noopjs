import { renderToString } from '@noopjs/server';
import App from './App.noop';

export function render() {
  return renderToString(App);
}
