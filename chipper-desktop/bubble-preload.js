// The floating call circle's bridge (see bubble.html)
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("chipchicBubble", {
  onFrame: (cb) => ipcRenderer.on("frame", (e, src) => cb(src)), // a new picture of the person in focus
  open: () => ipcRenderer.send("bubble-open"),                     // tapped: back to the call
  close: () => ipcRenderer.send("bubble-close"),                   // ✕: hide the circle (the call keeps going)
  drag: (dx, dy) => ipcRenderer.send("bubble-drag", { dx, dy }),   // moved by dragging
});
