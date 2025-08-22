/**
 * Prisma client bootstrap for the Electron main process.
 *
 * Design note:
 * - Goal: maintain a single `PrismaClient` instance across dev hot-reloads to avoid
 *   connection exhaustion and reconnect storms.
 * - Non-goals: runtime client reconfiguration or multiple database targets.
 * - Trade-offs: uses a mutable `globalThis` slot in development to persist the client,
 *   which is acceptable given Electron main's single process model.
 *
 * Preconditions:
 * - `import.meta.env.MAIN_VITE_POSTGRES_URL` must be defined and the database reachable.
 *
 * Concurrency:
 * - Electron main is single-threaded; Prisma manages an internal connection pool.
 * - This module exposes a single shared client to all consumers.
 *
 * Side effects:
 * - In non-production, attaches the client to `globalThis` so HMR reuses it.
 */
import { PrismaClient as PrismaClientRuntime } from '@prisma/client'
// Intentionally avoid importing PrismaClient type directly to keep `unknown` and satisfy ESLint rules
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { platform, is } from '@electron-toolkit/utils'

// Ensure Prisma Node-API engine path is correctly resolved in packaged apps
const engineFileName = platform.isMacOS
  ? 'libquery_engine.dylib.node'
  : platform.isWindows
    ? 'query_engine.dll.node'
    : 'libquery_engine.so.node'

const enginesDir = is.dev
  ? resolve('node_modules/@prisma/engines')
  : join(process.resourcesPath, '@prisma', 'engines')

const enginePath = join(enginesDir, engineFileName)
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY && existsSync(enginePath)) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath
}

// Maintain a single PrismaClient instance across hot reloads in development.
// Stores a stable reference on globalThis to prevent pool growth during HMR.
const globalForPrisma = globalThis as unknown as { prisma?: unknown }

/**
 * Shared `PrismaClient` instance for the main process.
 *
 * @remarks
 * - Logs are limited to 'error' and 'warn' to reduce noise.
 * - Data source URL is read from `MAIN_VITE_POSTGRES_URL`.
 */
type PrismaClientConstructor = new (config: {
  log: Array<'error' | 'warn'>
  datasources: { db: { url: string } }
}) => unknown

const PrismaClientCtor = PrismaClientRuntime as unknown as PrismaClientConstructor

export const prisma: unknown =
  globalForPrisma.prisma ??
  new PrismaClientCtor({
    log: ['error', 'warn'],
    datasources: {
      db: { url: import.meta.env.MAIN_VITE_POSTGRES_URL },
    },
  })

if (is.dev) {
  // Persist the client across module reloads in development to avoid new connections.
  globalForPrisma.prisma = prisma
}

/**
 * Performs a lightweight health check to assert database connectivity.
 * Executes a `SELECT 1` to validate reachability and credentials.
 *
 * @returns Promise<void> that resolves when the check succeeds.
 * @throws Error if the database is unreachable or misconfigured.
 *
 * @remarks
 * - Idempotent and safe to call at startup and before serving requests.
 * - Very low latency and load; suitable for liveness probes.
 */
export async function ensureDatabaseConnection(): Promise<void> {
  // Lightweight health check using a simple query
  const client = prisma as unknown as { $queryRaw: (q: TemplateStringsArray) => Promise<unknown> }
  await client.$queryRaw`SELECT 1`
}
