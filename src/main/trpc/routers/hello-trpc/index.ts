import { createTRPCRouter, publicProcedure } from '../../trpc'
import { z } from 'zod'

export const helloTrpcRouter = createTRPCRouter({
  db: publicProcedure.query(async ({ ctx }) => {
    const start = performance.now()
    await ctx.prisma.$queryRaw`SELECT 1`
    const durationMs = Math.round(performance.now() - start)
    return { ok: true, durationMs } as const
  }),

  time: publicProcedure.query(async () => {
    return { now: new Date().toISOString() } as const
  }),

  helloWithName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ input }) => {
      return { greeting: `Hello ${input.name}` } as const
    }),

  echo: publicProcedure.input(z.object({ text: z.string().min(1) })).mutation(async ({ input }) => {
    return { echoed: input.text.toUpperCase() } as const
  }),

  letters: publicProcedure
    .input(
      z
        .object({
          cursor: z.string().length(1).optional(),
          pageSize: z.number().int().min(1).max(5).default(3),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const startChar = (input?.cursor ?? 'A').charCodeAt(0)
      const pageSize = input?.pageSize ?? 3
      const items = Array.from({ length: pageSize })
        .map((_, i) => String.fromCharCode(startChar + i))
        .filter((c) => c <= 'Z')
      const last = items[items.length - 1]
      const nextCursor = last && last < 'Z' ? String.fromCharCode(last.charCodeAt(0) + 1) : null
      return { items, nextCursor } as const
    }),

  ticks: publicProcedure.subscription(async function* () {
    // Minimal async-iterable subscription to avoid deprecated Observable signature
    // Emits an ISO timestamp every second
    // tRPC will handle cancellation by disposing the async generator
    while (true) {
      yield new Date().toISOString()
      await new Promise((r) => setTimeout(r, 1000))
    }
  }),
})
