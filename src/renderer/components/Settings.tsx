import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme, resolveStoredTheme, THEME_OPTIONS, THEME_STORAGE_KEY, type ThemeName } from '../lib/theme';

const LANGUAGES = [
  { value: 'en', labelKey: 'settings.languages.en' },
  { value: 'es', labelKey: 'settings.languages.es' }
] as const;

export const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<ThemeName>(() => resolveStoredTheme(window.localStorage));
  const languageOptions = LANGUAGES.map((entry) => ({ value: entry.value, label: t(entry.labelKey) }));
  const themeOptions = THEME_OPTIONS.map((entry) => ({ value: entry.value, label: t(entry.labelKey) }));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleChange = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('cuecast-language', lng);
  };

  const handleThemeChange = (nextTheme: ThemeName) => {
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <div className="settings-panel">
      <SettingsSelect
        label={t('settings.language')}
        value={i18n.language}
        options={languageOptions}
        onChange={handleChange}
      />

      <SettingsSelect
        label={t('settings.theme')}
        value={theme}
        options={themeOptions}
        onChange={(nextTheme) => handleThemeChange(nextTheme as ThemeName)}
      />
    </div>
  );
};

type SettingsOption<T extends string> = {
  value: T;
  label: string;
};

type SettingsSelectProps<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<SettingsOption<T>>;
  onChange: (nextValue: T) => void;
};

function SettingsSelect<T extends string>({ label, value, options, onChange }: SettingsSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const fieldId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <label className="inspector-field settings-field">
      <span id={fieldId}>{label}</span>
      <div ref={rootRef} className={`settings-select-wrap ${open ? 'is-open' : ''}`}>
        <button
          type="button"
          className={`settings-select settings-select-trigger ${open ? 'is-open' : ''}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={fieldId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selectedOption.label}</span>
        </button>

        {open ? (
          <div className="settings-dropdown" role="listbox" aria-labelledby={fieldId}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`settings-dropdown-option ${option.value === value ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}
