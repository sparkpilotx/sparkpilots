## tRPC v11 integration (Electron + TanStack Query)

This document explains how tRPC v11 is integrated into application, aligned with the current codebase: embedded server in the main process, TanStack React Query client in the renderer, link configuration (batching + SSE), CSP, environment variables, and minimal usage.

### Why tRPC v11 + TanStack Query

- **Simpler DX**: query-native via TanStack integration
- **End-to-end typing**: shared `AppRouter` across main/renderer
- **Efficient transport**: HTTP batching for queries/mutations, SSE for subscriptions

References:

- [Setup with TanStack React Query](https://trpc.io/docs/client/tanstack-react-query/setup)
- [Links overview](https://trpc.io/docs/client/links)
- [Subscriptions](https://trpc.io/docs/server/subscriptions)

---

## Architecture overview

- **Server**: Embedded standalone HTTP tRPC server in Electron main process
  - Base URL from single source of truth: `VITE_TRPC_HTTP_URL`
  - Default in `.env.local`: `http://127.0.0.1:3001/trpc`
  - Accepts nested paths under the endpoint (e.g., `/trpc/helloTrpc.time`)
- **Client**: TanStack React Query v5 + tRPC v11 client in renderer
  - Batching: `httpBatchLink`
  - Subscriptions: `httpSubscriptionLink` (SSE)
  - Split transport with `splitLink` by `op.type === 'subscription'`
  - Optional dev logging with `loggerLink` (not enabled by default in this codebase)

---

## Server (main process)

- **Files**
  - `src/main/trpc/trpc.ts` — tRPC init (transformer, errorFormatter), base procedures
  - `src/main/trpc/router.ts` — Compose domain routers into `appRouter`; export `AppRouter`
  - `src/main/trpc/routers/hello-trpc/index.ts` — `helloTrpcRouter` (domain procedures)
  - `src/main/trpc/server.ts` — Start/stop server and route `/trpc/*`
  - `src/main/index.ts` — Wires server start on `app.whenReady()` and stop on quit
  - `src/main/trpc/context.ts` — Provides per-request context
  - `src/main/shared/trpc.ts` — Shared AppRouter type export for cross-process access

- **Router highlights (helloTrpc)**
  - `helloTrpc.db` → Database connectivity health check (`SELECT 1`) with duration
  - `helloTrpc.time` → Returns current ISO timestamp
  - `helloTrpc.helloWithName({ name: string })` → Personalized greeting with Zod validation
  - `helloTrpc.echo({ text: string })` → Uppercases text (mutation)
  - `helloTrpc.letters({ cursor?, pageSize? })` → Cursor-based pagination over alphabet
  - `helloTrpc.ticks` → Subscription streaming ISO timestamps (SSE)

- **Server adapter** (`src/main/trpc/server.ts`)
  - Uses `@trpc/server/adapters/standalone` `createHTTPHandler`
  - Handles CORS for Vite renderer in dev
  - Strictly filters to the configured endpoint and rewrites incoming `req.url` from `/trpc/<procedure>` to `/<procedure>` before delegating

---

## Client (renderer)

- **File**: `src/renderer/src/lib/trpc.ts`
  - Exports a shared `queryClient` (TanStack React Query)
  - Configures links with:
    - `splitLink({ condition: op.type === 'subscription', true: httpSubscriptionLink, false: httpBatchLink })`
    - Note: `loggerLink` can be added in dev if needed
  - Reads API URL from `VITE_TRPC_HTTP_URL` (default in `.env.local`: `http://127.0.0.1:3001/trpc`)
  - Exposes three utilities:
    - `trpcClient` — low-level client for imperative `.query()` / `.mutate()` / `.subscribe()`
    - `trpcProxy` — proxy client for ergonomic calls (e.g., `trpcProxy.helloTrpc.time.query()`)
    - `trpc` — TanStack options proxy for `.queryOptions()` / `.mutationOptions()`

- **Provider wiring**
  - The renderer is wrapped with `QueryClientProvider` in `src/renderer/index.tsx` using the exported `queryClient`.
- **Interactive examples**
  - A guided window at `src/renderer/src/windows/hello-trpc/` demonstrates queries, mutations, subscriptions (SSE), infinite queries, and cache management.

---

## Content Security Policy (CSP)

To allow outbound HTTP(S) and SSE connections to the local tRPC server, `src/renderer/index.html` sets `connect-src`:

```
connect-src 'self' http: https: data: blob: ws:
```

Without this, browser fetch/SSE will be blocked by `default-src 'self'`.

---

## Environment variables

Defined in `.env.local` and typed in `src/main/env.d.ts` and `src/renderer/env.d.ts`.

- `VITE_TRPC_HTTP_URL` — base server URL, including endpoint. Example:

```
VITE_TRPC_HTTP_URL=http://127.0.0.1:3001/trpc
```

The server and client both read this exact value to ensure consistency.

---

## Minimal usage

Examples:

- Imperative (proxy client):

```ts
import { trpcProxy, trpcClient } from '@/lib/trpc'
// Query
const now = await trpcProxy.helloTrpc.time.query()
const greeting = await trpcProxy.helloTrpc.helloWithName.query({ name: 'Simon' })
// Mutation
const echoed = await trpcClient.helloTrpc.echo.mutate({ text: 'Hello' })
```

- With TanStack Query options proxy:

```ts
import { trpc } from '@/lib/trpc'
const timeQuery = trpc.helloTrpc.time.queryOptions()
const nameQuery = trpc.helloTrpc.helloWithName.queryOptions({ name: 'User' })
// useQuery(timeQuery)
// useQuery(nameQuery)
```

- In React components:

```tsx
import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'

const { data, isLoading, error } = useQuery(trpc.helloTrpc.time.queryOptions())
```

---

## Run & verify

1. Ensure `.env.local` includes:

```
VITE_TRPC_HTTP_URL=http://127.0.0.1:3001/trpc
```

2. Start dev

```
npm run dev
```

3. Confirm server banner appears in terminal:

```
[tRPC] listening at http://127.0.0.1:3001/trpc
```

4. The app will automatically display the tRPC samples in the renderer, or call the hello endpoints from the renderer using the examples above.

---

## Troubleshooting

- **404 on `/trpc/<procedure>`**
  - Ensure server is running and the route rewriter is active (we strip `/trpc` before delegating)
  - Confirm `VITE_TRPC_HTTP_URL` host/port matches
  - Check that the procedure path matches the router structure (e.g., `helloTrpc.time`)

- **CSP errors** (Refused to connect due to `default-src 'self'`)
  - Ensure `src/renderer/index.html` includes `connect-src 'self' http: https: data: blob: ws:`

- **Subscriptions not streaming**
  - Check `connect-src` allows `http:` and `data:` for SSE
  - Confirm `httpSubscriptionLink` is active for `op.type === 'subscription'`

- **CORS/methods**
  - The server allows `GET, POST, OPTIONS` to support SSE, queries, and mutations via `httpBatchLink`.

- **TypeScript errors in renderer**
  - Ensure `tsconfig.web.json` includes `src/main/trpc/**/*` for type access
  - Verify shared types are properly exported from `src/main/shared/trpc.ts`

---

## Recommended usage patterns

- **trpcProxy**: ergonomic imperative query calls
- **trpcClient**: low-level imperative calls (queries/mutations/subscriptions)
- **trpc**: options proxy for declarative TanStack Query hooks
- **Interactive Guide**: Use `src/renderer/src/windows/hello-trpc/` as a reference for end-to-end patterns

---

## File map (key integration points)

- **Server**
  - `src/main/trpc/trpc.ts`
  - `src/main/trpc/router.ts`
  - `src/main/trpc/routers/hello-trpc/index.ts`
  - `src/main/trpc/server.ts`
  - `src/main/trpc/context.ts`
  - `src/main/index.ts`
  - `src/main/shared/trpc.ts`

- **Client**
  - `src/renderer/src/lib/trpc.ts`
  - `src/renderer/index.tsx` (provider wiring)
  - `src/renderer/src/windows/hello-trpc/` (interactive guide)

- **Interactive Guide**
  - `src/renderer/src/windows/hello-trpc/`

- **Shared typing**
  - `src/main/shared/trpc.ts` (re-exports `AppRouter`)

- **CSP**
  - `src/renderer/index.html`

- **Env typing**
  - `src/main/env.d.ts`
  - `src/renderer/env.d.ts`

---

## Notes

- SSE is preferred over WebSockets for desktop simplicity; if you need WS, switch to `wsLink` and run a WS server
- Keep envs synced to avoid confusing 404s or CORS/CSP issues
- Sample components are organized by router for better maintainability and scalability
- The main samples container automatically displays all available router samples
- TypeScript project references are enabled for better build performance and type safety
