import type { AppConfig, ButtonConfig } from '../common/types';

export const DEFAULT_BUTTONS_COUNT = 8;

export function createDefaultButton(): ButtonConfig {
  return { label: 'Empty', path: null, gain: 1.0 };
}

export function createDefaultButtons(count: number = DEFAULT_BUTTONS_COUNT): ButtonConfig[] {
  return Array.from({ length: count }, createDefaultButton);
}

export function createDefaultConfig(): AppConfig {
  return {
    buttons: createDefaultButtons(),
    hotkeys: {},
    outputDeviceId: null
  };
}

export function hydrateConfig(input: Partial<AppConfig> | null | undefined): AppConfig {
  const base = createDefaultConfig();

  if (!input) {
    return base;
  }

  return {
    buttons: Array.isArray(input.buttons)
      ? input.buttons.map((button) => ({
          label: typeof button?.label === 'string' ? button.label : 'Empty',
          path: typeof button?.path === 'string' ? button.path : null,
          gain: typeof button?.gain === 'number' ? button.gain : 1.0
        }))
      : base.buttons,
    hotkeys: input.hotkeys && typeof input.hotkeys === 'object' ? { ...input.hotkeys } : {},
    outputDeviceId: typeof input.outputDeviceId === 'string' ? input.outputDeviceId : null
  };
}

export function deriveLabelFromPath(filePath: string): string {
  const segment = filePath.split(/[\\/]/).pop() ?? '';
  const stem = segment.replace(/\.[^.]+$/, '');
  return stem || 'Unknown';
}

export function assertValidButtonIndex(config: AppConfig, buttonIndex: number): void {
  if (!Number.isInteger(buttonIndex) || buttonIndex < 0 || buttonIndex >= config.buttons.length) {
    throw new Error(`Invalid button index: ${buttonIndex}`);
  }
}

export function assignButtonAudio(config: AppConfig, input: { buttonIndex: number; filePath: string }): AppConfig {
  assertValidButtonIndex(config, input.buttonIndex);

  const buttons = [...config.buttons];
  buttons[input.buttonIndex] = {
    ...buttons[input.buttonIndex],
    label: deriveLabelFromPath(input.filePath),
    path: input.filePath
  };

  return { ...config, buttons };
}

export function updateButtonDetails(
  config: AppConfig,
  input: { buttonIndex: number; label: string; filePath: string | null; gain: number }
): AppConfig {
  assertValidButtonIndex(config, input.buttonIndex);

  const buttons = [...config.buttons];
  buttons[input.buttonIndex] = {
    ...buttons[input.buttonIndex],
    label: input.label,
    path: input.filePath,
    gain: Number.isFinite(input.gain) ? Math.max(0, Math.min(1.5, input.gain)) : buttons[input.buttonIndex].gain
  };

  return { ...config, buttons };
}

export function clearButton(config: AppConfig, input: { buttonIndex: number }): AppConfig {
  assertValidButtonIndex(config, input.buttonIndex);

  const buttons = [...config.buttons];
  buttons[input.buttonIndex] = createDefaultButton();

  const hotkeys = removeHotkeysForButton(config.hotkeys, input.buttonIndex);
  return { ...config, buttons, hotkeys };
}

export function clearButtonHotkey(config: AppConfig, input: { buttonIndex: number }): AppConfig {
  assertValidButtonIndex(config, input.buttonIndex);
  return { ...config, hotkeys: removeHotkeysForButton(config.hotkeys, input.buttonIndex) };
}

export function setOutputDevice(config: AppConfig, input: { deviceId: string | null }): AppConfig {
  return { ...config, outputDeviceId: input.deviceId };
}

export function removeHotkeysForButton(hotkeys: AppConfig['hotkeys'], buttonIndex: number): AppConfig['hotkeys'] {
  return Object.fromEntries(Object.entries(hotkeys).filter(([, index]) => index !== buttonIndex));
}
