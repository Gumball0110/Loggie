import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('loggie', Object.freeze({
  togglePanel: () => ipcRenderer.invoke('loggie:toggle-panel'),
  collapsePanel: () => ipcRenderer.invoke('loggie:collapse-panel'),
  hide: () => ipcRenderer.invoke('loggie:hide'),
  quit: () => ipcRenderer.invoke('loggie:quit'),
  submitMessage: (message) => ipcRenderer.invoke('loggie:submit-message', message),
}));
