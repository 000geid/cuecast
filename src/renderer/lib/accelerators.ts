export function normalizeAccelerator(acc: string): string {
  return acc
    .replace(/\bCmd\b/g, 'Command')
    .replace(/\bCtrl\b/g, 'Control')
    .replace(/\bCmdOrCtrl\b/g, 'CommandOrControl')
    .replace(/\bEsc\b/g, 'Escape');
}

