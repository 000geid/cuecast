import { app, BrowserWindow, globalShortcut, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AppConfig, ButtonConfig, LogLevel, HotkeyRegistrationResult, LogSettings } from '../common/types';

// ---- Constants & State ----
const CONFIG_FILENAME = 'config.json';
const DEFAULT_BUTTONS_COUNT = 8;

function createDefaultButtons(count: number): ButtonConfig[] {
  return Array.from({ length: count }, () => ({ label: 'Empty', path: null, gain: 1.0 }));
}

let mainWindow: BrowserWindow | null;
let hotkeysSuppressed = false;
let config: AppConfig = {
  buttons: createDefaultButtons(DEFAULT_BUTTONS_COUNT),
  hotkeys: {},
  outputDeviceId: null
};

// ---- Logging ----
// Writes to userData/logs/app.log and conditionally to console
const LOG_LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
let consoleLogLevel: LogLevel = (process.env.CUECAST_LOG_LEVEL as LogLevel) || 'info';
async function writeLog(level: LogLevel, message: string, meta?: any): Promise<void> {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    const logPath = path.join(logsDir, 'app.log');
    await fs.mkdir(logsDir, { recursive: true });
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}` + (meta ? ` | ${JSON.stringify(meta)}` : '') + "\n";
    await fs.appendFile(logPath, line, 'utf8');
  } catch (_e) {
    // ignore file logging errors
  }
  if (LOG_LEVELS[level] >= LOG_LEVELS[consoleLogLevel]) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level}] ${message}`, meta ?? '');
  }
}

// ---- Helpers ----
function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

// ---- Window ----
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'CueCast - Soundboard',
    resizable: true,
    minWidth: 600,
    minHeight: 400
  });

  // Prefer Vite dev server only when explicitly provided via env.
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    // dist/main/index.js → dist/renderer/index.html
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function loadConfig(): Promise<void> {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf8');
    const loadedConfig: Partial<AppConfig> = JSON.parse(data);
    
    if (loadedConfig.buttons && Array.isArray(loadedConfig.buttons)) {
      config = { ...config, ...loadedConfig };
    }
    await writeLog('info', 'Config loaded', { path: configPath });
  } catch (error) {
    await writeLog('warn', 'No config file found or error loading, using defaults');
  }
}

async function saveConfig(): Promise<void> {
  try {
    const configPath = getConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    await writeLog('info', 'Config saved', { path: configPath });
  } catch (error) {
    await writeLog('error', 'Error saving config', { error: String(error) });
  }
}

function registerHotkeys(): HotkeyRegistrationResult[] {
  if (hotkeysSuppressed) {
    globalShortcut.unregisterAll();
    if (mainWindow) mainWindow.webContents.send('hotkeys-registered', []);
    return [];
  }
  globalShortcut.unregisterAll();
  const results: HotkeyRegistrationResult[] = [];
  
  Object.entries(config.hotkeys).forEach(([accelerator, buttonIndex]) => {
    try {
      const ok = globalShortcut.register(accelerator, () => {
        if (mainWindow) {
          writeLog('info', 'Hotkey triggered', { accelerator, buttonIndex });
          mainWindow.webContents.send('trigger-button', buttonIndex);
        }
      });
      results.push({ accelerator, ok: !!ok });
      if (!ok) {
        writeLog('warn', 'Hotkey registration returned false', { accelerator, buttonIndex });
      } else {
        writeLog('info', 'Hotkey registered', { accelerator, buttonIndex });
      }
    } catch (error) {
      results.push({ accelerator, ok: false });
      writeLog('warn', `Could not register hotkey ${accelerator}`, { error: String(error) });
    }
  });

  if (mainWindow) {
    mainWindow.webContents.send('hotkeys-registered', results);
  }
  return results;
}

app.whenReady().then(async () => {
  await loadConfig();
  createWindow();
  // Only enable hotkeys when window is focused
  if (mainWindow && mainWindow.isFocused()) {
    registerHotkeys();
  }

  // Toggle hotkeys based on window focus
  if (mainWindow) {
    mainWindow.on('focus', () => {
      const results = registerHotkeys();
      writeLog('info', 'Hotkeys enabled (window focused)', { count: results.length });
    });
    mainWindow.on('blur', () => {
      globalShortcut.unregisterAll();
      writeLog('info', 'Hotkeys disabled (window blurred)');
      if (mainWindow) {
        mainWindow.webContents.send('hotkeys-registered', []);
      }
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ---- IPC ----
ipcMain.handle('get-config', (): AppConfig => config);

ipcMain.handle('update-config', async (event, newConfig: Partial<AppConfig>): Promise<AppConfig> => {
  config = { ...config, ...newConfig };
  await saveConfig();
  // Only (re)register if window is focused; otherwise leave disabled
  if (BrowserWindow.getFocusedWindow() && !hotkeysSuppressed) {
    registerHotkeys();
  }
  await writeLog('info', 'Config updated via renderer');
  return config;
});

ipcMain.handle('select-audio-file', async (): Promise<string | null> => {
  const parent = mainWindow ?? BrowserWindow.getFocusedWindow() ?? null;
  await writeLog('debug', 'Opening audio file dialog');
  const options = {
    title: 'Select Audio File',
    filters: [
      { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'flac'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile'] as Array<'openFile' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'>
  };
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);
  await writeLog('info', 'Audio file dialog closed', { canceled: result.canceled, count: result.filePaths?.length || 0 });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-audio-devices', async (): Promise<MediaDeviceInfo[]> => {
  return [];
});

// Read local file bytes for audio decoding in renderer
ipcMain.handle('read-file-bytes', async (_e, filePath: string): Promise<ArrayBuffer> => {
  const buf = await fs.readFile(filePath);
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer type and ensure transferability
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy.buffer;
});

// Logging bridge from renderer
ipcMain.on('log', async (_event, payload: { level: LogLevel; message: string; meta?: any }) => {
  const { level, message, meta } = payload || {};
  const allowed: LogLevel[] = ['debug','info','warn','error'];
  const lvl: LogLevel = (allowed as any).includes(level) ? level : 'info';
  await writeLog(lvl, message ?? '');
  if (meta) await writeLog('debug', 'meta', meta);
});

ipcMain.handle('get-log-settings', async (): Promise<LogSettings> => {
  return { level: consoleLogLevel };
});

// Enable/disable hotkeys explicitly from renderer (e.g., while editing text)
ipcMain.on('set-hotkeys-enabled', (_e, enabled: boolean) => {
  hotkeysSuppressed = !enabled;
  if (enabled && BrowserWindow.getFocusedWindow()) {
    registerHotkeys();
  } else {
    globalShortcut.unregisterAll();
    if (mainWindow) mainWindow.webContents.send('hotkeys-registered', []);
  }
});

ipcMain.handle('set-log-settings', async (_e, settings: LogSettings): Promise<LogSettings> => {
  if (settings?.level && ['debug','info','warn','error'].includes(settings.level)) {
    consoleLogLevel = settings.level as LogLevel;
    await writeLog('info', 'Console log level changed', { level: consoleLogLevel });
  }
  return { level: consoleLogLevel };
});
