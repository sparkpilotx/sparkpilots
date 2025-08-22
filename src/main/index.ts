import { app, BrowserWindow } from 'electron/main'
import { shell } from 'electron/common'
import { platform, is } from '@electron-toolkit/utils'
import { createAppTray, destroyAppTray } from './tray'
import { ensureDatabaseConnection } from './prisma'
import { startTrpcServer, stopTrpcServer } from './trpc/server'

/**
 * Main process entry point for SparkPilot
 *
 * Manages the core Electron application lifecycle, window creation, and security
 * configurations. This process runs with full Node.js access and handles all
 * system-level operations that the renderer process cannot perform directly.
 *
 * @remarks
 * Security: Implements strict context isolation and prevents unauthorized
 * access to Node.js APIs from renderer processes.
 */

// Enforce renderer sandbox for all BrowserWindows (must be called before 'ready')
app.enableSandbox()

// Tray-first app; windows are managed on-demand in their modules

/**
 * Enforce single-instance application behavior
 *
 * If another instance is launched, focus the existing window instead of creating a new one.
 */
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
  // Ensure process exits on all platforms
  process.exit(0)
}

/**
 * SparkPilot runs as a tray-first app. Windows are created on-demand elsewhere.
 */

// Handle attempts to launch a second instance by focusing existing window
if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    const existingWindow = BrowserWindow.getAllWindows()[0] ?? null
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore()
      if (existingWindow.isVisible()) existingWindow.focus()
    }
  })
}

/**
 * Application lifecycle event handlers
 *
 * @remarks
 * tRPC Server: Started when app is ready and stopped gracefully before quit
 * macOS: Re-creates window when dock icon is clicked, following platform
 * conventions for single-window applications.
 */
app.whenReady().then(async () => {
  // macOS: hide Dock to run as tray-only app
  if (platform.isMacOS) {
    app.dock?.hide()
  }
  // Verify database connectivity early; non-fatal in development
  try {
    await ensureDatabaseConnection()
  } catch (error) {
    console.error('Database connectivity check failed:', error)
    if (!is.dev) {
      // In production, abort startup if DB is required
      app.quit()
      return
    }
  }

  // Start tRPC server
  startTrpcServer()

  // Create system tray with dynamic windows menu
  createAppTray()

  // Appearance persistence and sync removed in this iteration

  // Do not auto-show or create window on dock activation; tray controls visibility
})

// Platform-specific quit behavior: quit on non-macOS when all windows close
app.on('window-all-closed', () => {
  if (!platform.isMacOS) {
    app.quit()
  }
})

// Clean up IPC handlers and stop tRPC server before quitting
app.on('before-quit', () => {
  void (async () => {
    await stopTrpcServer()
    destroyAppTray()
  })()
})

// Security: Prevent unauthorized navigation and redirect to external browser
app.on('web-contents-created', (_event, contents) => {
  // Block all window.open popups; route to system browser if needed
  contents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser and deny in-app popups
    try {
      shell.openExternal(url)
    } catch {
      // no-op: avoid throwing in handler
    }
    return { action: 'deny' }
  })

  // Prevent in-app navigation; open externally instead
  contents.on('will-navigate', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })

  // Disallow embedding <webview>
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
})

// Crash handling: Log errors and quit gracefully in production
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // TODO(crash-reporting): Implement file logging or crash reporting service
  if (!is.dev) {
    app.quit()
  }
})

// Promise rejection handling: Log unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // TODO(crash-reporting): Implement file logging or crash reporting service
})
