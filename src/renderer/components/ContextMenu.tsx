import React from 'react';

type Props = {
  x: number;
  y: number;
  onAssign: () => void;
  onClear: () => void;
  onSetHotkey: () => void;
  onEdit: () => void;
};

export const ContextMenu: React.FC<Props> = ({ x, y, onAssign, onClear, onSetHotkey, onEdit }) => {
  return (
    <div
      id="context-menu"
      className="context-menu"
      style={{ left: x, top: y, position: 'fixed' }}
    >
      <div className="context-menu-item" onClick={onAssign}>Assign Audio File</div>
      <div className="context-menu-item" onClick={onEdit}>Edit Details</div>
      <div className="context-menu-item" onClick={onClear}>Clear</div>
      <div className="context-menu-item" onClick={onSetHotkey}>Set Hotkey</div>
    </div>
  );
};
