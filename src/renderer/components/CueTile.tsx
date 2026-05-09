import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ButtonConfig } from '../../common/types';
import type { CueLoadState } from '../hooks/useAudio';

type Props = {
  button: ButtonConfig;
  hotkey: string;
  index: number;
  isPlaying: boolean;
  isSelected: boolean;
  loadState: CueLoadState;
  onTrigger: () => void;
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent, index: number) => void;
  onDropAudio: (index: number, dataTransfer: DataTransfer | null) => void;
};

const STATE_KEYS: Record<string, string> = {
  Empty: 'cueTile.stateEmpty',
  Ready: 'cueTile.stateReady',
  Error: 'cueTile.stateError',
  Arming: 'cueTile.stateArming'
};

export const CueTile: React.FC<Props> = ({
  button,
  hotkey,
  index,
  isPlaying,
  isSelected,
  loadState,
  onTrigger,
  onSelect,
  onContextMenu,
  onDropAudio
}) => {
  const { t } = useTranslation();

  const rawState =
    !button.path ? 'Empty' :
    loadState === 'ready' ? 'Ready' :
    loadState === 'error' ? 'Error' :
    'Arming';
  const cueState = t(STATE_KEYS[rawState]);

  return (
    <article
      className={`cue-tile ${button.path ? '' : 'is-empty'} ${isPlaying ? 'is-playing' : ''} ${isSelected ? 'is-selected' : ''} ${loadState === 'loading' ? 'is-loading' : ''} ${loadState === 'error' ? 'has-error' : ''}`}
      onContextMenu={(event) => onContextMenu(event, index)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropAudio(index, event.dataTransfer);
      }}
    >
      <button
        type="button"
        className="cue-trigger"
        onClick={onTrigger}
        onFocus={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onTrigger();
          }
        }}
      >
        <div className="cue-meta">
          <span className="cue-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="cue-hotkey">{hotkey || t('cueTile.noHotkey')}</span>
        </div>
        <div className="cue-copy">
          <strong>{button.label}</strong>
          <span>{button.path ? formatPath(button.path) : t('cueTile.dropAudio')}</span>
        </div>
        <div className="cue-footer">
          <span className="cue-state">{cueState}</span>
          <span className="cue-gain">{t('cueTile.gain')} {Math.round(button.gain * 100)}%</span>
        </div>
      </button>

      <button type="button" className="cue-inspect" onClick={onSelect} aria-label={t('cueTile.inspectLabel', { index: index + 1 })}>
        {t('cueTile.inspect')}
      </button>
    </article>
  );
};

function formatPath(filePath: string): string {
  const segment = filePath.split(/[\\/]/).pop();
  return segment || filePath;
}
