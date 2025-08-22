import React from 'react'
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { createHashHistory } from '@tanstack/history'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useQuery } from '@tanstack/react-query'

type DashboardContext = {
  queryClient: typeof queryClient
}

// 专用于仪表板的根路由
const dashboardRoot = createRootRouteWithContext<DashboardContext>()({
  component: function DashboardLayout(): React.JSX.Element {
    return (
      <div className="h-screen bg-background text-foreground p-4">
        <div className="h-full space-y-3 text-sm">
          <div className="rounded border bg-card p-3">
            <h3 className="mb-2 font-medium">System Dashboard</h3>
            <SystemStatus />
          </div>
          <div className="rounded border bg-card p-3">
            <h3 className="mb-2 font-medium">Live Data Stream</h3>
            <LiveTicks />
          </div>
        </div>
      </div>
    )
  },
})

function SystemStatus(): React.JSX.Element {
  const { data: dbHealth } = useQuery(trpc.helloTrpc.db.queryOptions())
  const { data: currentTime } = useQuery(trpc.helloTrpc.time.queryOptions())

  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <div className="text-muted-foreground">Database</div>
        <div className={dbHealth?.ok ? "text-green-600" : "text-red-600"}>
          {dbHealth?.ok ? `OK (${dbHealth.durationMs}ms)` : 'Error'}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground">Current Time</div>
        <div>{currentTime?.now ? new Date(currentTime.now).toLocaleTimeString() : '…'}</div>
      </div>
    </div>
  )
}

function LiveTicks(): React.JSX.Element {
  const [ticks, setTicks] = React.useState<string[]>([])

  React.useEffect(() => {
    const unsub = trpcClient.helloTrpc.ticks.subscribe(undefined, {
      onData: (tick) => {
        setTicks((prev) => [...prev.slice(-9), String(tick)])
      },
      onError: () => {},
    })
    return () => unsub.unsubscribe()
  }, [])

  return (
    <div className="space-y-1">
      {ticks.slice(-5).map((tick, i) => (
        <div key={i} className="rounded bg-background px-2 py-1 text-xs font-mono">
          {new Date(tick).toLocaleTimeString()}
        </div>
      ))}
      <div className="flex h-6 items-end gap-1">
        {ticks.slice(-15).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-primary"
            style={{ height: `${10 + (i % 4) * 5}px` }}
          />
        ))}
      </div>
    </div>
  )
}

// 仪表板只有单个路由
const dashboardIndex = createRoute({
  getParentRoute: () => dashboardRoot,
  path: '/',
  loader: async ({ context }) => {
    // 预取仪表板数据
    await context.queryClient.ensureQueryData(trpc.helloTrpc.db.queryOptions())
    await context.queryClient.ensureQueryData(trpc.helloTrpc.time.queryOptions())
    return null
  },
  component: () => null, // 内容在根布局中
})

const dashboardRouteTree = dashboardRoot.addChildren([dashboardIndex])

const dashboardRouter = createRouter({
  routeTree: dashboardRouteTree,
  history: createHashHistory(),
  context: { queryClient },
})

// 避免全局模块声明冲突，使用局部类型推断

const DashboardApp = (): React.JSX.Element => {
  return <RouterProvider router={dashboardRouter} />
}

export default DashboardApp
