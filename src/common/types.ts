export interface ButtonConfig {
  label: string;
  path: string | null;
  gain: number;
}

export interface AppConfig {
  buttons: ButtonConfig[];
  hotkeys: { [key: string]: number };
  outputDeviceId: string | null;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  updateConfig: (config: Partial<AppConfig>) => Promise<AppConfig>;
  selectAudioFile: () => Promise<string | null>;
  getAudioDevices: () => Promise<MediaDeviceInfo[]>;
  onTriggerButton: (callback: (buttonIndex: number) => void) => void;
  removeTriggerButtonListener: () => void;
  log: (level: LogLevel, message: string, meta?: any) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
