/**
 * Lazy Prisma singleton with build-phase resilience.
 *
 * During Next.js "collect page data", the AppRouteRouteModule may execute
 * the route handler, triggering prisma calls before the native query-engine
 * binary is fully available on Vercel's build environment.
 *
 * Strategy:
 * 1. NEXT_PHASE guard  — skip real init during build if the env var is set
 * 2. Lazy require()    — defer @prisma/client load until first DB call
 * 3. try/catch         — if new PrismaClient() fails (binary not found),
 *                        return a transparent stub; next request will retry
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as { prisma: any }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  // Guard 1: explicit build-phase check
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return buildStub()
  }

  if (!globalForPrisma.prisma) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client')
      globalForPrisma.prisma = new PrismaClient()
    } catch {
      // Guard 2: binary not found during build — return a stub so the build
      // succeeds; the real client will be created on the next request when
      // the binary is properly available at runtime.
      return buildStub()
    }
  }
  return globalForPrisma.prisma
}

function buildStub(): unknown {
  return new Proxy({}, {
    get: () => () => Promise.resolve(null),
  })
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
