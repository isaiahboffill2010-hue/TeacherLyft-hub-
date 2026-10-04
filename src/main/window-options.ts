import type { BrowserWindowConstructorOptions } from "electron";

export function browserWindowOptions(preload: string, production: boolean): BrowserWindowConstructorOptions {
  const fullscreen = production && process.env.TEACHERLYFT_FULLSCREEN !== "false";
  return {
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    fullscreen,
    frame: !fullscreen,
    backgroundColor: "#e8f0fb",
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
    },
  };
}
