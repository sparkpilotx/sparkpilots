import { app, Menu, Tray } from 'electron/main'
import { nativeImage } from 'electron/common'
import { existsSync } from 'fs'
import { join, resolve, basename } from 'path'
import { platform } from '@electron-toolkit/utils'

/**
 * Tray utilities for creating and managing the application status bar icon.
 *
 * @remarks
 * Design: This module exposes a small, explicit API and retains a single `Tray` instance
 * in module scope to prevent it from being garbage-collected by Electron. Icons are
 * resolved per platform and marked as template images on macOS for automatic tinting.
 *
 * Non-goals: This module does not create, show, or manage application windows; it only
 * concerns the system tray. Dynamic, app-state-driven menu construction belongs to a
 * higher-level coordinator.
 *
 * Trade-offs: A module-scoped singleton is simple and robust for a tray-first app,
 * foregoing dependency injection for clarity and safety in the main process.
 *
 * Execution model: All APIs are synchronous and must be called from the Electron main
 * process. There is no file/network I/O; icon paths are resolved from packaged assets or
 * source during development.
 *
 * Security: Runs in the trusted main process. Inputs (labels, tooltips) are expected to be
 * static strings from trusted sources; avoid passing untrusted user input.
 *
 * @public
 */

let appTray: Tray | null = null

const getTrayIconPath = (): string => {
  if (platform.isMacOS) {
    // Prefer a dedicated monochrome, transparent tray template if available
    const packagedTemplate = join(process.resourcesPath, 'logo/trayTemplate.png')
    const devTemplate = resolve('src/renderer/public/logo/trayTemplate.png')
    if (app.isPackaged ? existsSync(packagedTemplate) : existsSync(devTemplate)) {
      return app.isPackaged ? packagedTemplate : devTemplate
    }
    return app.isPackaged
      ? join(process.resourcesPath, 'logo/512x512.png')
      : resolve('src/renderer/public/logo/512x512.png')
  }
  if (platform.isWindows) {
    return app.isPackaged
      ? join(process.resourcesPath, 'logo/icon-logo.ico')
      : resolve('src/renderer/public/logo/icon-logo.ico')
  }
  return app.isPackaged
    ? join(process.resourcesPath, 'logo/256x256.png')
    : resolve('src/renderer/public/logo/256x256.png')
}

const createTrayImage = (): Electron.NativeImage => {
  const primaryPath = getTrayIconPath()
  let image = nativeImage.createFromPath(primaryPath)

  // Fall back to alternate sizes if the resolved image path is empty at runtime
  if (image.isEmpty()) {
    const fallbackPath = app.isPackaged
      ? join(process.resourcesPath, 'logo/256x256.png')
      : resolve('src/renderer/public/logo/256x256.png')
    image = nativeImage.createFromPath(fallbackPath)
  }

  if (platform.isMacOS) {
    const isTemplateAsset = basename(primaryPath).toLowerCase().includes('traytemplate')
    image = image.resize({ width: 16, height: 16 })
    image.setTemplateImage(isTemplateAsset)
  }
  return image
}

export const buildDefaultTrayMenu = (): Electron.Menu => {
  return Menu.buildFromTemplate([
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])
}

/**
 * Creates (or returns) the singleton `Tray` instance.
 *
 * @remarks
 * If a tray already exists, this function is idempotent and will reuse it, optionally
 * updating its context menu.
 *
 * @param menu - Optional menu to set as the tray's context menu.
 * @returns The active `Tray` instance.
 *
 * @example
 * ```ts
 * import { app } from 'electron/main';
 * import { createAppTray, buildDefaultTrayMenu } from './tray';
 *
 * app.whenReady().then(() => {
 *   createAppTray(buildDefaultTrayMenu());
 * });
 * ```
 */
export const createAppTray = (menu?: Electron.Menu): Tray => {
  if (appTray) {
    if (menu) appTray.setContextMenu(menu)
    return appTray
  }
  appTray = new Tray(createTrayImage())
  appTray.setToolTip(app.getName())
  appTray.setContextMenu(menu ?? buildDefaultTrayMenu())
  return appTray
}

/**
 * Replaces the tray's context menu.
 *
 * @param menu - The menu to apply to the tray icon.
 *
 * @example
 * ```ts
 * import { Menu } from 'electron/main';
 * import { setTrayMenu } from './tray';
 *
 * const menu = Menu.buildFromTemplate([{ label: 'Hello', click: () => {} }]);
 * setTrayMenu(menu);
 * ```
 */
export const setTrayMenu = (menu: Electron.Menu): void => {
  if (appTray) appTray.setContextMenu(menu)
}

/**
 * Sets the tray tooltip text.
 *
 * @param tooltip - The tooltip to show when hovering the tray icon.
 *
 * @example
 * ```ts
 * import { setTrayTooltip } from './tray';
 * setTrayTooltip('SparkPilot');
 * ```
 */
export const setTrayTooltip = (tooltip: string): void => {
  if (appTray) appTray.setToolTip(tooltip)
}

/**
 * Returns the current `Tray` instance, if any.
 *
 * @returns The `Tray` instance or `null` when no tray exists.
 *
 * @example
 * ```ts
 * import { getTray } from './tray';
 * const tray = getTray();
 * if (tray) tray.setTitle?.('Ready');
 * ```
 */
export const getTray = (): Tray | null => appTray

/**
 * Destroys and clears the singleton `Tray` instance.
 *
 * @remarks
 * Safe to call multiple times; no-op when the tray does not exist.
 *
 * @example
 * ```ts
 * import { app } from 'electron/main';
 * import { destroyAppTray } from './tray';
 *
 * app.on('before-quit', () => {
 *   destroyAppTray();
 * });
 * ```
 */
export const destroyAppTray = (): void => {
  appTray?.destroy()
  appTray = null
}
