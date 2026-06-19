import '@noopjs/client';
import App from './App.noop';

const root = document.getElementById('root');
if (root) {
  root.innerHTML = '';
  root.appendChild(App());
}
