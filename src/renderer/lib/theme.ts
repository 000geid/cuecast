export const THEME_STORAGE_KEY = 'cuecast-theme';

export const THEME_OPTIONS = [
  { value: 'cuecast', labelKey: 'settings.themes.cuecast' },
  { value: 'frappe', labelKey: 'settings.themes.frappe' },
  { value: 'atom-one', labelKey: 'settings.themes.atomOne' }
] as const;

export type ThemeName = (typeof THEME_OPTIONS)[number]['value'];

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return THEME_OPTIONS.some((theme) => theme.value === value);
}

export function resolveStoredTheme(storage?: Storage): ThemeName {
  if (!storage) {
    return 'cuecast';
  }

  const storedTheme = storage.getItem(THEME_STORAGE_KEY);
  return isThemeName(storedTheme) ? storedTheme : 'cuecast';
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = 'dark';
}