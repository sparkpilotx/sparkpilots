import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone'
import { prisma } from '../prisma'
import type { PrismaClient } from '@prisma/client'

/**
 * Inner context: request-independent resources that are always available to procedures.
 *
 * This context contains shared resources like:
 * - Database connections
 * - Configuration objects
 * - Utility functions
 * - Shared state
 *
 * The inner context is created once and reused across all requests,
 * making it ideal for expensive operations and shared resources.
 */
export async function createContextInner(): Promise<{ readonly prisma: PrismaClient }> {
  const prismaClient = prisma as unknown as PrismaClient
  return { prisma: prismaClient } as const
}

/**
 * Outer context: per-request values and the combined context for procedures.
 *
 * This function creates the context for each individual tRPC request by:
 * 1. Creating the inner context (shared resources)
 * 2. Merging it with request-specific data (headers, IP, user session, etc.)
 * 3. Returning the combined context object
 *
 * In Electron, this context can include:
 * - IPC channel information
 * - User preferences from main process
 * - File system access permissions
 * - Electron-specific metadata
 *
 * @param _opts - HTTP context options (currently unused in Electron setup)
 * @returns Combined context object available to all tRPC procedures
 */
export async function createContext(
  _opts?: CreateHTTPContextOptions,
): Promise<Awaited<ReturnType<typeof createContextInner>>> {
  const inner = await createContextInner()
  return { ...inner }
}

/**
 * Type definition for the tRPC context.
 *
 * This type represents the structure of the context object that will be
 * available to all tRPC procedures. It's derived from the inner context
 * since that's where the core shared resources are defined.
 *
 * Usage example:
 * ```typescript
 * export const exampleProcedure = publicProcedure
 *   .query(async ({ ctx }) => {
 *     // ctx has type TrpcContext
 *     return ctx.someResource;
 *   });
 * ```
 */
export type TrpcContext = Awaited<ReturnType<typeof createContextInner>>
