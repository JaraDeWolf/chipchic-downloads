// Chipper for Windows, Mac and Linux: a window that opens your Chipper website (the link is in settings.json).
// All the chat code lives on the website, so the app updates by itself whenever the website does.
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, session, desktopCapturer, nativeImage, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const IS_MAC = process.platform === "darwin", IS_WIN = process.platform === "win32", IS_LINUX = process.platform === "linux";
const APP_ID = "com.chipper.desktop"; // Windows needs this for notifications to show under the app's name
let siteUrl = "";
try { siteUrl = String(JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json"), "utf8")).url || "").trim().replace(/\/+$/, ""); } catch {}
const linkOk = /^https?:\/\/[^/]+$/.test(siteUrl) && !siteUrl.includes("YOUR-APP");
const siteOrigin = linkOk ? new URL(siteUrl).origin : "";
const isOurs = (url) => { try { return !!siteOrigin && new URL(url).origin === siteOrigin; } catch { return false; } };
const startHidden = process.argv.includes("--hidden") || (IS_MAC && app.getLoginItemSettings().wasOpenedAsHidden); // started with the computer

let win = null, tray = null, bubble = null, quitting = false, inCall = false, lastFrame = "";

// Only one copy runs: opening it again brings the window back (also how you get it back on Linux desktops without a tray)
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", () => showWindow());
  if (IS_WIN) app.setAppUserModelId(APP_ID);
  app.whenReady().then(start);
}

// ---------- The window ----------
const boundsFile = () => path.join(app.getPath("userData"), "window.json");
function savedBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), "utf8"));
    const onScreen = screen.getAllDisplays().some((d) => b.x < d.workArea.x + d.workArea.width - 80 && b.x + b.width > d.workArea.x + 80 && b.y >= d.workArea.y - 20 && b.y < d.workArea.y + d.workArea.height - 80);
    return onScreen ? b : { width: b.width, height: b.height };
  } catch { return { width: 1200, height: 800 }; }
}
function saveBounds() {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
  try { fs.writeFileSync(boundsFile(), JSON.stringify(Object.assign(win.getNormalBounds(), { maximized: win.isMaximized() }))); } catch {}
}

function start() {
  setUpMenu();
  setUpTray();
  setUpPermissions();
  createWindow(!startHidden);
}
function createWindow(visible) {
  const b = savedBounds();
  win = new BrowserWindow({
    width: b.width || 1200, height: b.height || 800, x: b.x, y: b.y, minWidth: 380, minHeight: 500,
    show: false, title: "Chipper", backgroundColor: "#1e1f22", autoHideMenuBar: true,
    icon: IS_LINUX ? path.join(__dirname, "icons", "icon.png") : undefined,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  if (b.maximized && visible) win.maximize(); // (maximising would also show a window that starts hidden)
  if (visible) win.once("ready-to-show", () => win.show());
  setUpLinks();
  win.on("closed", () => { win = null; hideBubble(); }); // only when quitting (the X just hides it)

  // The X hides the window (it keeps running so notifications and calls still arrive); Quit closes it for real
  win.on("close", (e) => { saveBounds(); if (!quitting) { e.preventDefault(); win.hide(); } });
  for (const ev of ["resize", "move"]) win.on(ev, () => { clearTimeout(win.saveTimer); win.saveTimer = setTimeout(saveBounds, 500); });
  win.on("focus", () => { win.flashFrame(false); if (IS_MAC && app.dock) app.dock.cancelBounce && app.dock.cancelBounce(); });
  // The floating call circle: shown while a call is going and the window is minimised or hidden
  for (const ev of ["minimize", "hide"]) win.on(ev, () => { if (inCall) showBubble(); });
  for (const ev of ["restore", "show", "focus"]) win.on(ev, () => { if (win.isVisible() && !win.isMinimized()) hideBubble(); });

  // F5 / Ctrl+R (⌘R on Mac) reloads; Ctrl+Q quits on Linux (Mac has ⌘Q in its menu)
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    const mod = IS_MAC ? input.meta : input.control;
    if (input.key === "F5" || (mod && input.key.toLowerCase() === "r")) { e.preventDefault(); win.webContents.reload(); }
    else if (IS_LINUX && input.control && input.key.toLowerCase() === "q") { e.preventDefault(); quitApp(); }
    else if (input.key === "F12" && input.control && input.shift) win.webContents.toggleDevTools();
  });
  // If the website can't be reached, show the Connecting page with "Try again" (it also retries by itself)
  win.webContents.on("did-fail-load", (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3: the load was replaced by another one, not an error
    showConnecting(true);
  });
  showConnecting(false).then(loadSite); // the Connecting page stays up until the website answers (a sleeping server takes up to a minute)
}
function showConnecting(failed) {
  return win.loadFile(path.join(__dirname, "loading.html"), { query: { state: !linkOk ? "nolink" : failed ? "failed" : "loading" } }).catch(() => {});
}
function loadSite() { if (linkOk) win.loadURL(siteUrl).catch(() => {}); } // a failure shows the Connecting page (did-fail-load)
function showWindow() {
  if (!win || win.isDestroyed()) { createWindow(true); return; } // shouldn't happen, but never leave the app without a window
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (IS_MAC) app.focus({ steal: true });
}
function quitApp() { quitting = true; saveBounds(); app.quit(); }
app.on("before-quit", () => { quitting = true; });           // ⌘Q, the Dock's Quit, or shutting down the computer
app.on("activate", () => showWindow());                      // Mac: clicking the Dock icon brings the window back
app.on("window-all-closed", () => { if (quitting) app.quit(); });

// ---------- Menu: Mac needs one for copy/paste and ⌘Q; Windows and Linux don't show one ----------
function setUpMenu() {
  if (!IS_MAC) { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { label: "View", submenu: [{ label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win.webContents.reload() }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { role: "windowMenu" },
  ]));
}

// ---------- Tray (Windows: near the clock; Mac: the menu bar; Linux: where the desktop shows them) ----------
function setUpTray() {
  const img = IS_MAC ? nativeImage.createFromPath(path.join(__dirname, "icons", "trayTemplate.png")) : nativeImage.createFromPath(path.join(__dirname, "icons", IS_LINUX ? "logo.png" : "tray.png"));
  if (IS_MAC) img.setTemplateImage(true);
  try { tray = new Tray(IS_LINUX ? img.resize({ width: 24, height: 24 }) : img); } catch { tray = null; return; } // some Linux desktops have no tray
  tray.setToolTip("Chipper");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Chipper", click: () => showWindow() },
    { label: "Reload", click: () => { showWindow(); win.webContents.reload(); } },
    { type: "separator" },
    { label: "Quit", click: () => quitApp() },
  ]));
  if (!IS_MAC) tray.on("click", () => (win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && win.isFocused() ? win.hide() : showWindow()));
}

// ---------- Camera, microphone, notifications and screen sharing: only for your Chipper website ----------
function setUpPermissions() {
  const allowed = new Set(["media", "notifications", "clipboard-read", "clipboard-sanitized-write", "fullscreen", "display-capture", "speaker-selection"]);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => cb(allowed.has(perm) && isOurs(details.requestingUrl || wc.getURL())));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => allowed.has(perm) && isOurs(origin));
  // Sharing your screen: the website shows a chooser with every screen and window, and sends back the choice
  let nextId = 1;
  const waiting = new Map();
  ipcMain.on("picked-screen", (e, { id, sourceId }) => { const w = waiting.get(id); if (w) { waiting.delete(id); w(sourceId); } });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (!isOurs(request.frame ? request.frame.url : win.webContents.getURL())) return callback({});
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
      const list = sources.filter((s) => s.name !== "Chipper" || s.id.startsWith("screen")).map((s) => ({ id: s.id, name: s.name || "Screen", thumb: s.thumbnail.toDataURL() }));
      if (!list.length) return callback({}); // Mac: Screen Recording isn't allowed yet (System Settings → Privacy & Security)
      const id = nextId++;
      const answer = new Promise((resolve) => waiting.set(id, resolve));
      win.webContents.send("pick-screen", { id, sources: list });
      const pickedId = await answer;
      const chosen = sources.find((s) => s.id === pickedId);
      if (!chosen) return callback({});
      callback(IS_WIN ? { video: chosen, audio: "loopback" } : { video: chosen }); // the computer's sound only works on Windows
    } catch { callback({}); }
  });
}

// ---------- Links: your website stays in the app, everything else opens in your browser ----------
function setUpLinks() {
  const openOutside = (url) => { if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { if (isOurs(url) && !/\/download/.test(new URL(url).pathname)) win.loadURL(url); else openOutside(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!isOurs(url) && !url.startsWith("file:")) { e.preventDefault(); openOutside(url); } });
}

// ---------- Messages from the website (see preload.js) ----------
ipcMain.on("show", () => showWindow());
ipcMain.on("show-call", () => { // pop up over other apps, even from the tray
  showWindow();
  win.setAlwaysOnTop(true, "screen-saver");
  setTimeout(() => { if (win && !win.isDestroyed()) win.setAlwaysOnTop(false); }, 1500);
  if (IS_MAC && app.dock) app.dock.bounce("critical");
});
ipcMain.on("flash", () => {
  if (!win || win.isFocused()) return;
  if (IS_MAC) { if (app.dock) app.dock.bounce("informational"); } else win.flashFrame(true);
});
ipcMain.on("retry", () => { showConnecting(false).then(loadSite); });
ipcMain.on("minimize", () => { if (inCall) { win.minimize(); showBubble(); } else win.minimize(); });
ipcMain.on("in-call", (e, on) => { inCall = !!on; if (!inCall) hideBubble(); else if (!win.isVisible() || win.isMinimized()) showBubble(); });

// Start when the computer starts (hidden, so it just sits in the tray)
const linuxAutostartFile = () => path.join(os.homedir(), ".config", "autostart", "chipper.desktop");
ipcMain.handle("get-auto-start", () => {
  if (IS_LINUX) return fs.existsSync(linuxAutostartFile());
  return !!app.getLoginItemSettings(IS_WIN ? { args: ["--hidden"] } : undefined).openAtLogin;
});
ipcMain.handle("set-auto-start", (e, on) => {
  if (IS_LINUX) { // Linux: a small file in ~/.config/autostart (the AppImage tells us where it lives)
    const exe = process.env.APPIMAGE || process.execPath;
    if (on) {
      fs.mkdirSync(path.dirname(linuxAutostartFile()), { recursive: true });
      fs.writeFileSync(linuxAutostartFile(), ["[Desktop Entry]", "Type=Application", "Name=Chipper", 'Exec="' + exe + '" --hidden', "X-GNOME-Autostart-enabled=true", ""].join("\n"));
    } else { try { fs.unlinkSync(linuxAutostartFile()); } catch {} }
    return fs.existsSync(linuxAutostartFile());
  }
  if (IS_MAC) app.setLoginItemSettings({ openAtLogin: on, openAsHidden: true });
  else app.setLoginItemSettings({ openAtLogin: on, args: ["--hidden"] });
  return !!app.getLoginItemSettings(IS_WIN ? { args: ["--hidden"] } : undefined).openAtLogin;
});

// ---------- The floating call circle (while the window is minimised or hidden during a call) ----------
function showBubble() {
  if (!inCall) return;
  if (!bubble || bubble.isDestroyed()) {
    const S = 132, area = screen.getPrimaryDisplay().workArea;
    bubble = new BrowserWindow({
      width: S, height: S, x: area.x + area.width - S - 24, y: area.y + area.height - S - 24,
      frame: false, transparent: true, resizable: false, movable: true, minimizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, alwaysOnTop: true, hasShadow: false, focusable: true, show: false, backgroundColor: "#00000000",
      webPreferences: { preload: path.join(__dirname, "bubble-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    bubble.setAlwaysOnTop(true, "floating");
    if (IS_MAC) bubble.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    bubble.loadFile(path.join(__dirname, "bubble.html"));
    bubble.once("ready-to-show", () => { bubble.showInactive(); if (lastFrame) bubble.webContents.send("frame", lastFrame); });
    bubble.on("closed", () => { bubble = null; });
  } else if (!bubble.isVisible()) bubble.showInactive();
  win.webContents.send("bubble", "shown"); // the website starts sending pictures
}
function hideBubble() {
  if (bubble && !bubble.isDestroyed() && bubble.isVisible()) bubble.hide();
  if (!win || win.isDestroyed()) return;
  win.webContents.send("bubble", "hidden");
}
ipcMain.on("bubble-frame", (e, src) => { lastFrame = src; if (bubble && !bubble.isDestroyed() && bubble.isVisible()) bubble.webContents.send("frame", src); });
ipcMain.on("bubble-open", () => { hideBubble(); showWindow(); win.webContents.send("bubble", "open"); });
ipcMain.on("bubble-close", () => hideBubble()); // ✕: hides the circle, the call keeps going
ipcMain.on("bubble-drag", (e, { dx, dy }) => {
  if (!bubble || bubble.isDestroyed()) return;
  const [x, y] = bubble.getPosition();
  bubble.setPosition(Math.round(x + dx), Math.round(y + dy));
});
