import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, ElectronAPI, LogLevel, HotkeyRegistrationResult, LogSettings } from '../common/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  
  updateConfig: (config: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke('update-config', config),
  
  selectAudioFile: (): Promise<string | null> => ipcRenderer.invoke('select-audio-file'),
  
  getAudioDevices: (): Promise<MediaDeviceInfo[]> => ipcRenderer.invoke('get-audio-devices'),
  
  readFileBytes: (path: string): Promise<ArrayBuffer> => ipcRenderer.invoke('read-file-bytes', path),

  setHotkeysEnabled: (enabled: boolean): void => {
    ipcRenderer.send('set-hotkeys-enabled', enabled);
  },
  
  onTriggerButton: (callback: (buttonIndex: number) => void): void => {
    ipcRenderer.on('trigger-button', (event, buttonIndex: number) => callback(buttonIndex));
  },
  
  removeTriggerButtonListener: (): void => {
    ipcRenderer.removeAllListeners('trigger-button');
  },
  
  log: (level: LogLevel, message: string, meta?: any): void => {
    ipcRenderer.send('log', { level, message, meta });
  },

  onHotkeysRegistered: (callback: (results: HotkeyRegistrationResult[]) => void): void => {
    ipcRenderer.on('hotkeys-registered', (_e, results: HotkeyRegistrationResult[]) => callback(results));
  },

  getLogSettings: (): Promise<LogSettings> => ipcRenderer.invoke('get-log-settings'),
  setLogSettings: (settings: LogSettings): Promise<LogSettings> => ipcRenderer.invoke('set-log-settings', settings)
} as ElectronAPI);
