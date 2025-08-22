/**
 * tRPC HTTP server for Electron main process integration.
 *
 * This module implements a standalone tRPC server using the official standalone adapter,
 * designed specifically for Electron applications where the main process hosts the API
 * and renderer processes consume it via HTTP.
 *
 * @remarks
 * Architecture decisions:
 * - Uses @trpc/server/adapters/standalone for non-Next.js runtime compatibility
 * - Implements custom HTTP server for fine-grained control over CORS and routing
 * - Centralizes URL configuration via VITE_TRPC_HTTP_URL environment variable
 * - Provides idempotent start/stop operations for Electron lifecycle management
 *
 * @see {@link https://trpc.io/docs/server/adapters/standalone} for adapter details
 * @see {@link https://trpc.io/docs/server/context} for context creation patterns
 */
import http from 'http'
import { is } from '@electron-toolkit/utils'

import { createHTTPHandler } from '@trpc/server/adapters/standalone'

import { createContext } from './context'
import { appRouter } from './router'

/**
 * Node HTTP server instance maintained as module state.
 *
 * This pattern allows the module to coordinate server lifecycle operations
 * (start/stop) while maintaining a single server instance across multiple calls.
 *
 * @internal
 */
let server: http.Server | null = null

/**
 * Parse and validate the tRPC base URL from environment configuration.
 *
 * This function serves as the single source of truth for tRPC server configuration,
 * ensuring both the server binding and client connections use consistent URLs.
 *
 * @returns Parsed URL object with hostname, port, and endpoint path
 * @throws {Error} If VITE_TRPC_HTTP_URL is malformed or missing
 *
 * @example
 * ```typescript
 * // Environment: VITE_TRPC_HTTP_URL=http://localhost:3001/trpc
 * const url = getTrpcUrl();
 * // url.hostname = 'localhost'
 * // url.port = '3001'
 * // url.pathname = '/trpc'
 * ```
 */
function getTrpcUrl(): URL {
  const urlString = import.meta.env.VITE_TRPC_HTTP_URL
  return new URL(urlString)
}

/**
 * Normalize endpoint pathname to consistent, slash-prefixed format.
 *
 * Path normalization prevents subtle bugs when comparing or slicing path prefixes.
 * This ensures that both '/trpc' and 'trpc/' are treated as '/trpc' consistently.
 *
 * @param pathname - Raw pathname from URL parsing
 * @returns Normalized pathname with leading slash, no trailing slash
 *
 * @example
 * ```typescript
 * normalizeEndpointPath('trpc')     // → '/trpc'
 * normalizeEndpointPath('/trpc/')   // → '/trpc'
 * normalizeEndpointPath('/trpc')    // → '/trpc'
 * ```
 */
function normalizeEndpointPath(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`
  // Remove trailing slash (we handle nested routes explicitly)
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

/**
 * Immutable configuration snapshot computed at module load time.
 *
 * These values are computed once and reused throughout the module lifecycle,
 * avoiding repeated parsing and ensuring consistency across all operations.
 *
 * @internal
 */
const TRPC_URL = getTrpcUrl()
const ALLOWED_ORIGIN_PROD = TRPC_URL.origin
const ENDPOINT_PATH = normalizeEndpointPath(TRPC_URL.pathname)

/**
 * Compute host and port configuration for HTTP server binding.
 *
 * Port inference follows standard web conventions:
 * - Explicit ports in URL are used as-is
 * - HTTPS defaults to 443, HTTP defaults to 3001
 * - Fallback to 3001 for invalid port values
 *
 * @returns Object with host and port for server.listen()
 *
 * @example
 * ```typescript
 * // http://localhost:3001/trpc → { host: 'localhost', port: 3001 }
 * // https://api.example.com/trpc → { host: 'api.example.com', port: 443 }
 * // http://localhost/trpc → { host: 'localhost', port: 3001 }
 * ```
 */
function getBindConfig(): { host: string; port: number } {
  const host = TRPC_URL.hostname
  const portString = TRPC_URL.port || (TRPC_URL.protocol === 'https:' ? '443' : '3001')
  const parsedPort = Number(portString)
  const port = Number.isFinite(parsedPort) ? parsedPort : 3001
  return { host, port }
}

/**
 * Get the canonical HTTP URL for logging and cross-process communication.
 *
 * This URL represents the public endpoint that renderer processes will connect to.
 * It's constructed from the normalized configuration values for consistency.
 *
 * @returns Full HTTP URL string (e.g., "http://localhost:3001/trpc")
 *
 * @example
 * ```typescript
 * const url = getTrpcHttpUrl();
 * console.log(`tRPC server available at: ${url}`);
 * // Output: tRPC server available at: http://localhost:3001/trpc
 * ```
 */
export function getTrpcHttpUrl(): string {
  const { host, port } = getBindConfig()
  const protocol = TRPC_URL.protocol || 'http:'
  return `${protocol}//${host}:${port}${ENDPOINT_PATH}`
}

/**
 * Start the standalone tRPC HTTP server.
 *
 * This function implements a production-ready tRPC server with:
 * - Idempotent behavior (safe to call multiple times)
 * - Comprehensive CORS support for Electron multi-window scenarios
 * - Strict path filtering for security
 * - URL rewriting for tRPC adapter compatibility
 * - Structured error logging with path context
 *
 * @remarks
 * Server features:
 * - Accepts requests only under the configured endpoint path
 * - Rewrites URLs to strip endpoint prefix (e.g., /trpc/greeting.hello → /greeting.hello)
 * - Implements permissive CORS for development and multi-window support
 * - Provides detailed error logging for debugging
 *
 * @throws {Error} If server creation fails (port already in use, invalid host, etc.)
 *
 * @example
 * ```typescript
 * // Start the server
 * startTrpcServer();
 *
 * // Server is now listening and ready to accept requests
 * const url = getTrpcHttpUrl();
 * console.log(`Server running at: ${url}`);
 * ```
 */
export function startTrpcServer(): void {
  if (server) return

  const handler = createHTTPHandler({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`[tRPC] Error on path ${path ?? '<unknown>'}:`, error)
    },
  })

  server = http.createServer((req, res) => {
    // CORS: permissive in development; restricted in production (file:// or configured origin)
    const requestOrigin = (req.headers.origin as string | undefined) ?? 'null'
    if (is.dev) {
      res.setHeader('Access-Control-Allow-Origin', '*')
    } else {
      // Allow either the configured origin (if any) or the "null" origin used by file:// pages
      const allow = requestOrigin === 'null' || requestOrigin === ALLOWED_ORIGIN_PROD
      res.setHeader('Access-Control-Allow-Origin', allow ? requestOrigin : 'null')
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Headers', 'accept, content-type')
    // Allow POST to support httpBatchLink for queries/mutations; GET for SSE and simple queries
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Only handle requests to the tRPC endpoint (including nested paths, e.g., /trpc/<procedure>)
    const incomingUrl = new URL(req.url ?? '/', `${TRPC_URL.protocol}//${req.headers.host}`)
    const isExact = incomingUrl.pathname === ENDPOINT_PATH
    const isNested = incomingUrl.pathname.startsWith(`${ENDPOINT_PATH}/`)
    if (!isExact && !isNested) {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    // Strip the endpoint prefix so the handler receives
    // "/greeting.hello" instead of "/trpc/greeting.hello".
    // This matches how the standalone adapter expects paths to be shaped.
    const strippedPathname = incomingUrl.pathname.slice(ENDPOINT_PATH.length) || '/'
    const newUrl = strippedPathname + (incomingUrl.search || '')
    req.url = newUrl
    handler(req, res)
  })

  const { host, port } = getBindConfig()
  server.listen(port, host, () => {
    console.warn(`[tRPC] listening at ${getTrpcHttpUrl()}`)
  })
}

/**
 * Gracefully stop the tRPC HTTP server.
 *
 * This function ensures proper cleanup of server resources during:
 * - Application shutdown
 * - Development hot reloads
 * - Server restart scenarios
 *
 * The function is idempotent and safe to call multiple times.
 *
 * @returns Promise that resolves when the server has fully stopped
 *
 * @example
 * ```typescript
 * // Stop the server gracefully
 * await stopTrpcServer();
 * console.log('Server stopped successfully');
 *
 * // Can be called multiple times safely
 * await stopTrpcServer(); // No-op, resolves immediately
 * ```
 */
export async function stopTrpcServer(): Promise<void> {
  if (!server) return
  await new Promise<void>((resolve) => server?.close(() => resolve()))
  server = null
}

// AppRouter type is now exported from shared/trpc.ts for cross-process access
