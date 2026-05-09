import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }
] as const;

export const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleChange = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('cuecast-language', lng);
  };

  return (
    <div className="settings-panel">
      <label className="inspector-field">
        <span>{t('settings.language')}</span>
        <select
          value={i18n.language}
          onChange={(e) => handleChange(e.target.value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
