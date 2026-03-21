import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Lazy Prisma singleton.
 *
 * new PrismaClient() loads the query-engine native binary immediately.
 * During Next.js "collect page data" build phase this runs in a sandboxed
 * worker where the binary path may not be resolvable, causing build failures.
 *
 * Using a Proxy defers instantiation until the first actual DB call
 * (i.e. inside a request handler, never at module-import time).
 */
function createPrismaClient(): PrismaClient {
  return globalForPrisma.prisma ?? new PrismaClient()
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = createPrismaClient()
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client
    }
    const val = (client as any)[prop as string]
    return typeof val === 'function' ? val.bind(client) : val
  },
})
