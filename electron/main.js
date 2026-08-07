// LoomHR desktop shell.
// Launches the built Next.js standalone server as a child process, waits for
// it, then opens the app in a window. The server connects to the TiDB Cloud
// database automatically using db-config.json (next to the app) or built-in
// defaults, so an installed copy works from anywhere.

const { app, BrowserWindow, dialog, shell } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

// Auto-update: checks GitHub Releases on launch and installs new versions so
// the installed app stays current without a manual reinstall.
let autoUpdater = null;
try { ({ autoUpdater } = require("electron-updater")); } catch { /* dev without updater */ }

function setupAutoUpdate() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", (info) => {
    dialog.showMessageBox({
      type: "info",
      title: "LoomHR update ready",
      message: `Version ${info.version} has been downloaded.`,
      detail: "Restart now to apply the update?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
    }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
  });
  autoUpdater.on("error", (e) => console.error("[updater]", e?.message || e));
  try { autoUpdater.checkForUpdates(); } catch (e) { console.error("[updater]", e); }
}

const PORT = process.env.LOOMHR_PORT || 34517;
let serverProc = null;
let win = null;

/** Locate the Next standalone server.js (packaged vs. dev). */
function resolveServer() {
  const packaged = path.join(process.resourcesPath || "", "app", "server.js");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", ".next", "standalone", "server.js");
}

/** DB connection: from db-config.json (checked in several locations,
 *  cross-platform), else built-in defaults. On macOS the file next to the
 *  binary lives inside the .app bundle, so userData is the writable option. */
function dbEnv() {
  // No credentials are baked into the source. Connection settings are read
  // from db-config.json — placed next to the executable, in the app's
  // userData folder, or bundled into resources at build time (that file is
  // gitignored, so secrets never enter the repo). Falls back to a local
  // MySQL server if no config is found.
  const defaults = {
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "loomhr",
    DB_PASSWORD: "",
    DB_NAME: "loomhr",
    DB_SSL: "",
  };
  const candidates = [
    path.join(app.getPath("userData"), "db-config.json"),
    path.join(path.dirname(app.getPath("exe")), "db-config.json"),
    path.join(process.resourcesPath || "", "db-config.json"),
  ];
  for (const cfgPath of candidates) {
    try {
      if (fs.existsSync(cfgPath)) { Object.assign(defaults, JSON.parse(fs.readFileSync(cfgPath, "utf8"))); break; }
    } catch { /* try next */ }
  }
  return defaults;
}

function startServer() {
  const server = resolveServer();
  serverProc = fork(server, [], {
    cwd: path.dirname(server),
    env: { ...process.env, ...dbEnv(), PORT: String(PORT), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  serverProc.stdout && serverProc.stdout.on("data", (d) => console.log("[server]", d.toString().trim()));
  serverProc.stderr && serverProc.stderr.on("data", (d) => console.error("[server]", d.toString().trim()));
}

function waitForServer(cb, tries = 0) {
  http.get({ host: "127.0.0.1", port: PORT, path: "/api/health" }, () => cb())
    .on("error", () => (tries < 80 ? setTimeout(() => waitForServer(cb, tries + 1), 400) : cb()));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, title: "LoomHR — HRMS",
    backgroundColor: "#0b1310",
    webPreferences: { contextIsolation: true },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${PORT}/hr/login`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

function showSplash() {
  win = new BrowserWindow({ width: 460, height: 260, frame: false, backgroundColor: "#0b1310", resizable: false, center: true });
  win.loadURL("data:text/html," + encodeURIComponent(
    `<body style="margin:0;background:#0b1310;color:#e8efeb;font-family:Segoe UI,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh">
       <div style="width:44px;height:44px;border-radius:12px;background:#059669;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:#fff">M</div>
       <h2 style="margin:14px 0 2px;font-size:18px">LoomHR</h2>
       <p style="margin:0;color:#97a8a1;font-size:12px">Starting HRMS &amp; connecting to MySQL…</p>
     </body>`));
}

app.whenReady().then(() => {
  startServer();
  showSplash();
  waitForServer(() => {
    const splash = win;
    createWindow();
    if (splash && !splash.isDestroyed()) splash.close();
    setupAutoUpdate();
  });
});

app.on("window-all-closed", () => { if (serverProc) try { serverProc.kill(); } catch {} app.quit(); });
app.on("before-quit", () => { if (serverProc) try { serverProc.kill(); } catch {} });
process.on("exit", () => { if (serverProc) try { serverProc.kill(); } catch {} });
