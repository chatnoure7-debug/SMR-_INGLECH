import { state } from './store';

export function applyTheme(): void {
  const { theme, accent } = state.settings;
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const eff = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = eff;
  document.documentElement.dataset.accent = accent;
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = eff === 'light' ? '#f4f6fb' : eff === 'black' ? '#000000' : '#0b1020';
  meta?.setAttribute('content', bg);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
