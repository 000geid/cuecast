import type { AppConfig, SetButtonHotkeyResult } from '../common/types';
import { normalizeAccelerator } from './accelerators';
import { assertValidButtonIndex, removeHotkeysForButton } from './soundboard';

export function setButtonHotkey(config: AppConfig, input: { buttonIndex: number; accelerator: string }): SetButtonHotkeyResult {
  assertValidButtonIndex(config, input.buttonIndex);

  const accelerator = normalizeAccelerator(input.accelerator);
  const conflictButtonIndex = config.hotkeys[accelerator];

  if (conflictButtonIndex !== undefined && conflictButtonIndex !== input.buttonIndex) {
    return {
      ok: false,
      reason: 'conflict',
      conflictButtonIndex,
      accelerator
    };
  }

  const hotkeys = removeHotkeysForButton(config.hotkeys, input.buttonIndex);
  hotkeys[accelerator] = input.buttonIndex;

  return {
    ok: true,
    accelerator,
    config: { ...config, hotkeys }
  };
}
