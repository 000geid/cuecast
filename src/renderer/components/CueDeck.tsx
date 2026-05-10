import React from 'react';
import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ButtonConfig } from '../../common/types';
import { CueTile } from './CueTile';
import type { CueLoadState } from '../hooks/useAudio';

type Props = {
  buttons: ButtonConfig[];
  isArmed: boolean;
  selectedIndex: number | null;
  playingIndex: number | null;
  loadStateFor: (index: number) => CueLoadState;
  assignedHotkey: (index: number) => string;
  onArm: () => void;
  onDisarm: () => void;
  onTrigger: (index: number) => void;
  onSelect: (index: number) => void;
  onContextMenu: (event: React.MouseEvent, index: number) => void;
  onDropAudio: (index: number, dataTransfer: DataTransfer | null) => void;
};

export const CueDeck: React.FC<Props> = ({
  buttons,
  isArmed,
  selectedIndex,
  playingIndex,
  loadStateFor,
  assignedHotkey,
  onArm,
  onDisarm,
  onTrigger,
  onSelect,
  onContextMenu,
  onDropAudio
}) => {
  const { t } = useTranslation();

  return (
    <section
      className={`deck-shell ${isArmed ? 'is-armed' : ''}`}
      onFocusCapture={onArm}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextTarget)) {
          onDisarm();
        }
      }}
    >
      <div className="deck-heading">
        <div>
          <p className="section-kicker">{t('deck.kicker')}</p>
          <h2>{t('deck.title')}</h2>
        </div>
        <div className="deck-heading-copy">
          <span className={`${isArmed ? 'signal-chip' : 'save-state'} deck-status`}>{t(isArmed ? 'deck.hotkeysArmed' : 'deck.hotkeysIdle')}</span>
          <button
            type="button"
            className={`secondary-action control-action deck-arm-button ${isArmed ? 'is-active' : ''}`}
            onClick={isArmed ? onDisarm : onArm}
            aria-pressed={isArmed}
          >
            <span className="button-icon-wrap" aria-hidden="true">
              <Keyboard className="button-icon" strokeWidth={2.2} />
            </span>
            <span className="button-label">{t(isArmed ? 'deck.armButtonActive' : 'deck.armButtonIdle')}</span>
          </button>
          <p className="deck-caption">{t(isArmed ? 'deck.captionArmed' : 'deck.captionIdle')}</p>
        </div>
      </div>

      <div className="cue-grid">
        {buttons.map((button, index) => (
          <CueTile
            key={index}
            button={button}
            hotkey={assignedHotkey(index)}
            index={index}
            isPlaying={playingIndex === index}
            isSelected={selectedIndex === index}
            loadState={loadStateFor(index)}
            onTrigger={() => onTrigger(index)}
            onSelect={() => onSelect(index)}
            onContextMenu={onContextMenu}
            onDropAudio={onDropAudio}
          />
        ))}
      </div>
    </section>
  );
};
