/**
 * @file Type definitions for the preload script's exposed APIs.
 * 
 * This declaration file extends the global `Window` interface to provide type safety
 * for APIs exposed via `contextBridge` in the preload script. It enables TypeScript
 * autocompletion and compile-time checks when accessing `window.xAPI` in the renderer
 * process, preventing runtime errors and improving developer experience.
 * 
 * @see {@link src/preload/index.ts} for the actual API implementation
 * @see {@link https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts} for Electron preload documentation
 */

import type { ElectronAPI } from '@electron-toolkit/preload';
import type { AppearanceSnapshot } from '@shared/appearance';

declare global {
  interface Window {
    /**
     * Extended Electron API providing secure access to main process functionality.
     * 
     * This API is exposed via the preload script's contextBridge and combines:
     * - Standard ElectronAPI capabilities (ipcRenderer, webFrame, etc.)
     * - Custom app-specific methods and properties
     * - Type-safe inter-process communication
     * 
     * @example
     * ```typescript
     * // Inter-process communication
     * window.xAPI.ipcRenderer.send('channel', data);
     * window.xAPI.ipcRenderer.on('response', (event, result) => {
     *   console.log('Received:', result);
     * });
     * 
     * // Web frame manipulation
     * window.xAPI.webFrame.setZoomLevel(1);
     * 
     * // Custom APIs (when implemented)
     * // window.xAPI.dialog.showOpenDialog(options);
     * ```
     * 
     * @remarks
     * All APIs are sandboxed and validated by the preload script for security.
     * Direct Node.js access is blocked to prevent security vulnerabilities.
     */
    xAPI: ElectronAPI & {
      appearance: {
        get: () => Promise<AppearanceSnapshot>;
        onUpdated: (
          callback: (snapshot: AppearanceSnapshot) => void
        ) => () => void;
      };
    };
  }
}