const { app, BrowserWindow, protocol } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { watch } = require("fs");
const archiver = require("archiver");
const stream = require("stream");
const { readdir, stat } = require("fs/promises");

const ROOT = __dirname;
const HTML_INDEX = path.join(ROOT, "./index.html");
const WEBASSEMBLY_PATH = path.join(ROOT, "../carimbo/build/carimbo.wasm");
const JAVASCRIPT_PATH = path.join(ROOT, "../carimbo/build/carimbo.js");
const SANDBOX_DIR = process.env.ROOT

let mainWindow = null;

app.whenReady().then(async () => {
  protocol.interceptBufferProtocol("file", async (request, callback) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);

    if (pathname.endsWith("/index.html")) {
      callback({
        mimeType: "text/html",
        data: await fs.readFile(HTML_INDEX)
      });

      return;
    }

    if (pathname.endsWith("/carimbo.wasm")) {
      callback({
        mimeType: "application/wasm",
        data: await fs.readFile(WEBASSEMBLY_PATH),
      });

      return;
    }

    if (pathname.endsWith("/carimbo.js")) {
      callback({
        mimeType: "application/javascript",
        data: await fs.readFile(JAVASCRIPT_PATH),
      });

      return;
    }

    if (pathname.endsWith("/cartridge.zip")) {
      callback({
        mimeType: "application/zip",
        data: await createCartridge(SANDBOX_DIR),
      });

      return;
    }
  });

  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: { devTools: true },
  });

  mainWindow.webContents.setAudioMuted(true);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.webContents.openDevTools({ mode: "right" });
  });

  mainWindow.loadURL(`file://${ROOT}/index.html`);

  watch(WEBASSEMBLY_PATH, { persistent: false }, () => {
    mainWindow.webContents.reloadIgnoringCache();
  });
});

async function createCartridge(dir) {
  return new Promise(async (resolve, reject) => {
    const output = new stream.PassThrough();
    const archive = archiver("zip", { zlib: { level: 1 } });

    const chunks = [];
    output.on("data", chunk => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);

    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;

        const fullPath = path.join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isFile()) archive.file(fullPath, { name: entry });
        if (stats.isDirectory()) archive.directory(fullPath, entry);
      }

      await archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}
