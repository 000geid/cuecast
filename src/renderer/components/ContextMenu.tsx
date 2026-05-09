import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  x: number;
  y: number;
  onAssign: () => void;
  onClear: () => void;
  onSetHotkey: () => void;
  onEdit: () => void;
};

export const ContextMenu: React.FC<Props> = ({ x, y, onAssign, onClear, onSetHotkey, onEdit }) => {
  const { t } = useTranslation();

  return (
    <div
      id="context-menu"
      className="context-menu"
      style={{ left: x, top: y, position: 'fixed' }}
    >
      <div className="context-menu-item" onClick={onAssign}>{t('contextMenu.assignAudio')}</div>
      <div className="context-menu-item" onClick={onEdit}>{t('contextMenu.editDetails')}</div>
      <div className="context-menu-item" onClick={onClear}>{t('contextMenu.clear')}</div>
      <div className="context-menu-item" onClick={onSetHotkey}>{t('contextMenu.setHotkey')}</div>
    </div>
  );
};
