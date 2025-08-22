import React from 'react'
import ReactDOM from 'react-dom/client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/trpc'
import { WindowType } from '@shared/window-types'

import './src/styles/globals.css'

/**
 * Initialize the React application in the renderer process.
 *
 * Uses dynamic imports to load only the required app component,
 * reducing memory usage by not bundling unused window apps.
 */

// Get window type from URL parameters
const urlParams = new URLSearchParams(window.location.search)
const windowType = (urlParams.get('window') as WindowType) || 'main'

// Dynamically import corresponding app component
const AppLoader = (): React.JSX.Element => {
  const [AppComponent, setAppComponent] = React.useState<React.ComponentType | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadApp = async () => {
      try {
        let module: { default: React.ComponentType }
        switch (windowType) {
          case 'dashboard':
            module = await import('./src/windows/dashboard-app')
            break
          case 'control':
            module = await import('./src/windows/control-app')
            break
          default:
            module = await import('./src/windows/main-app')
            break
        }
        setAppComponent(() => module.default)
      } catch (err) {
        console.error('Failed to load app component:', err)
        setError(`Failed to load ${windowType} app`)
      } finally {
        setLoading(false)
      }
    }

    loadApp()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading {windowType} app...</div>
      </div>
    )
  }

  if (error || !AppComponent) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-destructive">{error || 'Failed to load app'}</div>
      </div>
    )
  }

  return <AppComponent />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppLoader />
    </QueryClientProvider>
  </React.StrictMode>,
)
