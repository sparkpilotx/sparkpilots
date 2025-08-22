import { createTRPCRouter } from './trpc'
import { helloTrpcRouter } from './routers/hello-trpc'

export const appRouter = createTRPCRouter({
  helloTrpc: helloTrpcRouter,
})

export type AppRouter = typeof appRouter
