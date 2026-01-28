import React, { useState } from 'react';
import type { ElectronAPI } from '../../common/types';

declare global { interface Window { electronAPI: ElectronAPI } }

type Props = {
  initialTitle: string;
  initialPath: string | null;
  onSave: (title: string, path: string | null) => void;
  onCancel: () => void;
};

export const EditButtonModal: React.FC<Props> = ({ initialTitle, initialPath, onSave, onCancel }) => {
  const [title, setTitle] = useState(initialTitle || '');
  const [filePath, setFilePath] = useState<string | null>(initialPath);

  const chooseFile = async () => {
    const p = await window.electronAPI.selectAudioFile();
    if (p) setFilePath(p);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" tabIndex={0}>
      <div className="modal-content">
        <h3>Edit Button</h3>
        <div className="form-field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Button title" />
        </div>
        <div className="form-field">
          <label>Audio File</label>
          <div className="file-row">
            <span className="file-path" title={filePath || ''}>{filePath || 'No file selected'}</span>
            <button onClick={chooseFile}>Change file</button>
          </div>
        </div>
        <div className="modal-buttons">
          <button onClick={onCancel}>Cancel</button>
          <button id="edit-save" onClick={() => onSave(title.trim() || 'Untitled', filePath)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

