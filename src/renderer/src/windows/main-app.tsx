import React from 'react'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  useSearch,
} from '@tanstack/react-router'
import { createHashHistory } from '@tanstack/history'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { z } from 'zod'

type RouterContext = {
  queryClient: typeof queryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: function RootLayout(): React.JSX.Element {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-screen-md items-center justify-between px-4 py-3">
            <div className="text-sm font-medium">Sparkpilot</div>
            <nav className="app-region-no-drag flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <Link to="/hello" search={{ name: 'Simon' }} className="hover:text-foreground">Hello</Link>
              <Link to="/ticks" className="hover:text-foreground">Ticks</Link>
              <Link to="/db" className="hover:text-foreground">DB</Link>
              <Link to="/letters" search={{ pageSize: 3 }} className="hover:text-foreground">Letters</Link>
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-screen-md px-4 py-6">
          <Outlet />
        </div>
      </div>
    )
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function IndexRoute(): React.JSX.Element {
    const { data: now } = useQuery(trpc.helloTrpc.time.queryOptions())
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <div>TanStack Router + tRPC are wired.</div>
        <div>Current time (tRPC): {now?.now ?? '…'}</div>
      </div>
    )
  },
})

const helloSearchSchema = z.object({
  name: z.string().min(1).optional(),
})

const helloRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hello',
  validateSearch: (search) => helloSearchSchema.parse(search),
  loader: async ({ context, location }) => {
    const search = location.search as z.infer<typeof helloSearchSchema>
    const name = search.name ?? 'World'
    await context.queryClient.ensureQueryData(
      trpc.helloTrpc.helloWithName.queryOptions({ name }),
    )
    await context.queryClient.ensureQueryData(trpc.helloTrpc.time.queryOptions())
    return null
  },
  component: function HelloRoute(): React.JSX.Element {
    const { name } = useSearch({ from: helloRoute.id }) as z.infer<typeof helloSearchSchema>
    const effectiveName = name ?? 'World'
    const greetingQuery = trpc.helloTrpc.helloWithName.queryOptions({ name: effectiveName })
    const timeQuery = trpc.helloTrpc.time.queryOptions()
    const { data: greeting, isLoading: loadingGreeting } = useQuery(greetingQuery)
    const { data: now, isLoading: loadingTime } = useQuery(timeQuery)
    return (
      <div className="space-y-2 text-sm">
        <div className="text-muted-foreground">Query-prefetched via route loader.</div>
        <div>Greeting: {loadingGreeting ? '…' : greeting?.greeting}</div>
        <div>Time: {loadingTime ? '…' : now?.now}</div>
      </div>
    )
  },
})

const ticksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ticks',
  component: function TicksRoute(): React.JSX.Element {
    const [tick, setTick] = React.useState<string | null>(null)
    const [count, setCount] = React.useState<number>(0)

    React.useEffect(() => {
      const unsub = trpcClient.helloTrpc.ticks.subscribe(undefined, {
        onData: (iso) => {
          setTick(String(iso))
          setCount((c) => c + 1)
        },
        onError: () => {},
      })
      return () => unsub.unsubscribe()
    }, [])

    return (
      <div className="space-y-2 text-sm">
        <div className="text-muted-foreground">SSE subscription via tRPC.</div>
        <div>Last tick: {tick ?? '…'}</div>
        <div>Total ticks: {count}</div>
      </div>
    )
  },
})

const dbRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/db',
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(trpc.helloTrpc.db.queryOptions())
    return null
  },
  component: function DbRoute(): React.JSX.Element {
    const { data, error } = useQuery(trpc.helloTrpc.db.queryOptions())
    return (
      <div className="space-y-2 text-sm">
        <div className="text-muted-foreground">Database connectivity via tRPC.</div>
        {error ? (
          <div className="text-destructive">Error: {(error as unknown as Error).message}</div>
        ) : (
          <div>OK in {data?.durationMs} ms</div>
        )}
      </div>
    )
  },
})

const lettersSearch = z.object({ pageSize: z.coerce.number().min(1).max(5).default(3) })

const lettersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/letters',
  validateSearch: (search) => lettersSearch.parse(search),
  component: function LettersRoute(): React.JSX.Element {
    const { pageSize } = useSearch({ from: lettersRoute.id }) as z.infer<typeof lettersSearch>
    const {
      data,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
    } = useInfiniteQuery({
      queryKey: ['letters', pageSize],
      initialPageParam: undefined as string | undefined,
      queryFn: async ({ pageParam }) =>
        trpcClient.helloTrpc.letters.query({ cursor: pageParam, pageSize }),
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    })

    const items = data?.pages.flatMap((p) => p.items) ?? []

    return (
      <div className="space-y-3 text-sm">
        <div className="text-muted-foreground">Infinite letters via TanStack Query.</div>
        <div className="grid grid-cols-12 gap-1">
          {items.map((ch) => (
            <div key={ch} className="border bg-background px-2 py-1 text-center">
              {ch}
            </div>
          ))}
        </div>
        <button
          className="rounded border px-3 py-1 text-xs hover:bg-accent"
          disabled={!hasNextPage || isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? 'Loading…' : hasNextPage ? 'Load more' : 'No more'}
        </button>
      </div>
    )
  },
})



const routeTree = rootRoute.addChildren([
  indexRoute,
  helloRoute,
  ticksRoute,
  dbRoute,
  lettersRoute,
])

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const App = (): React.JSX.Element => {
  return <RouterProvider router={router} />
}

export default App
