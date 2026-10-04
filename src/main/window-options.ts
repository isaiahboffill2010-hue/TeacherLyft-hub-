import type { BrowserWindowConstructorOptions } from "electron";
import { resolve } from "node:path";

export const PRELOAD_ENTRY_FILENAME = "index.mjs";

export function resolvePreloadPath(mainProcessDirectory: string): string {
  return resolve(mainProcessDirectory, "../preload", PRELOAD_ENTRY_FILENAME);
}

type SandboxEnvironment = {
  platform: NodeJS.Platform;
  arch: string;
  compatibilityRequested: boolean;
};

export function shouldUseSandbox(environment: SandboxEnvironment = {
  platform: process.platform,
  arch: process.arch,
  compatibilityRequested: process.env.TEACHERLYFT_PI_COMPATIBILITY === "1",
}): boolean {
  return !(environment.platform === "linux"
    && environment.arch === "arm64"
    && environment.compatibilityRequested);
}

export function browserWindowOptions(
  preload: string,
  production: boolean,
  sandbox = shouldUseSandbox(),
): BrowserWindowConstructorOptions {
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
      sandbox,
      webviewTag: false,
    },
  };
}
