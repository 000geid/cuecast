import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, ElectronAPI, LogLevel } from '../common/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  
  updateConfig: (config: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke('update-config', config),
  
  selectAudioFile: (): Promise<string | null> => ipcRenderer.invoke('select-audio-file'),
  
  getAudioDevices: (): Promise<MediaDeviceInfo[]> => ipcRenderer.invoke('get-audio-devices'),
  
  onTriggerButton: (callback: (buttonIndex: number) => void): void => {
    ipcRenderer.on('trigger-button', (event, buttonIndex: number) => callback(buttonIndex));
  },
  
  removeTriggerButtonListener: (): void => {
    ipcRenderer.removeAllListeners('trigger-button');
  },
  
  log: (level: LogLevel, message: string, meta?: any): void => {
    ipcRenderer.send('log', { level, message, meta });
  }
} as ElectronAPI);
