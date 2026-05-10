import React from 'react';
import { Power, Settings2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  audioOutputs: MediaDeviceInfo[];
  outputDeviceId: string | null;
  hotkeysArmed: boolean;
  status: string;
  onStopAll: () => void;
  onOutputChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onToggleSettings: () => void;
};

export const ControlRail: React.FC<Props> = ({
  audioOutputs,
  outputDeviceId,
  hotkeysArmed,
  status,
  onStopAll,
  onOutputChange,
  onToggleSettings
}) => {
  const { t } = useTranslation();

  return (
    <header className="control-rail">
      {/* ... */}
      <div className="rail-controls">
        <button
          className="transport-stop control-action"
          onClick={onStopAll}
          title={t('controlRail.stopAllTitle')}
          aria-keyshortcuts="Space"
        >
          <span className="button-icon-wrap" aria-hidden="true">
            <Square className="button-icon" strokeWidth={2.4} />
          </span>
          <span className="button-label">{t('controlRail.stopAll')}</span>
        </button>

        <button type="button" className="secondary-action control-action" onClick={onToggleSettings}>
          <span className="button-icon-wrap" aria-hidden="true">
            <Settings2 className="button-icon" strokeWidth={2.2} />
          </span>
          <span className="button-label">{t('settings.title')}</span>
        </button>

        <div className={`hotkey-state-indicator ${hotkeysArmed ? 'is-armed' : 'is-disarmed'}`}>
          <span className="hotkey-state-icon" aria-hidden="true">
            <Power className="button-icon" strokeWidth={2.2} />
          </span>
          <span className="hotkey-state-copy">
            <strong>{t('controlRail.hotkeysLabel')}</strong>
            <span>{t(hotkeysArmed ? 'controlRail.armed' : 'controlRail.disarmed')}</span>
          </span>
        </div>
      </div>
    </header>
  );
};
