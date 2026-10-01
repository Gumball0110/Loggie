const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('loggie', Object.freeze({
  togglePanel: () => ipcRenderer.invoke('loggie:toggle-panel'),
  collapsePanel: () => ipcRenderer.invoke('loggie:collapse-panel'),
  hide: () => ipcRenderer.invoke('loggie:hide'),
  quit: () => ipcRenderer.invoke('loggie:quit'),
  moveCompanion: (position) => ipcRenderer.send('loggie:move-companion', position),
  command: Object.freeze({
    execute: (text) => ipcRenderer.invoke('command:execute', text),
    openResolved: (selection) => ipcRenderer.invoke('command:open-resolved', selection),
  }),
  core: Object.freeze({
    health: () => ipcRenderer.invoke('core:health'),
    listProjects: () => ipcRenderer.invoke('core:list-projects'),
    listTasks: (filters) => ipcRenderer.invoke('core:list-tasks', filters),
    listSessions: (filters) => ipcRenderer.invoke('core:list-sessions', filters),
    createProject: (project) => ipcRenderer.invoke('core:create-project', project),
    createTask: (task) => ipcRenderer.invoke('core:create-task', task),
    prepareTask: (taskId) => ipcRenderer.invoke('core:prepare-task', taskId),
    startTask: (taskId) => ipcRenderer.invoke('core:start-task', taskId),
    onEvents: (listener) => {
      const handler = (_event, events) => listener(events);
      ipcRenderer.on('core:events', handler);
      return () => ipcRenderer.removeListener('core:events', handler);
    },
  }),
  gmail: Object.freeze({
    status: () => ipcRenderer.invoke('gmail:status'),
    connect: () => ipcRenderer.invoke('gmail:connect'),
    cancelConnect: () => ipcRenderer.invoke('gmail:cancel-connect'),
    disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
    search: (request) => ipcRenderer.invoke('gmail:search', request),
    getThread: (threadId) => ipcRenderer.invoke('gmail:get-thread', threadId),
  }),
}));
