const { app, BrowserWindow, protocol } = require('electron')
const fs = require('fs/promises')
const path = require('path')
const { watch } = require('fs')

const ROOT = __dirname
const WASM_PATH = path.join(ROOT, '../carimbo/build/carimbo.wasm')

const data = {
  runtime: null,
  bundle: null,
}

let mainWindow = null

app.whenReady().then(async () => {
  data.runtime = await fs.readFile(WASM_PATH)

  protocol.interceptBufferProtocol('file', async (request, callback) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)

    if (pathname.endsWith('/carimbo.wasm')) {
      callback({ mimeType: 'application/wasm', data: data.runtime })
      return
    }

    callback({
      mimeType: getMime(pathname),
      data: await fs.readFile(pathname)
    })
  })

  mainWindow = new BrowserWindow({ width: 800, height: 600 })
  mainWindow.loadURL(`file://${ROOT}/index.html`)

  watch(WASM_PATH, { persistent: false }, () => {
    mainWindow.webContents.reloadIgnoringCache()
  })
})

function getMime(file) {
  switch (true) {
    case file.endsWith('.html'): return 'text/html'
    case file.endsWith('.js'): return 'application/javascript'
    case file.endsWith('.wasm'): return 'application/wasm'
    case file.endsWith('.7z'): return 'application/x-7z-compressed'
  }
  return 'application/octet-stream'
}
