import { mkdtemp, readFile, rm } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SoundboardService } from './soundboard-service';

describe('SoundboardService', () => {
  test('successful mutation persists config and re-registers hotkeys', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cuecast-service-'));
    const configPath = path.join(tempDir, 'config.json');
    const onAfterConfigChange = jest.fn().mockReturnValue([]);
    const writeLog = jest.fn().mockResolvedValue(undefined);

    try {
      const service = new SoundboardService({
        getConfigPath: () => configPath,
        onAfterConfigChange,
        writeLog
      });

      await service.loadConfig();
      const result = await service.assignButtonAudio({ buttonIndex: 0, filePath: '/tmp/sting.wav' });

      const persisted = JSON.parse(await readFile(configPath, 'utf8')) as typeof result;

      expect(result.buttons[0].path).toBe('/tmp/sting.wav');
      expect(persisted.buttons[0].label).toBe('sting');
      expect(onAfterConfigChange).toHaveBeenCalledTimes(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('hotkey conflict does not persist a changed config', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cuecast-service-'));
    const configPath = path.join(tempDir, 'config.json');
    const onAfterConfigChange = jest.fn().mockReturnValue([]);
    const writeLog = jest.fn().mockResolvedValue(undefined);

    try {
      const service = new SoundboardService({
        getConfigPath: () => configPath,
        onAfterConfigChange,
        writeLog
      });

      await service.loadConfig();
      await service.setButtonHotkey({ buttonIndex: 2, accelerator: 'Ctrl+1' });
      onAfterConfigChange.mockClear();

      const result = await service.setButtonHotkey({ buttonIndex: 3, accelerator: 'Ctrl+1' });

      expect(result).toEqual({
        ok: false,
        reason: 'conflict',
        conflictButtonIndex: 2,
        accelerator: 'Control+1'
      });
      expect(onAfterConfigChange).not.toHaveBeenCalled();
      expect(service.getConfig().hotkeys).toEqual({ 'Control+1': 2 });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
