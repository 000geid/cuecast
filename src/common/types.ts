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

export type SetButtonHotkeyResult =
  | {
      ok: true;
      config: AppConfig;
      accelerator: string;
    }
  | {
      ok: false;
      reason: 'conflict';
      conflictButtonIndex: number;
      accelerator: string;
    };

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  assignButtonAudio: (input: { buttonIndex: number; filePath: string }) => Promise<AppConfig>;
  updateButtonDetails: (input: { buttonIndex: number; label: string; filePath: string | null }) => Promise<AppConfig>;
  clearButton: (input: { buttonIndex: number }) => Promise<AppConfig>;
  clearButtonHotkey: (input: { buttonIndex: number }) => Promise<AppConfig>;
  setButtonHotkey: (input: { buttonIndex: number; accelerator: string }) => Promise<SetButtonHotkeyResult>;
  setOutputDevice: (input: { deviceId: string | null }) => Promise<AppConfig>;
  selectAudioFile: () => Promise<string | null>;
  readFileBytes: (path: string) => Promise<ArrayBuffer>;
  setHotkeysEnabled: (enabled: boolean) => void;
  onTriggerButton: (callback: (buttonIndex: number) => void) => () => void;
  log: (level: LogLevel, message: string, meta?: any) => void;
  onHotkeysRegistered: (callback: (results: HotkeyRegistrationResult[]) => void) => () => void;
  getLogSettings: () => Promise<LogSettings>;
  setLogSettings: (settings: LogSettings) => Promise<LogSettings>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
