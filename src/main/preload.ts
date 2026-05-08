import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, ElectronAPI, HotkeyRegistrationResult, LogLevel, LogSettings, SetButtonHotkeyResult } from '../common/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),

  assignButtonAudio: (input: { buttonIndex: number; filePath: string }): Promise<AppConfig> => ipcRenderer.invoke('assign-button-audio', input),

  updateButtonDetails: (input: { buttonIndex: number; label: string; filePath: string | null }): Promise<AppConfig> =>
    ipcRenderer.invoke('update-button-details', input),

  clearButton: (input: { buttonIndex: number }): Promise<AppConfig> => ipcRenderer.invoke('clear-button', input),

  clearButtonHotkey: (input: { buttonIndex: number }): Promise<AppConfig> => ipcRenderer.invoke('clear-button-hotkey', input),

  setButtonHotkey: (input: { buttonIndex: number; accelerator: string }): Promise<SetButtonHotkeyResult> =>
    ipcRenderer.invoke('set-button-hotkey', input),

  setOutputDevice: (input: { deviceId: string | null }): Promise<AppConfig> => ipcRenderer.invoke('set-output-device', input),

  selectAudioFile: (): Promise<string | null> => ipcRenderer.invoke('select-audio-file'),

  readFileBytes: (path: string): Promise<ArrayBuffer> => ipcRenderer.invoke('read-file-bytes', path),

  setHotkeysEnabled: (enabled: boolean): void => {
    ipcRenderer.send('set-hotkeys-enabled', enabled);
  },

  onTriggerButton: (callback: (buttonIndex: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, buttonIndex: number) => callback(buttonIndex);
    ipcRenderer.on('trigger-button', listener);
    return () => ipcRenderer.removeListener('trigger-button', listener);
  },

  log: (level: LogLevel, message: string, meta?: any): void => {
    ipcRenderer.send('log', { level, message, meta });
  },

  onHotkeysRegistered: (callback: (results: HotkeyRegistrationResult[]) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, results: HotkeyRegistrationResult[]) => callback(results);
    ipcRenderer.on('hotkeys-registered', listener);
    return () => ipcRenderer.removeListener('hotkeys-registered', listener);
  },

  getLogSettings: (): Promise<LogSettings> => ipcRenderer.invoke('get-log-settings'),
  setLogSettings: (settings: LogSettings): Promise<LogSettings> => ipcRenderer.invoke('set-log-settings', settings)
} as ElectronAPI);
