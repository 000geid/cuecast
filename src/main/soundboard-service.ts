import { promises as fs } from 'fs';
import type { AppConfig, HotkeyRegistrationResult, LogLevel, LogSettings, SetButtonHotkeyResult } from '../common/types';
import { assignButtonAudio, clearButton, clearButtonHotkey, createDefaultConfig, hydrateConfig, setOutputDevice, updateButtonDetails } from '../domain/soundboard';
import { setButtonHotkey } from '../domain/hotkeys';

type SoundboardServiceDeps = {
  getConfigPath: () => string;
  onAfterConfigChange?: (config: AppConfig) => HotkeyRegistrationResult[] | Promise<HotkeyRegistrationResult[]>;
  writeLog: (level: LogLevel, message: string, meta?: unknown) => Promise<void>;
};

export class SoundboardService {
  private config: AppConfig = createDefaultConfig();
  private consoleLogLevel: LogLevel = (process.env.CUECAST_LOG_LEVEL as LogLevel) || 'info';

  constructor(private readonly deps: SoundboardServiceDeps) {}

  getConfig(): AppConfig {
    return this.config;
  }

  getLogSettings(): LogSettings {
    return { level: this.consoleLogLevel };
  }

  async setLogSettings(settings: LogSettings): Promise<LogSettings> {
    if (settings?.level && ['debug', 'info', 'warn', 'error'].includes(settings.level)) {
      this.consoleLogLevel = settings.level;
      await this.deps.writeLog('info', 'Console log level changed', { level: this.consoleLogLevel });
    }

    return this.getLogSettings();
  }

  async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.deps.getConfigPath(), 'utf8');
      this.config = hydrateConfig(JSON.parse(data) as Partial<AppConfig>);
      await this.deps.writeLog('info', 'Config loaded', { path: this.deps.getConfigPath() });
    } catch {
      this.config = createDefaultConfig();
      await this.deps.writeLog('warn', 'No config file found or error loading, using defaults');
    }
  }

  async assignButtonAudio(input: { buttonIndex: number; filePath: string }): Promise<AppConfig> {
    return this.applyConfig(assignButtonAudio(this.config, input), 'Config updated via assignButtonAudio');
  }

  async updateButtonDetails(input: { buttonIndex: number; label: string; filePath: string | null }): Promise<AppConfig> {
    return this.applyConfig(updateButtonDetails(this.config, input), 'Config updated via updateButtonDetails');
  }

  async clearButton(input: { buttonIndex: number }): Promise<AppConfig> {
    return this.applyConfig(clearButton(this.config, input), 'Config updated via clearButton');
  }

  async clearButtonHotkey(input: { buttonIndex: number }): Promise<AppConfig> {
    return this.applyConfig(clearButtonHotkey(this.config, input), 'Config updated via clearButtonHotkey');
  }

  async setButtonHotkey(input: { buttonIndex: number; accelerator: string }): Promise<SetButtonHotkeyResult> {
    const result = setButtonHotkey(this.config, input);
    if (!result.ok) {
      return result;
    }

    const config = await this.applyConfig(result.config, 'Config updated via setButtonHotkey');
    return { ok: true, accelerator: result.accelerator, config };
  }

  async setOutputDevice(input: { deviceId: string | null }): Promise<AppConfig> {
    return this.applyConfig(setOutputDevice(this.config, input), 'Config updated via setOutputDevice');
  }

  async logFromRenderer(payload: { level: LogLevel; message: string; meta?: unknown } | null | undefined): Promise<void> {
    const allowed: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const level = payload && allowed.includes(payload.level) ? payload.level : 'info';
    const message = payload?.message ?? '';

    await this.deps.writeLog(level, message);
    if (payload?.meta) {
      await this.deps.writeLog('debug', 'meta', payload.meta);
    }
  }

  private async applyConfig(nextConfig: AppConfig, logMessage: string): Promise<AppConfig> {
    this.config = nextConfig;
    await fs.writeFile(this.deps.getConfigPath(), JSON.stringify(this.config, null, 2));
    await this.deps.writeLog('info', 'Config saved', { path: this.deps.getConfigPath() });

    if (this.deps.onAfterConfigChange) {
      await this.deps.onAfterConfigChange(this.config);
    }

    await this.deps.writeLog('info', logMessage);
    return this.config;
  }
}
