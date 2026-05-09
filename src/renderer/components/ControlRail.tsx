import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from './Settings';

type Props = {
  audioOutputs: MediaDeviceInfo[];
  outputDeviceId: string | null;
  status: string;
  onStopAll: () => void;
  onOutputChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onToggleSettings: () => void;
};

export const ControlRail: React.FC<Props> = ({
  audioOutputs,
  outputDeviceId,
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
        {/* ... */}
        <button
          className="transport-stop"
          onClick={onStopAll}
          title={t('controlRail.stopAllTitle')}
          aria-keyshortcuts="Space"
        >
          {t('controlRail.stopAll')}
        </button>

        <button type="button" className="secondary-action" onClick={onToggleSettings}>
          {t('settings.title')}
        </button>
      </div>
    </header>
  );
};
