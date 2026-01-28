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

export interface HotkeyRegistrationResult {
  accelerator: string;
  ok: boolean;
}

export interface LogSettings {
  level: LogLevel;
}

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  updateConfig: (config: Partial<AppConfig>) => Promise<AppConfig>;
  selectAudioFile: () => Promise<string | null>;
  getAudioDevices: () => Promise<MediaDeviceInfo[]>;
  readFileBytes: (path: string) => Promise<ArrayBuffer>;
  setHotkeysEnabled: (enabled: boolean) => void;
  onTriggerButton: (callback: (buttonIndex: number) => void) => void;
  removeTriggerButtonListener: () => void;
  log: (level: LogLevel, message: string, meta?: any) => void;
  onHotkeysRegistered: (callback: (results: HotkeyRegistrationResult[]) => void) => void;
  getLogSettings: () => Promise<LogSettings>;
  setLogSettings: (settings: LogSettings) => Promise<LogSettings>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
