import { app, BaseWindow, WebContentsView } from 'electron/main'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export type WindowType = 'main' | 'dashboard' | 'control'

interface WindowConfig {
  type: WindowType
  width: number
  height: number
  title: string
  route?: string
}

const windows = new Map<WindowType, BaseWindow>()

const getPreloadPath = (): string => join(__dirname, '../preload/index.cjs')

const getRendererUrl = (windowType: WindowType): string => {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const baseUrl = devUrl && is.dev 
    ? devUrl 
    : new URL('../renderer/index.html', `file://${__dirname}/`).toString()
  
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

  // 窗口大小固定，无需处理 resize 事件

  // 加载对应类型的应用
  void view.webContents.loadURL(getRendererUrl(config.type))

  view.webContents.once('dom-ready', () => {
    if (is.dev) {
      try {
        view.webContents.openDevTools({ mode: 'detach' })
      } catch {}
    }
    window.show()
  })

  window.on('closed', () => {
    windows.delete(config.type)
  })

  windows.set(config.type, window)
  return window
}

// 预定义的窗口配置 (16:9 比例)
export const WindowConfigs: Record<WindowType, WindowConfig> = {
  main: {
    type: 'main',
    width: 1280,
    height: 720,
    title: `${app.getName()} - Main`,
  },
  dashboard: {
    type: 'dashboard',
    width: 960,
    height: 540,
    title: `${app.getName()} - Dashboard`,
  },
  control: {
    type: 'control',
    width: 640,
    height: 360,
    title: `${app.getName()} - Control`,
  },
}

// 便捷方法
export const openMainWindow = (): BaseWindow => createWindow(WindowConfigs.main)
export const openDashboardWindow = (): BaseWindow => createWindow(WindowConfigs.dashboard)
export const openControlWindow = (): BaseWindow => createWindow(WindowConfigs.control)

export const getWindow = (type: WindowType): BaseWindow | null => {
  return windows.get(type) || null
}
