import { setButtonHotkey } from './hotkeys';
import { assignButtonAudio, clearButton, createDefaultConfig, setOutputDevice } from './soundboard';

describe('soundboard domain', () => {
  test('createDefaultConfig returns 8 empty buttons', () => {
    const config = createDefaultConfig();

    expect(config.buttons).toHaveLength(8);
    expect(config.buttons.every((button) => button.label === 'Empty' && button.path === null && button.gain === 1.0)).toBe(true);
  });

  test('assignButtonAudio derives label from filename and preserves gain', () => {
    const config = createDefaultConfig();
    config.buttons[2].gain = 0.4;

    const next = assignButtonAudio(config, { buttonIndex: 2, filePath: '/tmp/fx/air-horn.mp3' });

    expect(next.buttons[2]).toEqual({
      label: 'air-horn',
      path: '/tmp/fx/air-horn.mp3',
      gain: 0.4
    });
  });

  test('clearButton resets the button and removes only matching hotkeys', () => {
    const config = createDefaultConfig();
    config.buttons[1] = { label: 'Crowd', path: '/tmp/crowd.wav', gain: 0.7 };
    config.hotkeys = { 'Control+1': 1, 'Control+2': 2 };

    const next = clearButton(config, { buttonIndex: 1 });

    expect(next.buttons[1]).toEqual({ label: 'Empty', path: null, gain: 1.0 });
    expect(next.hotkeys).toEqual({ 'Control+2': 2 });
  });

  test('setButtonHotkey normalizes accelerators and replaces the same button binding', () => {
    const config = createDefaultConfig();
    config.hotkeys = { 'Control+1': 1 };

    const result = setButtonHotkey(config, { buttonIndex: 1, accelerator: 'CmdOrCtrl+2' });

    expect(result).toEqual({
      ok: true,
      accelerator: 'CommandOrControl+2',
      config: {
        ...config,
        hotkeys: {
          'CommandOrControl+2': 1
        }
      }
    });
  });

  test('setButtonHotkey rejects conflicts with another button', () => {
    const config = createDefaultConfig();
    config.hotkeys = { 'Control+1': 3 };

    const result = setButtonHotkey(config, { buttonIndex: 1, accelerator: 'Ctrl+1' });

    expect(result).toEqual({
      ok: false,
      reason: 'conflict',
      conflictButtonIndex: 3,
      accelerator: 'Control+1'
    });
  });

  test('setOutputDevice updates only outputDeviceId', () => {
    const config = createDefaultConfig();
    config.hotkeys = { 'Control+1': 0 };

    const next = setOutputDevice(config, { deviceId: 'virtual-device-1' });

    expect(next.outputDeviceId).toBe('virtual-device-1');
    expect(next.hotkeys).toEqual(config.hotkeys);
    expect(next.buttons).toEqual(config.buttons);
  });
});
