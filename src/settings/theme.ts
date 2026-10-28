import type { AccentTheme, ThemePreference } from './settings-types';

export function applyAccentTheme(preference: AccentTheme): void {
  document.documentElement.dataset.scheme = preference;
}

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
