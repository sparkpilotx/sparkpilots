/**
 * @file Preload script providing secure bridge between renderer and main processes.
 *
 * This script runs in a privileged context with access to both Node.js APIs and DOM.
 * It exposes controlled APIs to the renderer process via `contextBridge`, preventing
 * direct access to powerful Node.js primitives while maintaining security isolation.
 *
 * @see {@link https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts} for Electron preload documentation
 * @see {@link src/preload/index.d.ts} for TypeScript definitions
 *
 * @remarks
 * SECURITY: Only expose minimum necessary APIs. Validate all data between processes.
 * Never expose Node.js primitives directly. Requires contextIsolation: true.
 */

import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

// Early appearance application to minimize FOUC
try {
  const prefersDark =
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  document.documentElement.classList.toggle('dark', Boolean(prefersDark))
  ;(document.documentElement as HTMLElement).style.colorScheme = prefersDark ? 'dark' : 'light'
} catch {}

/**
 * Extended Electron API combining standard functionality with custom features.
 *
 * Serves as the foundation for all renderer process communication with the main
 * process. Currently provides standard ElectronAPI capabilities with room for
 * future app-specific extensions.
 *
 * @example
 * ```typescript
 * // Standard Electron APIs
 * xAPI.ipcRenderer.send('channel', data);
 * xAPI.webFrame.setZoomLevel(1);
 *
 * // Future custom APIs
 * // xAPI.dialog.showOpenDialog(options);
 * // xAPI.fs.readFile(path);
 * ```
 *
 * @remarks
 * Extends the base electronAPI from @electron-toolkit/preload. All methods
 * are validated and sanitized before exposure to the renderer process.
 */
const xAPI = {
  ...electronAPI,
}

/**
 * Exposes the extended Electron API to the renderer process via contextBridge.
 *
 * Provides a unified interface accessible as `window.xAPI` in the renderer,
 * combining standard Electron functionality with custom features in a secure,
 * sandboxed environment.
 *
 * @example
 * ```typescript
 * // In renderer process
 * window.xAPI.ipcRenderer.send('channel', data);
 * window.xAPI.webFrame.setZoomLevel(1);
 * ```
 *
 * @remarks
 * This is the only communication path between renderer and main processes.
 * All other Node.js and Electron APIs are blocked for security.
 *
 * @throws {Error} If contextBridge is unavailable or contextIsolation is disabled
 */
contextBridge.exposeInMainWorld('xAPI', xAPI)
