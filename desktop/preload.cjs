const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('loggie', Object.freeze({
  togglePanel: () => ipcRenderer.invoke('loggie:toggle-panel'),
  collapsePanel: () => ipcRenderer.invoke('loggie:collapse-panel'),
  hide: () => ipcRenderer.invoke('loggie:hide'),
  quit: () => ipcRenderer.invoke('loggie:quit'),
  gmail: Object.freeze({
    status: () => ipcRenderer.invoke('gmail:status'),
    connect: () => ipcRenderer.invoke('gmail:connect'),
    cancelConnect: () => ipcRenderer.invoke('gmail:cancel-connect'),
    disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
    search: (request) => ipcRenderer.invoke('gmail:search', request),
    getThread: (threadId) => ipcRenderer.invoke('gmail:get-thread', threadId),
  }),
}));
