/**
 * Window system shared type definitions
 *
 * These types are used in both main and renderer processes:
 * - main: window factory creates and manages windows
 * - renderer: loads corresponding app components based on window type
 */

/**
 * Supported window types
 */
export type WindowType = 'main' | 'dashboard' | 'control'

/**
 * Window configuration interface
 */
export interface WindowConfig {
  type: WindowType
  width: number
  height: number
  title: string
  route?: string
}

/**
 * Window dimensions configuration (16:9 aspect ratio)
 */
export const WINDOW_DIMENSIONS = {
  main: { width: 1280, height: 720 },
  dashboard: { width: 960, height: 540 },
  control: { width: 640, height: 360 },
} as const satisfies Record<WindowType, { width: number; height: number }>

/**
 * Get window title with app name prefix
 */
export const getWindowTitle = (type: WindowType): string => {
  const typeMap: Record<WindowType, string> = {
    main: 'Main',
    dashboard: 'Dashboard',
    control: 'Control',
  }
  return `${import.meta.env.VITE_APP_NAME} - ${typeMap[type]}`
}
