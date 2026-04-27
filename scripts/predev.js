const fs = require('fs')

// Ensure .next/server directory and stub manifests exist before Next.js
// tries to require() them (macOS APFS race condition workaround)
const serverDir = '.next/server'
fs.mkdirSync(serverDir, { recursive: true })

const stubs = {
  'middleware-manifest.json': { version: 3, middleware: {}, sortedMiddleware: [], functions: {} },
  'next-font-manifest.json': { pages: {}, app: {} },
}

for (const [name, content] of Object.entries(stubs)) {
  const p = `${serverDir}/${name}`
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(content))
  }
}

// Ensure webpack cache directories exist (avoids rename ENOENT warnings)
const cacheDirs = [
  '.next/cache/webpack/edge-server-development',
  '.next/cache/webpack/server-development',
  '.next/cache/webpack/client-development',
  '.next/cache/webpack/client-development-fallback',
]
for (const d of cacheDirs) {
  fs.mkdirSync(d, { recursive: true })
}
