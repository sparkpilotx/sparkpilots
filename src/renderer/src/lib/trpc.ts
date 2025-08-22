/**
 * tRPC v11 client integration for the Electron renderer process.
 *
 * This module provides a comprehensive tRPC client setup optimized for Electron
 * applications, featuring split transport strategies, React Query integration,
 * and type-safe API communication between renderer and main processes.
 *
 * @remarks
 * Architecture decisions:
 * - Split transport by operation type: subscriptions use Server-Sent Events (SSE)
 *   via `httpSubscriptionLink`, while queries/mutations use HTTP batching via
 *   `httpBatchLink`. This yields a single client that can handle real-time
 *   streams and efficient batched requests.
 * - `superjson` is configured at the link-level so complex data (Dates, Maps, etc.)
 *   round-trips seamlessly between server and client. The server also opts into
 *   `superjson` in `initTRPC(...).create({ transformer: superjson })`.
 * - The base URL comes from `VITE_TRPC_HTTP_URL`, which is treated as the single
 *   source of truth and shared with the main process tRPC server. This ensures
 *   both processes agree on the host/port and endpoint path.
 * - We export three flavors for different usage patterns:
 *   - `trpc`: An options-proxy for TanStack React Query. Use with `useQuery`,
 *     `useMutation`, etc. Example: `useQuery(trpc.notes.list.queryOptions())`.
 *   - `trpcClient`: A low-level client for imperative calls/streams without
 *     React Query. Example: `trpcClient.notes.onCreated.subscribe(...)`.
 *   - `trpcProxy`: A proxy-style client with method-chaining ergonomics for
 *     imperative usage. Example: `trpcProxy.greeting.hello.query({ name: 'x' })`.
 *
 * @see {@link https://trpc.io/docs/client/vanilla} for vanilla client usage
 * @see {@link https://trpc.io/docs/client/react} for React Query integration
 * @see {@link https://trpc.io/docs/client/links} for transport link configuration
 */
import { QueryClient } from '@tanstack/react-query'
import {
  createTRPCClient,
  createTRPCProxyClient,
  httpBatchLink,
  httpSubscriptionLink,
  loggerLink,
  splitLink,
} from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'

import type { AppRouter } from '@shared/trpc'

/**
 * Global TanStack Query client for the renderer process.
 *
 * This client manages the caching, background updates, and synchronization
 * of server state in the renderer process. It's configured with Electron-specific
 * optimizations for desktop application usage patterns.
 *
 * @remarks
 * Configuration rationale:
 * - `retry: 1`: Be gentle with retries in a desktop context to avoid bursts
 *   of network requests that could impact user experience
 * - `staleTime: 30_000`: Keep data fresh enough without excessive refetching,
 *   balancing responsiveness with network efficiency
 *
 * @example
 * ```typescript
 * // Invalidate queries when needed
 * queryClient.invalidateQueries({ queryKey: trpc.hello.hello.queryKey() });
 *
 * // Prefetch data for better UX
 * queryClient.prefetchQuery(trpc.hello.helloWithName.queryOptions({ name: 'User' }));
 * ```
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - 保持数据更长时间
    },
  },
})

/**
 * Base HTTP URL for tRPC server communication.
 *
 * This URL represents the endpoint where the main process tRPC server is listening.
 * It's sourced from the same environment variable that the main process server
 * uses for binding, ensuring both processes agree on the communication endpoint.
 *
 * @example
 * ```typescript
 * // Environment: VITE_TRPC_HTTP_URL=http://127.0.0.1:3001/trpc
 * // API_URL = "http://127.0.0.1:3001/trpc"
 * ```
 *
 * @see {@link https://trpc.io/docs/server/adapters/standalone} for server configuration
 */
const API_URL = import.meta.env.VITE_TRPC_HTTP_URL

/**
 * Transport link chain for the tRPC client.
 *
 * This configuration defines how the tRPC client communicates with the server,
 * implementing a sophisticated routing strategy based on operation types.
 *
 * @remarks
 * Link configuration:
 * - `loggerLink`: Enabled only in development for visibility into operations
 * - `splitLink`: Routes operations based on type for optimal transport
 * - `httpSubscriptionLink`: Handles real-time subscriptions via Server-Sent Events
 * - `httpBatchLink`: Batches queries/mutations for efficient HTTP communication
 * - `transformer: superjson`: Applied on both links to match server configuration
 *
 * @example
 * ```typescript
 * // Subscriptions automatically use SSE transport
 * trpcClient.hello.echo.subscribe({ text: 'Hello' }, {
 *   onData: (data) => console.log('Received:', data)
 * });
 *
 * // Queries/mutations use batched HTTP transport
 * const result = await trpcClient.hello.helloWithName.query({ name: 'World' });
 * ```
 */
const links = [
  // Enable request logging in development for visibility
  ...(import.meta.env.DEV ? [loggerLink({ enabled: () => true })] : []),
  splitLink({
    condition: (op) => op.type === 'subscription',
    true: httpSubscriptionLink({ url: API_URL, transformer: superjson }),
    false: httpBatchLink({ url: API_URL, transformer: superjson }),
  }),
]

/**
 * Low-level tRPC client for imperative usage and subscriptions.
 *
 * This client provides direct access to tRPC procedures without React Query
 * integration. It's ideal for:
 * - Subscriptions and real-time data streams
 * - Imperative API calls outside of React components
 * - Custom caching and state management logic
 *
 * @example
 * ```typescript
 * // Subscribe to real-time updates
 * const unsubscribe = trpcClient.hello.echo.subscribe(
 *   { text: 'Hello World' },
 *   {
 *     onData: (data) => console.log('Echo response:', data),
 *     onError: (error) => console.error('Subscription error:', error)
 *   }
 * );
 *
 * // Imperative query call
 * const greeting = await trpcClient.hello.hello.query();
 *
 * // Clean up subscription
 * unsubscribe();
 * ```
 */
const trpcClient = createTRPCClient<AppRouter>({ links })

/**
 * Proxy-style imperative client with convenient method chaining.
 *
 * This client provides a more ergonomic API for imperative usage, with
 * method chaining that makes complex operations more readable.
 *
 * @example
 * ```typescript
 * // Method chaining for complex operations
 * const result = await trpcProxy.hello
 *   .helloWithName
 *   .query({ name: 'Developer' });
 *
 * // Direct procedure access
 * const echo = await trpcProxy.hello.echo.query({
 *   text: 'Test message',
 *   number: 42
 * });
 * ```
 */
const trpcProxy = createTRPCProxyClient<AppRouter>({ links })

/**
 * React Query options-proxy for seamless React integration.
 *
 * This proxy generates query and mutation options that can be used directly
 * with TanStack React Query hooks, providing full type safety and automatic
 * caching, background updates, and error handling.
 *
 * @remarks
 * Usage patterns:
 * - Use with `useQuery` for data fetching with automatic caching
 * - Use with `useMutation` for data modifications with optimistic updates
 * - Combine with `trpcClient` for subscriptions and custom invalidation
 *
 * @example
 * ```typescript
 * // Query with automatic caching and background updates
 * const { data, isLoading, error } = useQuery(
 *   trpc.hello.hello.queryOptions()
 * );
 *
 * // Mutation with optimistic updates
 * const mutation = useMutation(
 *   trpc.hello.helloWithName.mutationOptions()
 * );
 *
 * // Subscription with query invalidation
 * useEffect(() => {
 *   const unsubscribe = trpcClient.hello.echo.subscribe(
 *     { text: 'Update' },
 *     {
 *       onData: () => {
 *         // Invalidate related queries when subscription data arrives
 *         queryClient.invalidateQueries({
 *           queryKey: trpc.hello.hello.queryKey()
 *         });
 *       }
 *     }
 *   );
 *
 *   return unsubscribe;
 * }, []);
 * ```
 *
 * @see {@link https://trpc.io/docs/client/react} for React Query integration details
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient })

/**
 * Export all client variants for different usage patterns.
 *
 * - `trpc`: React Query integration (recommended for most use cases)
 * - `trpcClient`: Low-level client for subscriptions and imperative calls
 * - `trpcProxy`: Proxy-style client for method chaining ergonomics
 */
export { trpcClient, trpcProxy }
