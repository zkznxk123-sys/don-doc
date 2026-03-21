/**
 * Lazy Prisma singleton using require() instead of static import.
 *
 * Static `import { PrismaClient } from '@prisma/client'` causes @prisma/client/runtime/library.js
 * to load at module evaluation time, which immediately tries to locate and load the native
 * query-engine binary. During Next.js "collect page data" build phase on Vercel this fails
 * because the build sandbox cannot find the correct binary.
 *
 * Using require() inside a function defers ALL @prisma/client loading until the first
 * actual DB call (inside a request handler), completely bypassing the build-phase issue.
 */

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  if (!globalForPrisma.prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client')
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}

// Re-export with the full PrismaClient type for autocomplete / type-safety.
// The type import is erased at runtime — it does NOT load @prisma/client.
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
