import type { ThemePreference } from './settings-types';

export function applyThemePreference(preference: ThemePreference): () => void {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: light)');

  const apply = () => {
    root.dataset.theme = preference === 'system' ? (media.matches ? 'light' : 'dark') : preference;
  };
  const onChange = () => {
    if (preference === 'system') apply();
  };

  apply();
  media.addEventListener?.('change', onChange);
  return () => media.removeEventListener?.('change', onChange);
}
