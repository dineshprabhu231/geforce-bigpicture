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
        // Whether the app should register itself to run at Windows login
        // and open straight into fullscreen ("Big Picture on startup").
        autoLaunch: false,
        // Appearance + controller preferences, editable from the Settings
        // panel. `controllerMap` binds each in-app action to a physical
        // standard-gamepad button index (0=A/Cross, 1=B/Circle, 2=X/Square,
        // 3=Y/Triangle, 4=LB/L1, 5=RB/R1, 6=LT/L2, 7=RT/R2).
        prefs: {
          font: 'default',
          controllerMap: {
            activate: 0,
            secondary: 2,
            tertiary: 3,
            back: 1,
          },
          vibration: {
            enabled: true,
            weakMagnitude: 1,
            strongMagnitude: 1,
          },
        },
      },
    });
  }
  return instance;
}

module.exports = { getStore };
