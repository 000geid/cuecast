import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ButtonConfig } from '../../common/types';
import { CueTile } from './CueTile';
import type { CueLoadState } from '../hooks/useAudio';

type Props = {
  buttons: ButtonConfig[];
  selectedIndex: number | null;
  playingIndex: number | null;
  loadStateFor: (index: number) => CueLoadState;
  assignedHotkey: (index: number) => string;
  onTrigger: (index: number) => void;
  onSelect: (index: number) => void;
  onContextMenu: (event: React.MouseEvent, index: number) => void;
  onDropAudio: (index: number, dataTransfer: DataTransfer | null) => void;
};

export const CueDeck: React.FC<Props> = ({
  buttons,
  selectedIndex,
  playingIndex,
  loadStateFor,
  assignedHotkey,
  onTrigger,
  onSelect,
  onContextMenu,
  onDropAudio
}) => {
  const { t } = useTranslation();

  return (
    <section className="deck-shell">
      <div className="deck-heading">
        <div>
          <p className="section-kicker">{t('deck.kicker')}</p>
          <h2>{t('deck.title')}</h2>
        </div>
        <p className="deck-caption">{t('deck.caption')}</p>
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
