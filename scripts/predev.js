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

// Patch static-paths-worker.js to handle PageNotFoundError (page not compiled yet in dev).
// jest-worker uses eval("require") (bundled require), so Module._load hooks in flush-fs.js
// do not intercept its function calls. The only reliable fix is a direct disk patch.
const path = require('path')
const spwPath = path.join(__dirname, '../node_modules/next/dist/server/dev/static-paths-worker.js')
const PATCH_SENTINEL = '// [flush-fs PageNotFoundError patch]'
try {
  let spwContent = fs.readFileSync(spwPath, 'utf8')
  if (!spwContent.includes(PATCH_SENTINEL)) {
    spwContent = spwContent.replace(
      `    const components = await (0, _loadcomponents.loadComponents)({
        distDir,
        // In \`pages/\`, the page is the same as the pathname.
        page: page || pathname,
        isAppPath,
        isDev: true,
        sriEnabled
    });`,
      `    ${PATCH_SENTINEL}
    let components;
    try {
        components = await (0, _loadcomponents.loadComponents)({
            distDir,
            // In \`pages/\`, the page is the same as the pathname.
            page: page || pathname,
            isAppPath,
            isDev: true,
            sriEnabled
        });
    } catch (e) {
        if (e && (e.name === 'PageNotFoundError' || (e.message && e.message.includes('Cannot find module for page')))) {
            return { prerenderedRoutes: [], fallbackMode: 'NOT_FOUND' };
        }
        throw e;
    }`
    )
    fs.writeFileSync(spwPath, spwContent)
  }
} catch (_) {}
