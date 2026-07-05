const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gfnLauncher', {
  rescan: () => ipcRenderer.invoke('library:rescan'),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  addManual: () => ipcRenderer.invoke('library:addManual'),
  addFolder: () => ipcRenderer.invoke('library:addFolder'),
  setImage: (id) => ipcRenderer.invoke('library:setImage', id),
  remove: (id) => ipcRenderer.invoke('library:remove', id),
  toggleFavorite: (id) => ipcRenderer.invoke('library:toggleFavorite', id),
  setTags: (id, tags) => ipcRenderer.invoke('library:setTags', id, tags),
  launch: (id) => ipcRenderer.invoke('library:launch', id),
  fetchArtwork: (id) => ipcRenderer.invoke('library:fetchArtwork', id),
  fetchAllArtwork: () => ipcRenderer.invoke('library:fetchAllArtwork'),
  getAutoLaunch: () => ipcRenderer.invoke('settings:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('settings:setAutoLaunch', enabled),
  setFullscreen: (enabled) => ipcRenderer.invoke('window:setFullscreen', enabled),
});
