// macOS APFS fix: force fsync on the parent directory after writing server files.
// Problem: on APFS, fs.writeFile with flush:true calls fdatasync which flushes FILE DATA
// but NOT the parent directory entry. The directory entry may remain invisible to
// subsequent stat()/readdir() calls until the parent directory is fsync'd.
//
// This manifests as: files ARE written (callback fires without error) but
// require() fails with MODULE_NOT_FOUND because statSync returns false.
//
// Fix: after writing any .next/server/ file, fsync the parent directory.
const fs = require('fs')
const nodePath = require('path')
const NEXT_DIR = nodePath.join(__dirname, '..', '.next')
const NEXT_SERVER = nodePath.join(__dirname, '..', '.next', 'server')
const VENDOR_DIR = nodePath.join(NEXT_SERVER, 'vendor-chunks')

// --- fsyncDir: fsync a directory to make its contents (new files/subdirs) visible ---
// On APFS, a newly created directory's own entry in its parent may also be invisible
// until the parent is fsynced. We walk UP the chain from NEXT_DIR to dirPath,
// fsyncing each level so that no level is invisibly "new".

async function fsyncDir(dirPath) {
  // Build the chain from NEXT_DIR down to dirPath
  const chain = []
  let cur = dirPath
  while (true) {
    chain.unshift(cur)
    if (cur === NEXT_DIR || cur === nodePath.dirname(cur)) break
    const parent = nodePath.dirname(cur)
    if (!cur.startsWith(NEXT_DIR)) break
    cur = parent
  }
  // Fsync each level: parent must be fsynced before child becomes visible
  for (const dir of chain) {
    try {
      const fd = await fs.promises.open(dir, 'r')
      try { await fd.sync() } catch (_) {}
      await fd.close()
    } catch (_) {}
  }
}

function fsyncDirSync(dirPath) {
  const chain = []
  let cur = dirPath
  while (true) {
    chain.unshift(cur)
    if (cur === NEXT_DIR || cur === nodePath.dirname(cur)) break
    const parent = nodePath.dirname(cur)
    if (!cur.startsWith(NEXT_DIR)) break
    cur = parent
  }
  for (const dir of chain) {
    try {
      const fd = fs.openSync(dir, 'r')
      try { fs.fsyncSync(fd) } catch (_) {}
      fs.closeSync(fd)
    } catch (_) {}
  }
}

// --- In-process manifest cache: bypass APFS directory entry race for manifests ---
// When a manifest is written and confirmed accessible, store its content here.
// NodeManifestLoader falls back to this cache when disk reads fail (ENOENT).
// Both write and read are in the same process, so a global variable is reliable.
global.__nextManifestCache = global.__nextManifestCache || new Map()  // absPath → string (JSON)
global.__nextCrmCache = global.__nextCrmCache || new Map()  // absPath → string (JS content for evalManifest)
global.__nextJsCache = global.__nextJsCache || new Map()  // absPath → string (compiled server JS for require)

// --- In-memory vendor chunk cache: survive between compilations ---
// When a vendor chunk is written, cache its content. If Module._load fails to find a
// vendor chunk (ENOENT), restore ALL missing chunks before retrying.
const vendorChunkCache = new Map()  // absPath → Buffer

// Restore every vendor chunk that is missing from disk in one shot.
// Always ensures VENDOR_DIR exists first.
function restoreAllVendorChunks() {
  if (vendorChunkCache.size === 0) return 0
  // Ensure vendor-chunks directory exists — it may have been deleted
  try { origMkdirSync(VENDOR_DIR, { recursive: true }) } catch (_) {}
  let restored = 0
  for (const [absPath, content] of vendorChunkCache) {
    try {
      fs.accessSync(absPath, fs.constants.F_OK)
      // File exists, skip
    } catch (_) {
      // File missing — write it back
      try {
        origWriteFileSync(absPath, content, { flush: true })
        restored++
      } catch (writeErr) {
        process.stderr.write('[flush-fs RESTORE ERR] ' + absPath + ': ' + writeErr.message + '\n')
      }
    }
  }
  if (restored > 0) {
    fsyncDirSync(VENDOR_DIR)
  }
  return restored
}

// --- Save originals before any patching ---

const origWriteFile = fs.writeFile.bind(fs)
const origWriteFileSync = fs.writeFileSync.bind(fs)
const origMkdir = fs.mkdir.bind(fs)
const origMkdirSync = fs.mkdirSync.bind(fs)
const origUnlink = fs.unlink.bind(fs)
const origUnlinkSync = fs.unlinkSync.bind(fs)
const origRmdir = fs.rmdir.bind(fs)
const origRmdirSync = fs.rmdirSync.bind(fs)
const origRm = fs.rm ? fs.rm.bind(fs) : null
const origRmSync = fs.rmSync ? fs.rmSync.bind(fs) : null

// Pre-create webpack cache directories so writes succeed on first run
;['client-development', 'server-development', 'edge-server-development', 'client-development-fallback'].forEach(d => {
  const dir = nodePath.join(NEXT_DIR, 'cache', 'webpack', d)
  try { origMkdirSync(dir, { recursive: true }) } catch (_) {}
  // fsync each created dir and its parents so APFS commits the directory entries immediately
  try {
    let cur = dir
    while (cur.startsWith(NEXT_DIR)) {
      try { const fd = fs.openSync(cur, 'r'); try { fs.fsyncSync(fd) } catch (_) {}; fs.closeSync(fd) } catch (_) {}
      const parent = nodePath.dirname(cur)
      if (parent === cur) break
      cur = parent
    }
  } catch (_) {}
})
// Brief synchronous wait for APFS to commit the newly created directory entries.
// Without this, edge-server compilation starts ~300ms later and APFS hasn't yet
// made the directories visible to rename() calls, causing pack cache ENOENT.
;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)

// --- writeFile patches: add flush:true + fsyncDir for all .next/server/ files ---

// On macOS APFS, mkdir({ recursive: true }) can fail with ENOENT if the parent
// directory was just created/renamed and isn't visible to the kernel yet.
function mkdirWithRetry(dir, retriesLeft, callback) {
  origMkdir(dir, { recursive: true }, (err) => {
    if (err && err.code === 'ENOENT' && retriesLeft > 0) {
      setTimeout(() => mkdirWithRetry(dir, retriesLeft - 1, callback), 20)
    } else {
      callback(err)
    }
  })
}

fs.writeFile = function (filePath, data, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = { flush: true }
  } else if (typeof options === 'string') {
    options = { encoding: options, flush: true }
  } else if (!options) {
    options = { flush: true }
  } else {
    options = { ...options, flush: true }
  }
  const dir = nodePath.dirname(filePath)
  const isVendorChunk = typeof filePath === 'string' && filePath.startsWith(VENDOR_DIR)
  const isServerFile = typeof filePath === 'string' && filePath.startsWith(NEXT_SERVER)
  mkdirWithRetry(dir, 15, (mkdirErr) => {
    origWriteFile(filePath, data, options, function(err) {
      if (!err && isVendorChunk) {
        // Cache vendor chunk content for restoration if it goes missing later
        vendorChunkCache.set(filePath, Buffer.isBuffer(data) ? data : Buffer.from(data))
      }
      const isCrm = typeof filePath === 'string' && filePath.includes('client-reference-manifest')
      if (!err && isCrm) {
        // Cache CRM JS content for evalManifest fallback (bypasses APFS race)
        const dataStr = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
        global.__nextCrmCache.set(filePath, dataStr)
      }
      if (!err && isServerFile && typeof filePath === 'string' && filePath.endsWith('.js')) {
        // Cache all server JS content so Module._load can create synthetic modules on ENOENT
        const dataStr = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
        global.__nextJsCache.set(filePath, dataStr)
      }
      // Cache webpack pack temp files (*.gz_) so rename can fall back to copy-write
      const isPackTemp = typeof filePath === 'string' && filePath.startsWith(NEXT_DIR) && filePath.includes('cache/webpack') && filePath.endsWith('_')
      if (!err && isPackTemp) {
        global.__nextPackCache = global.__nextPackCache || new Map()
        global.__nextPackCache.set(filePath, Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : String(data)))
      }
      // Fsync for .next/server/ files AND .next/static/ chunks/CSS (APFS dir-entry race fix)
      const isStaticNextFile = typeof filePath === 'string' && filePath.startsWith(nodePath.join(NEXT_DIR, 'static'))
      if (!err && (isServerFile || isStaticNextFile)) {
        const isManifest = typeof filePath === 'string' && filePath.endsWith('-manifest.json')
        fsyncDir(dir).then(() => {
          if (isServerFile && isManifest) {
            // Store in global manifest cache for NodeManifestLoader fallback
            const dataStr = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
            global.__nextManifestCache.set(filePath, dataStr)
            // Verify the manifest is actually accessible after fsync
            try {
              fs.accessSync(filePath, fs.constants.F_OK)
            } catch (e) {
              fsyncDirSync(dir)
            }
          }
          callback(null)
        }).catch(() => callback(null))
      } else {
        callback(err)
      }
    })
  })
}

fs.writeFileSync = function (filePath, data, options) {
  if (typeof options === 'string') {
    options = { encoding: options, flush: true }
  } else if (!options) {
    options = { flush: true }
  } else {
    options = { ...options, flush: true }
  }
  if (typeof filePath === 'string' && filePath.startsWith(NEXT_SERVER) && filePath.endsWith('.js') && !filePath.includes('vendor-chunks')) {
    fsyncDirSync(nodePath.dirname(filePath))
  }
  return origWriteFileSync(filePath, data, options)
}

const origPromisesWriteFile = fs.promises.writeFile.bind(fs.promises)
fs.promises.writeFile = async function (filePath, data, options) {
  if (typeof options === 'string') {
    options = { encoding: options, flush: true }
  } else if (!options) {
    options = { flush: true }
  } else {
    options = { ...options, flush: true }
  }
  const dir = nodePath.dirname(filePath)
  for (let i = 0; i < 15; i++) {
    try { await fs.promises.mkdir(dir, { recursive: true }); break }
    catch (e) { if (e.code !== 'ENOENT' || i === 14) break; await new Promise(r => setTimeout(r, 20)) }
  }
  await origPromisesWriteFile(filePath, data, options)
  const isVendorChunk = typeof filePath === 'string' && filePath.startsWith(VENDOR_DIR)
  const isServerFile = typeof filePath === 'string' && filePath.startsWith(NEXT_SERVER)
  // Cache webpack pack temp files written via promises path
  if (typeof filePath === 'string' && filePath.startsWith(NEXT_DIR) && filePath.includes('cache/webpack') && filePath.endsWith('_')) {
    global.__nextPackCache = global.__nextPackCache || new Map()
    global.__nextPackCache.set(filePath, Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : String(data)))
  }
  if (isVendorChunk) {
    vendorChunkCache.set(filePath, Buffer.isBuffer(data) ? data : Buffer.from(data))
  }
  const isStaticNextFile2 = typeof filePath === 'string' && filePath.startsWith(nodePath.join(NEXT_DIR, 'static'))
  if (isServerFile || isStaticNextFile2) {
    await fsyncDir(dir)
    if (isServerFile) {
      const isManifest = typeof filePath === 'string' && filePath.endsWith('-manifest.json')
      if (isManifest) {
        // Store in global manifest cache for NodeManifestLoader fallback (bypasses APFS race)
        const dataStr = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
        global.__nextManifestCache.set(filePath, dataStr)
        try {
          fs.accessSync(filePath, fs.constants.F_OK)
        } catch (e) {
          fsyncDirSync(dir)
        }
      }
    }
  }
}

// --- Deletion patches: log any removal inside .next/server/ to diagnose disappearing files ---


// --- rename patches ---
// For .next/server/ renames: fsync destination dir after rename.
// For ALL renames: if rename fails with ENOENT (source invisible on APFS),
// fsync the source directory and retry — this fixes pack cache rename warnings.
// Also log any rename that moves paths OUT of .next/server/ (potential deletion route).

const origPromisesRename = fs.promises.rename.bind(fs.promises)
fs.promises.rename = async function (oldPath, newPath) {
  // Ensure destination directory exists (handles APFS new-dir visibility)
  if (typeof newPath === 'string' && newPath.startsWith(NEXT_DIR)) {
    try { origMkdirSync(nodePath.dirname(newPath), { recursive: true }) } catch (_) {}
  }
  let lastErr = null
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await origPromisesRename(oldPath, newPath)
      lastErr = null
      break
    } catch (e) {
      if (e.code !== 'ENOENT') { lastErr = e; break }
      lastErr = e
      // Fsync source dir to force APFS to commit directory entries
      await fsyncDir(nodePath.dirname(oldPath))
      await new Promise(r => setTimeout(r, 80))
    }
  }
  if (lastErr) {
    // Rename ENOENT exhausted: try copy-write from in-process pack cache
    if (lastErr.code === 'ENOENT') {
      const packCache = global.__nextPackCache
      if (packCache && packCache.has(oldPath)) {
        const content = packCache.get(oldPath)
        try {
          await fs.promises.mkdir(nodePath.dirname(newPath), { recursive: true })
          await fs.promises.writeFile(newPath, content)
          await fsyncDir(nodePath.dirname(newPath))
          packCache.delete(oldPath)
          return
        } catch (_) {}
      }
    }
    throw lastErr
  }
  if (typeof newPath === 'string' && newPath.startsWith(NEXT_DIR) &&
      (newPath.startsWith(NEXT_SERVER) || newPath.includes('/cache/webpack/') ||
       newPath.startsWith(nodePath.join(NEXT_DIR, 'static')))) {
    await fsyncDir(nodePath.dirname(newPath))
  }
}

const origRename = fs.rename.bind(fs)
fs.rename = function (oldPath, newPath, callback) {
  origRename(oldPath, newPath, function (err) {
    if (!err) {
      // Fsync for server, pack cache, and static chunk renames (APFS dir-entry race fix)
      const needsFsync = typeof newPath === 'string' && newPath.startsWith(NEXT_DIR) &&
        (newPath.startsWith(NEXT_SERVER) || newPath.includes('/cache/webpack/') ||
         newPath.startsWith(nodePath.join(NEXT_DIR, 'static')))
      if (needsFsync) {
        fsyncDir(nodePath.dirname(newPath)).then(() => callback(null)).catch(() => callback(null))
      } else {
        callback(null)
      }
      return
    }
    if (err.code !== 'ENOENT') { return callback(err) }
    // ENOENT: try pack cache copy-write first (most reliable for APFS pack renames)
    const isPackRename = typeof oldPath === 'string' && oldPath.startsWith(NEXT_DIR) &&
        oldPath.includes('cache/webpack') && oldPath.endsWith('_')
    if (isPackRename) {
      const packCache = global.__nextPackCache
      if (packCache && packCache.has(oldPath)) {
        const content = packCache.get(oldPath)
        try {
          origMkdirSync(nodePath.dirname(newPath), { recursive: true })
          fs.writeFileSync(newPath, content)
          fsyncDirSync(nodePath.dirname(newPath))
          packCache.delete(oldPath)
          return callback(null)
        } catch (_) {}
      }
    }
    // Fallback: retry with fsync
    let attempt = 0
    function retry() {
      if (attempt >= 12) {
        // Last-resort: try pack cache copy-write
        if (isPackRename) {
          const packCache = global.__nextPackCache
          if (packCache && packCache.has(oldPath)) {
            const content = packCache.get(oldPath)
            try {
              origMkdirSync(nodePath.dirname(newPath), { recursive: true })
              fs.writeFileSync(newPath, content)
              fsyncDirSync(nodePath.dirname(newPath))
              packCache.delete(oldPath)
              return callback(null)
            } catch (_) {}
          }
        }
        return callback(err)
      }
      attempt++
      fsyncDir(nodePath.dirname(oldPath)).then(() => {
        setTimeout(() => {
          origRename(oldPath, newPath, function (err2) {
            if (!err2) {
              const needsFsync2 = typeof newPath === 'string' && newPath.startsWith(NEXT_DIR) &&
                (newPath.startsWith(NEXT_SERVER) || newPath.includes('/cache/webpack/') ||
                 newPath.startsWith(nodePath.join(NEXT_DIR, 'static')))
              if (needsFsync2) {
                fsyncDir(nodePath.dirname(newPath)).then(() => callback(null)).catch(() => callback(null))
              } else {
                callback(null)
              }
            } else if (err2.code === 'ENOENT') {
              retry()
            } else {
              callback(err2)
            }
          })
        }, 80)
      }).catch(() => callback(err))
    }
    retry()
  })
}

const origRenameSync = fs.renameSync.bind(fs)
fs.renameSync = function (oldPath, newPath) {
  try {
    origRenameSync(oldPath, newPath)
  } catch (e) {
    if (e.code === 'ENOENT') {
      fsyncDirSync(nodePath.dirname(oldPath))
      origRenameSync(oldPath, newPath)
    } else {
      throw e
    }
  }
  if (typeof newPath === 'string' && newPath.startsWith(NEXT_SERVER)) {
    fsyncDirSync(nodePath.dirname(newPath))
  }
}

// --- createWriteStream + open: pre-create parent dirs for .next/ paths ---
// webpack pack cache uses createWriteStream (not writeFile), so mkdir isn't called otherwise.

const origCreateWriteStream = fs.createWriteStream.bind(fs)
fs.createWriteStream = function (filePath, options) {
  if (typeof filePath === 'string' && filePath.startsWith(NEXT_DIR)) {
    try { origMkdirSync(nodePath.dirname(filePath), { recursive: true }) } catch (_) {}
  }
  const stream = origCreateWriteStream(filePath, options)
  // Capture pack temp-file content after stream closes (for rename ENOENT fallback)
  if (typeof filePath === 'string' && filePath.startsWith(NEXT_DIR) &&
      filePath.includes('cache/webpack') && filePath.endsWith('_')) {
    const chunks = []
    const origStreamWrite = stream.write.bind(stream)
    const origStreamEnd = stream.end.bind(stream)
    stream.write = function (chunk, ...rest) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      return origStreamWrite(chunk, ...rest)
    }
    stream.end = function (chunk, ...rest) {
      if (chunk && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      return origStreamEnd(chunk, ...rest)
    }
    stream.once('close', () => {
      const content = Buffer.concat(chunks)
      if (content.length > 0) {
        global.__nextPackCache = global.__nextPackCache || new Map()
        global.__nextPackCache.set(filePath, content)
      }
    })
  }
  return stream
}

// Track pack temp file fds: fd → { filePath, chunks[] }
// We intercept fs.open + fs.write + fs.close to capture written content.
// When rename ENOENT occurs, fs.rename retry uses global.__nextPackCache to copy-write.
const packTempFdInfo = new Map()

const origOpen = fs.open.bind(fs)
fs.open = function (filePath, flags, ...args) {
  const isPackTemp = typeof filePath === 'string' && filePath.startsWith(NEXT_DIR) &&
      filePath.includes('cache/webpack') && filePath.endsWith('_')
  if (typeof filePath === 'string' && filePath.startsWith(NEXT_DIR)) {
    const f = String(flags)
    if (f === 'w' || f === 'a' || f.includes('w') || typeof flags === 'number') {
      try { origMkdirSync(nodePath.dirname(filePath), { recursive: true }) } catch (_) {}
    }
  }
  if (isPackTemp) {
    const lastArg = args[args.length - 1]
    if (typeof lastArg === 'function') {
      const origCb = args.pop()
      args.push(function (err, fd) {
        if (!err && fd != null) { packTempFdInfo.set(fd, { filePath, chunks: [] }) }
        origCb(err, fd)
      })
    }
  }
  return origOpen(filePath, flags, ...args)
}

const origWrite = fs.write.bind(fs)
fs.write = function (fd, buffer, ...args) {
  const info = packTempFdInfo.get(fd)
  if (info) {
    // Capture the chunk written to a pack temp file
    if (Buffer.isBuffer(buffer)) {
      const offset = typeof args[0] === 'number' ? args[0] : 0
      const length = typeof args[1] === 'number' ? args[1] : buffer.length - offset
      info.chunks.push(buffer.slice(offset, offset + length))
    } else if (typeof buffer === 'string') {
      info.chunks.push(Buffer.from(buffer, typeof args[1] === 'string' ? args[1] : 'utf8'))
    }
  }
  return origWrite(fd, buffer, ...args)
}

const origClose = fs.close.bind(fs)
fs.close = function (fd, callback) {
  const info = packTempFdInfo.get(fd)
  if (info) {
    packTempFdInfo.delete(fd)
    origClose(fd, function (err) {
      // Store captured content in pack cache for rename fallback
      if (!err && info.chunks.length > 0) {
        const content = Buffer.concat(info.chunks)
        if (content.length > 0) {
          global.__nextPackCache = global.__nextPackCache || new Map()
          global.__nextPackCache.set(info.filePath, content)
        }
      }
      if (callback) callback(err)
    })
    return
  }
  return origClose(fd, callback)
}

const origPromisesOpen = fs.promises.open.bind(fs.promises)
fs.promises.open = async function (filePath, flags, ...args) {
  if (typeof filePath === 'string' && filePath.startsWith(NEXT_DIR)) {
    const f = String(flags)
    if (f === 'w' || f === 'a' || f.includes('w') || typeof flags === 'number') {
      try { origMkdirSync(nodePath.dirname(filePath), { recursive: true }) } catch (_) {}
    }
  }
  return origPromisesOpen(filePath, flags, ...args)
}

// --- Module._load retry: handle APFS race on require() for .next/ files ---

const Module = require('module')

const syncSleep = (ms) => {
  const sab = new SharedArrayBuffer(4)
  Atomics.wait(new Int32Array(sab), 0, 0, ms)
}

const origModuleLoad = Module._load
Module._load = function (request, parent, isMain) {
  try {
    const result = origModuleLoad.call(this, request, parent, isMain)
    // Patch static-paths-worker to handle PageNotFoundError (page not compiled yet in dev).
    // Applies in both main process and worker process (both load flush-fs.js via NODE_OPTIONS).
    if (typeof request === 'string' && request.includes('static-paths-worker') &&
        result && typeof result.loadStaticPaths === 'function' && !result.__flushFsPatched) {
      result.__flushFsPatched = true
      const origLoadStaticPaths = result.loadStaticPaths
      result.loadStaticPaths = async function (...args) {
        try {
          return await origLoadStaticPaths.apply(this, args)
        } catch (e) {
          if (e && (e.name === 'PageNotFoundError' || (e.message && e.message.includes('Cannot find module for page')))) {
            return { prerenderedRoutes: [], fallbackMode: 'NOT_FOUND' }
          }
          throw e
        }
      }
    }
    return result
  } catch (e) {
    const isNotFound = e.code === 'MODULE_NOT_FOUND' || e.code === 'ENOENT'
    if (!isNotFound) throw e
    const parentFile = parent && parent.filename ? parent.filename : ''
    // Only retry if the request itself is a .next/ path OR is a relative import from within .next/
    // Do NOT retry node_modules packages (e.g. @emotion/is-prop-valid) just because their parent is in .next/
    const reqIsRelativeFromNext = typeof request === 'string' && request.startsWith('.') && parentFile.startsWith(NEXT_DIR)
    const reqIsAbsoluteNext = typeof request === 'string' && request.includes('.next/')
    if (!reqIsRelativeFromNext && !reqIsAbsoluteNext) throw e

    // Check JS module cache immediately — bypasses APFS directory entry race entirely
    {
      const jsCache = global.__nextJsCache
      if (jsCache) {
        let absPath
        try {
          absPath = nodePath.isAbsolute(request) ? request
            : nodePath.resolve(nodePath.dirname(parentFile), request)
        } catch (_) {}
        if (absPath) {
          const candidates = [absPath, absPath + '.js']
          for (const candidate of candidates) {
            if (jsCache.has(candidate)) {
              // Module may already be in Node cache if loaded by a parallel require
              if (Module._cache[candidate]) return Module._cache[candidate].exports
              const content = jsCache.get(candidate)
              const m = new Module(candidate)
              m.filename = candidate
              m.paths = Module._nodeModulePaths(nodePath.dirname(candidate))
              m._compile(content, candidate)
              Module._cache[candidate] = m
              return m.exports
            }
          }
        }
      }
    }

    if (typeof request === 'string' && request.includes('vendor-chunks')) {
      // Fsync first in case the file is just not visible yet
      fsyncDirSync(VENDOR_DIR)
      // Restore ALL missing vendor chunks in one pass so the page load
      // doesn't hit repeated failures for each subsequent vendor chunk.
      restoreAllVendorChunks()
    }

    // Retry up to 20 times, 50ms apart (max 1s)
    const isVendorRetry = typeof request === 'string' && request.includes('vendor-chunks')
    for (let i = 0; i < 20; i++) {
      syncSleep(50)
      if (isVendorRetry && i === 0) {
        try {
          const absPath2 = nodePath.resolve(nodePath.dirname(parentFile), request)
          fs.statSync(absPath2)
        } catch (_) {
          restoreAllVendorChunks()
        }
      }
      try {
        return origModuleLoad.call(this, request, parent, isMain)
      } catch (e2) {
        if (e2.code !== 'MODULE_NOT_FOUND' && e2.code !== 'ENOENT') throw e2
      }
    }
    // Last-resort: JS cache may have been populated during retries
    {
      const jsCache = global.__nextJsCache
      if (jsCache) {
        let absPath
        try {
          absPath = nodePath.isAbsolute(request) ? request
            : nodePath.resolve(nodePath.dirname(parentFile), request)
        } catch (_) {}
        if (absPath) {
          const candidates = [absPath, absPath + '.js']
          for (const candidate of candidates) {
            if (jsCache.has(candidate)) {
              if (Module._cache[candidate]) return Module._cache[candidate].exports
              const content = jsCache.get(candidate)
              const m = new Module(candidate)
              m.filename = candidate
              m.paths = Module._nodeModulePaths(nodePath.dirname(candidate))
              m._compile(content, candidate)
              Module._cache[candidate] = m
              return m.exports
            }
          }
        }
      }
    }
    throw e
  }
}
