import { theme } from '../theme.js';

export default function ThemeToggle() {
  return <a href="#" onClick={function(e: Event) { e.preventDefault(); var t = document.documentElement.getAttribute('data-theme'); var n = t === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', n); if (typeof localStorage !== 'undefined') localStorage.setItem('hn-theme', n); this.textContent = t === 'dark' ? '☀️ light' : '🌙 dark'; }} style="font-size:13px;color:var(--text-muted);cursor:pointer">
    {theme.get() === 'dark' ? '☀️ light' : '🌙 dark'}
  </a>;
}

export function getTheme() {
  return theme;
}
