import { ipcMain, nativeTheme, webContents } from 'electron/main'
import type { AppearanceSnapshot, ThemeSource } from '@shared/appearance'

const getSnapshot = (): AppearanceSnapshot => {
  const source = (nativeTheme.themeSource ?? 'system') as ThemeSource
  return {
    themeSource: source,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  }
}

const broadcastAppearanceUpdate = (): void => {
  const snapshot = getSnapshot()
  for (const contents of webContents.getAllWebContents()) {
    try {
      contents.send('appearance:updated', snapshot)
    } catch {}
  }
}

export const setupAppearanceIpc = (): void => {
  try {
    nativeTheme.themeSource = 'system'
  } catch {}

  ipcMain.handle('appearance:get', () => getSnapshot())

  nativeTheme.on('updated', () => {
    broadcastAppearanceUpdate()
  })
}
