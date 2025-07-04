const { app, BrowserWindow, protocol } = require('electron')
const fs = require('fs/promises')
const path = require('path')
const { watch, readdirSync, statSync } = require('fs')
const archiver = require('archiver')
const stream = require('stream')

const ROOT = __dirname
const WASM_PATH = path.join(ROOT, '../carimbo/build/carimbo.wasm')
const JS_PATH = path.join(ROOT, '../carimbo/build/carimbo.js')
const SANDBOX_DIR = path.join(ROOT, '../sandbox')

let mainWindow = null
let wasmCode = null
let jsCode = null

app.whenReady().then(async () => {
  wasmCode = await fs.readFile(WASM_PATH)
  jsCode = await fs.readFile(JS_PATH)

  protocol.interceptBufferProtocol('file', async (request, callback) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)

    if (pathname.endsWith('/carimbo.wasm')) {
      callback({ mimeType: 'application/wasm', data: wasmCode })
      return
    }

    if (pathname.endsWith('/carimbo.js')) {
      callback({ mimeType: 'application/javascript', data: jsCode })
      return
    }

    if (pathname.endsWith('/bundle.zip')) {
      callback({
        mimeType: 'application/zip',
        data: await createBundle(SANDBOX_DIR)
      })
      return
    }

    callback({
      mimeType: getMime(pathname),
      data: await fs.readFile(pathname)
    })
  })

  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: { devTools: true }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    mainWindow.webContents.openDevTools({ mode: 'right' })
  })

  mainWindow.loadURL(`file://${ROOT}/index.html`)

  watch(WASM_PATH, { persistent: false }, () => {
    mainWindow.webContents.reloadIgnoringCache()
  })

  watch(JS_PATH, { persistent: false }, () => {
    mainWindow.webContents.reloadIgnoringCache()
  })
})

function getMime(file) {
  switch (true) {
    case file.endsWith('.html'): return 'text/html'
    case file.endsWith('.js'): return 'application/javascript'
    case file.endsWith('.wasm'): return 'application/wasm'
    case file.endsWith('.zip'): return 'application/zip'
  }

  return 'application/octet-stream'
}

function createBundle(dir) {
  return new Promise((resolve, reject) => {
    const output = new stream.PassThrough()
    const archive = archiver('zip', { zlib: { level: 1 } })

    const chunks = []
    output.on('data', chunk => chunks.push(chunk))
    output.on('end', () => resolve(Buffer.concat(chunks)))
    output.on('error', reject)

    archive.on('error', reject)
    archive.pipe(output)

    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry.startsWith('.')) continue

      const fullPath = path.join(dir, entry)
      const stats = statSync(fullPath)

      if (stats.isFile()) archive.file(fullPath, { name: entry })
      if (stats.isDirectory()) archive.directory(fullPath, entry)
    }

    archive.finalize()
  })
}
