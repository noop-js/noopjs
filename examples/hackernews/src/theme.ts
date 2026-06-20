import { signal, effect } from '@noopjs/signals';

export var theme = signal(
  typeof document !== 'undefined' && typeof localStorage !== 'undefined'
    ? (localStorage.getItem('hn-theme') || 'light')
    : 'light'
);

if (typeof document !== 'undefined') {
  effect(function() {
    var t = theme.get();
    document.documentElement.setAttribute('data-theme', t);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hn-theme', t);
    }
  });
}
