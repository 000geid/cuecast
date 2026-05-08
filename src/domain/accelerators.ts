export function normalizeAccelerator(accelerator: string): string {
  return accelerator
    .replace(/\bCmd\b/g, 'Command')
    .replace(/\bCtrl\b/g, 'Control')
    .replace(/\bCmdOrCtrl\b/g, 'CommandOrControl')
    .replace(/\bEsc\b/g, 'Escape');
}
