import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import type { TrpcContext as AppTrpcContext } from './context'

/**
 * Core tRPC instance configuration for the Electron application.
 *
 * This instance provides the foundation for all tRPC procedures and routers,
 * configured with Electron-specific optimizations and error handling.
 *
 * @remarks
 * - Uses superjson transformer for handling complex data types (Dates, BigInts, etc.)
 * - Implements custom error formatting for better debugging experience
 * - Integrates with the app's context system for type safety
 */
const t = initTRPC.context<AppTrpcContext>().create({
  /**
   * Data transformation layer for serialization between main and renderer processes.
   *
   * Superjson handles complex JavaScript types that JSON.stringify cannot serialize,
   * ensuring data integrity when passing objects through Electron's IPC channels.
   *
   * @example
   * // These types are automatically handled:
   * // - Date objects → ISO strings → Date objects
   * // - BigInt → string → BigInt
   * // - undefined → null → undefined
   * // - Map/Set → serialized → Map/Set
   */
  transformer: superjson,

  /**
   * Custom error formatter that enhances Zod validation errors for better debugging.
   *
   * When Zod validation fails, this formatter extracts the detailed validation errors
   * and includes them in the error response, making it easier to identify which
   * fields failed validation and why.
   *
   * @param shape - The default error shape from tRPC
   * @param error - The original error that occurred
   * @returns Enhanced error shape with Zod validation details
   *
   * @example
   * // Error response will include:
   * // {
   * //   message: "Validation failed",
   * //   code: "BAD_REQUEST",
   * //   data: {
   * //     zodError: {
   * //       fieldErrors: { email: ["Invalid email format"] },
   * //       formErrors: ["Missing required fields"]
   * //     }
   * //   }
   * // }
   */
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

/**
 * Router factory function for creating tRPC routers.
 *
 * Use this to create new routers that will inherit the app's context,
 * transformer, and error handling configuration.
 *
 * @example
 * ```typescript
 * export const appRouter = createTRPCRouter({
 *   users: userRouter,
 *   projects: projectRouter,
 * });
 * ```
 */
export const createTRPCRouter = t.router

/**
 * Base procedure for public endpoints that don't require authentication.
 *
 * This procedure provides the foundation for all public tRPC endpoints,
 * automatically inheriting the app's context, validation, and error handling.
 *
 * @example
 * ```typescript
 * export const getUserProcedure = publicProcedure
 *   .input(z.object({ id: z.string() }))
 *   .query(async ({ ctx, input }) => {
 *     return await getUserById(input.id);
 *   });
 * ```
 *
 * @see {@link AppTrpcContext} for available context properties
 */
export const publicProcedure = t.procedure
