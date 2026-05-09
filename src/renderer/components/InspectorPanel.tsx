import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ButtonConfig } from '../../common/types';
import { Settings } from './Settings';

export type RecentAudioEntry = {
  path: string;
  label: string;
};

type CueDraft = {
  label: string;
  filePath: string | null;
  gain: number;
};

type EventItem = {
  id: number;
  text: string;
};

type Props = {
  showSettings: boolean;
  selectedIndex: number | null;
  selectedButton: ButtonConfig | null;
  draft: CueDraft;
  hotkey: string;
  outputDeviceLabel: string;
  status: string;
  events: EventItem[];
  recentAudio: RecentAudioEntry[];
  hasUnsavedChanges: boolean;
  onClearSelection: () => void;
  onDraftChange: (next: CueDraft) => void;
  onChooseFile: () => void;
  onSave: () => void;
  onClearButton: () => void;
  onOpenHotkeyModal: () => void;
  onClearHotkey: () => void;
  onTriggerSelected: () => void;
  onAssignRecent: (path: string) => void;
};

export const InspectorPanel: React.FC<Props> = ({
  showSettings,
  selectedIndex,
  selectedButton,
  draft,
  hotkey,
  outputDeviceLabel,
  status,
  events,
  recentAudio,
  hasUnsavedChanges,
  onClearSelection,
  onDraftChange,
  onChooseFile,
  onSave,
  onClearButton,
  onOpenHotkeyModal,
  onClearHotkey,
  onTriggerSelected,
  onAssignRecent
}) => {
  const { t } = useTranslation();
  const isCueSelected = selectedIndex !== null && selectedButton !== null;

  return (
    <aside className="inspector-panel">
      <div className="inspector-header">
        <p className="section-kicker">{t('inspector.kicker')}</p>
        <h2>
          {showSettings
            ? t('settings.title')
            : isCueSelected
            ? t('inspector.cueNumber', { number: selectedIndex! + 1 })
            : t('inspector.deckOverview')}
        </h2>
        {showSettings ? null : (
          <p>{isCueSelected ? t('inspector.editDescription') : t('inspector.overviewDescription')}</p>
        )}
        {isCueSelected ? (
          <button type="button" className="secondary-action inspector-reset" onClick={onClearSelection}>
            {t('inspector.backToDeck')}
          </button>
        ) : null}
      </div>

      {showSettings ? (
        <section className="inspector-card">
          <Settings />
        </section>
      ) : isCueSelected ? (
        <>
          <section className="inspector-card">
            <div className="card-heading">
              <h3>{t('inspector.cueDetails')}</h3>
              <span className={`save-state ${hasUnsavedChanges ? 'is-dirty' : ''}`}>
                {hasUnsavedChanges ? t('inspector.pendingChanges') : t('inspector.saved')}
              </span>
            </div>

            <label className="inspector-field">
              <span>{t('inspector.label')}</span>
              <input
                value={draft.label}
                onChange={(event) => onDraftChange({ ...draft, label: event.target.value })}
                placeholder={t('inspector.labelPlaceholder')}
              />
            </label>

            <div className="inspector-field">
              <span>{t('inspector.audioFile')}</span>
              <div className="file-summary">
                <strong>{draft.filePath ? summarizePath(draft.filePath) : t('inspector.noFileAssigned')}</strong>
                <small>{draft.filePath || t('inspector.chooseFileHint')}</small>
              </div>
              <button type="button" className="secondary-action" onClick={onChooseFile}>
                {draft.filePath ? t('inspector.replaceFile') : t('inspector.chooseFile')}
              </button>
            </div>

            <label className="inspector-field">
              <span>{t('inspector.gain')}</span>
              <div className="gain-field">
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="1"
                  value={Math.round(draft.gain * 100)}
                  onChange={(event) => onDraftChange({ ...draft, gain: Number(event.target.value) / 100 })}
                />
                <strong>{Math.round(draft.gain * 100)}%</strong>
              </div>
            </label>

            <div className="inspector-actions">
              <button type="button" className="primary-action" onClick={onSave}>
                {t('inspector.saveCue')}
              </button>
              <button type="button" className="secondary-action" onClick={onTriggerSelected}>
                {t('inspector.fireCue')}
              </button>
              <button type="button" className="danger-action" onClick={onClearButton}>
                {t('inspector.clearCue')}
              </button>
            </div>
          </section>

          <section className="inspector-card">
            <div className="card-heading">
              <h3>{t('inspector.hotkey')}</h3>
              <span className="signal-chip">{hotkey || t('inspector.unassigned')}</span>
            </div>
            <div className="inspector-actions">
              <button type="button" className="secondary-action" onClick={onOpenHotkeyModal}>
                {hotkey ? t('inspector.changeHotkey') : t('inspector.setHotkey')}
              </button>
              <button type="button" className="secondary-action" onClick={onClearHotkey}>
                {t('inspector.clearHotkey')}
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="inspector-card">
            <div className="card-heading">
              <h3>{t('inspector.routing')}</h3>
              <span className="signal-chip">{t('inspector.liveOutput')}</span>
            </div>
            <p className="overview-line">{outputDeviceLabel}</p>
            <p className="overview-line">{t('inspector.stopHint')}</p>
          </section>

          <section className="inspector-card">
            <div className="card-heading">
              <h3>{t('inspector.statusFeed')}</h3>
              <span className="save-state">{status}</span>
            </div>
            <div className="event-feed">
              {events.map((event) => (
                <p key={event.id}>{event.text}</p>
              ))}
            </div>
          </section>
        </>
      )}

      {showSettings ? null : (
        <>
          <section className="inspector-card">
            <div className="card-heading">
              <h3>{t('inspector.recentAudio')}</h3>
              <span className="save-state">{t('inspector.session')}</span>
            </div>
            <div className="recent-audio-list">
              {recentAudio.length ? (
                recentAudio.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    className="recent-audio-chip"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/cuecast-audio-path', entry.path);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAssignRecent(entry.path)}
                    title={entry.path}
                  >
                    <strong>{entry.label}</strong>
                    <span>{entry.path}</span>
                  </button>
                ))
              ) : (
                <p className="empty-copy">{t('inspector.emptyRecent')}</p>
              )}
            </div>
          </section>

          <section className="inspector-card placeholder-card">
            <div className="card-heading">
              <h3>{t('inspector.nextUp')}</h3>
              <span className="save-state">{t('inspector.reserved')}</span>
            </div>
            <p className="overview-line">{t('inspector.nextUpDescription')}</p>
          </section>
        </>
      )}
    </aside>
  );
};

function summarizePath(filePath: string | null): string {
  if (!filePath) return '';
  const segment = filePath.split(/[\\/]/).pop();
  return segment || filePath;
}
