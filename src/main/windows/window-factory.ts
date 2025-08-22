import { BaseWindow, WebContentsView, nativeTheme } from 'electron/main'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { WindowType, WindowConfig } from '@shared/window-types'
import { WINDOW_DIMENSIONS, getWindowTitle } from '@shared/window-types'

const windows = new Map<WindowType, BaseWindow>()

const getPreloadPath = (): string => join(__dirname, '../preload/index.cjs')

const getRendererUrl = (windowType: WindowType): string => {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const baseUrl =
    devUrl && is.dev ? devUrl : new URL('../renderer/index.html', `file://${__dirname}/`).toString()

  // 通过查询参数指定窗口类型
  return `${baseUrl}?window=${windowType}#/`
}

export const createWindow = (config: WindowConfig): BaseWindow => {
  const existingWindow = windows.get(config.type)
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show()
    existingWindow.focus()
    return existingWindow
  }

  const window = new BaseWindow({
    width: config.width,
    height: config.height,
    title: config.title,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121212' : '#ffffff',
    resizable: false,
    minimizable: true,
    maximizable: false,
  })

  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: is.dev,
      preload: getPreloadPath(),
    },
  })

  window.contentView.addChildView(view)
  const [w, h] = window.getContentSize()
  view.setBounds({ x: 0, y: 0, width: w, height: h })

  // Window size is fixed, no need to handle resize events

  // Load the corresponding application type
  void view.webContents.loadURL(getRendererUrl(config.type))

  view.webContents.once('dom-ready', () => {
    if (is.dev) {
      try {
        view.webContents.openDevTools({ mode: 'detach' })
      } catch {}
    }
  })

  view.webContents.once('did-finish-load', () => {
    window.show()
  })

  window.on('closed', () => {
    windows.delete(config.type)
  })

  windows.set(config.type, window)
  return window
}

// Predefined window configurations (16:9 aspect ratio)
export const WindowConfigs: Record<WindowType, WindowConfig> = {
  main: {
    type: 'main',
    ...WINDOW_DIMENSIONS.main,
    title: getWindowTitle('main'),
  },
  dashboard: {
    type: 'dashboard',
    ...WINDOW_DIMENSIONS.dashboard,
    title: getWindowTitle('dashboard'),
  },
  control: {
    type: 'control',
    ...WINDOW_DIMENSIONS.control,
    title: getWindowTitle('control'),
  },
}

// Convenience methods
export const openMainWindow = (): BaseWindow => createWindow(WindowConfigs.main)
export const openDashboardWindow = (): BaseWindow => createWindow(WindowConfigs.dashboard)
export const openControlWindow = (): BaseWindow => createWindow(WindowConfigs.control)

export const getWindow = (type: WindowType): BaseWindow | null => {
  return windows.get(type) || null
}
