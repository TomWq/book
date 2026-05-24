const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("novelWorkbenchDesktop", {
  runtime: "electron"
});
