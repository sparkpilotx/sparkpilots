import React from 'react'
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { createHashHistory } from '@tanstack/history'
import { queryClient, trpcClient } from '@/lib/trpc'

type ControlContext = {
  queryClient: typeof queryClient
}

// 专用于控制面板的根路由
const controlRoot = createRootRouteWithContext<ControlContext>()({
  component: function ControlLayout(): React.JSX.Element {
    return (
      <div className="h-screen bg-background text-foreground p-4">
        <div className="h-full space-y-4 text-sm">
          <div className="rounded border bg-card p-3">
            <h3 className="mb-2 font-medium">Control Panel</h3>
            <ControlForm />
          </div>
        </div>
      </div>
    )
  },
})

function ControlForm(): React.JSX.Element {
  const [echoText, setEchoText] = React.useState(() => {
    try {
      return localStorage.getItem('sparkpilot-echo-text') || 'Hello World'
    } catch {
      return 'Hello World'
    }
  })
  const [echoResult, setEchoResult] = React.useState<string | null>(null)

  React.useEffect(() => {
    try {
      localStorage.setItem('sparkpilot-echo-text', echoText)
    } catch {}
  }, [echoText])

  const handleEcho = async (): Promise<void> => {
    try {
      const result = await trpcClient.helloTrpc.echo.mutate({ text: echoText })
      setEchoResult(result.echoed)
    } catch (error) {
      setEchoResult(`Error: ${(error as Error).message}`)
    }
  }

  const handleClearCache = (): void => {
    queryClient.clear()
    setEchoResult('Cache cleared')
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Echo Text</label>
        <input
          type="text"
          value={echoText}
          onChange={(e) => setEchoText(e.target.value)}
          className="mt-1 w-full rounded border bg-background px-2 py-1 text-xs"
        />
        <button
          onClick={handleEcho}
          className="mt-1 mr-2 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          Send Echo
        </button>
        <button
          onClick={handleClearCache}
          className="mt-1 rounded border px-2 py-1 text-xs hover:bg-accent"
        >
          Clear Cache
        </button>
        {echoResult && (
          <div className="mt-1 text-xs text-muted-foreground">Result: {echoResult}</div>
        )}
      </div>
    </div>
  )
}

// 控制面板只有单个路由
const controlIndex = createRoute({
  getParentRoute: () => controlRoot,
  path: '/',
  component: () => null, // 内容在根布局中
})

const controlRouteTree = controlRoot.addChildren([controlIndex])

const controlRouter = createRouter({
  routeTree: controlRouteTree,
  history: createHashHistory(),
  context: { queryClient },
})

// 避免全局模块声明冲突，使用局部类型推断

const ControlApp = (): React.JSX.Element => {
  return <RouterProvider router={controlRouter} />
}

export default ControlApp
