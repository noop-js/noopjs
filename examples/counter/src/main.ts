import '@noopjs/client';
import Counter from './main.noop';

// Client-rendered mode: mount the component.
const root = document.getElementById('root');
if (root) {
  root.innerHTML = '';
  root.appendChild(Counter());
}
