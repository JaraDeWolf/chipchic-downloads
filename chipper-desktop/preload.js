// The small bridge between the ChipChic website and the app (the website sees it as window.chipchicDesktop).
// Kept small on purpose: the page can't touch your files or anything else on the computer.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chipchicDesktop", {
  platform: process.platform,                                        // "win32", "darwin" (Mac) or "linux"
  show: () => ipcRenderer.send("show"),                              // bring the window back (clicking a notification)
  showCall: () => ipcRenderer.send("show-call"),                     // a call is coming in: pop the window up over other apps
  flash: () => ipcRenderer.send("flash"),                            // blink the taskbar button / bounce the Dock icon
  retry: () => ipcRenderer.send("retry"),                            // "Try again" on the Connecting page
  onPickScreen: (cb) => ipcRenderer.on("pick-screen", (e, req) => cb(req)), // sharing your screen: show the chooser...
  pickScreen: (id, sourceId) => ipcRenderer.send("picked-screen", { id, sourceId: sourceId || null }), // ...and send back the choice
  getAutoStart: () => ipcRenderer.invoke("get-auto-start"),          // does it start when the computer starts?
  setAutoStart: (on) => ipcRenderer.invoke("set-auto-start", !!on),  // turn that on/off (starts hidden)
  setInCall: (on) => ipcRenderer.send("in-call", !!on),              // a call started/ended (minimising during a call shows the floating circle)
  onBubble: (cb) => ipcRenderer.on("bubble", (e, ev) => cb(ev)),     // "shown" / "hidden" / "open" (the circle was tapped)
  bubbleFrame: (src) => ipcRenderer.send("bubble-frame", String(src)), // the picture for the circle
  minimize: () => ipcRenderer.send("minimize"),                      // ⧉ in a call: shrink to the circle
});
