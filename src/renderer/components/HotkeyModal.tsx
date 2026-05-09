import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  onSave: (accelerator: string) => void;
  onCancel: () => void;
};

export const HotkeyModal: React.FC<Props> = ({ onSave, onCancel }) => {
  const { t } = useTranslation();
  const [hotkeyText, setHotkeyText] = useState('');

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    if (['Control','Meta','Alt','Shift'].includes(e.key)) return;
    const mods: string[] = [];
    if (e.ctrlKey || e.metaKey) mods.push('CommandOrControl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.startsWith('Arrow')) key = key.replace('Arrow','');
    if (key === 'Escape') key = 'Escape';
    const isFn = /^F\d{1,2}$/.test(key);
    const isChar = key.length === 1;
    if (mods.length || isFn || isChar) {
      const acc = mods.length ? `${mods.join('+')}+${isChar ? key.toUpperCase() : key}` : (isChar ? key.toUpperCase() : key);
      setHotkeyText(acc);
    }
  }, []);

  return (
    <div id="hotkey-modal" className="modal" role="dialog" aria-modal="true" tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="modal-content">
        <h3>{t('hotkeyModal.title')}</h3>
        <p>{t('hotkeyModal.instructions')}</p>
        <div id="hotkey-display" className="hotkey-display">{hotkeyText || t('hotkeyModal.placeholder')}</div>
        <div className="modal-buttons">
          <button id="hotkey-cancel" onClick={onCancel}>{t('hotkeyModal.cancel')}</button>
          <button id="hotkey-save" disabled={!hotkeyText} onClick={() => onSave(hotkeyText)}>{t('hotkeyModal.save')}</button>
        </div>
      </div>
    </div>
  );
};
