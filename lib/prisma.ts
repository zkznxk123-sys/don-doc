/**
 * Lazy Prisma singleton.
 *
 * Two-layer defense against build-time binary loading failures on Vercel:
 *
 * 1. NEXT_PHASE check: During "phase-production-build", return a no-op stub
 *    so no Prisma code runs at all during the build.
 *
 * 2. Lazy require(): @prisma/client is require()'d inside a function,
 *    never at module import time, so the native binary is only loaded
 *    during actual request handling.
 */

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  // Absolute guard: if we're in the Next.js build phase, never touch Prisma.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return new Proxy({} as any, { get: () => () => Promise.resolve(null) })
  }
  if (!globalForPrisma.prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client')
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma: import('@prisma/client').PrismaClient = new Proxy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  {} as any,
  {
    get(_target, prop: string) {
      const client = getClient()
      const val = client[prop]
      return typeof val === 'function' ? val.bind(client) : val
    },
  },
)
