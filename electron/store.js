const Store = require('electron-store');

let instance;

function getStore() {
  if (!instance) {
    instance = new Store({
      name: 'library',
      defaults: {
        games: [],
        // The single folder chosen via "+ Import folder". Rescan re-checks
        // only this folder — there's no more broad system-folder scan.
        scanFolder: null,
        // SteamGridDB API key, pasted in by the user, used for automatic
        // artwork lookup. Empty until they set one.
        steamGridDbApiKey: '',
        // Whether the app should register itself to run at Windows login
        // and open straight into fullscreen ("Big Picture on startup").
        autoLaunch: false,
      },
    });
  }
  return instance;
}

module.exports = { getStore };
