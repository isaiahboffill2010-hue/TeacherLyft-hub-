import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { app, BrowserWindow, Menu, session } from "electron";
import { registerIpcHandlers, removeIpcHandlers } from "@/main/ipc-handlers";
import { browserWindowOptions, resolvePreloadPath, shouldUseSandbox } from "@/main/window-options";

try { loadEnvFile(join(process.cwd(), ".env.local")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

const development = Boolean(process.env.ELECTRON_RENDERER_URL);
const sandboxEnabled = shouldUseSandbox();
if (sandboxEnabled) app.enableSandbox();

console.info("[electron/startup] Runtime", {
  electron: process.versions.electron,
  platform: process.platform,
  arch: process.arch,
  sessionType: process.env.XDG_SESSION_TYPE ?? "unknown",
  display: process.env.DISPLAY ?? null,
  waylandDisplay: process.env.WAYLAND_DISPLAY ?? null,
  sandbox: sandboxEnabled,
});

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow(browserWindowOptions(
    resolvePreloadPath(__dirname),
    !development,
    sandboxEnabled,
  ));
  console.info("[electron/startup] BrowserWindow created");
  Menu.setApplicationMenu(null);
  registerIpcHandlers(window.webContents.id);

  window.webContents.on("console-message", (details) => {
    const log = details.level === "error" ? console.error : console.info;
    log(`[electron/renderer] ${details.message}`);
  });
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[electron/preload] Failed", { preloadPath, message: error.message });
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    const current = window.webContents.getURL();
    if (new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.control && input.shift && input.key === "F11") {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
    if (development && input.type === "keyDown" && input.key === "F12") window.webContents.toggleDevTools();
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.once("did-finish-load", () => console.info("[electron/startup] Renderer did-finish-load"));
  window.on("closed", removeIpcHandlers);

  if (development && process.env.ELECTRON_RENDERER_URL) {
    console.info("[electron/startup] Renderer load start", { mode: "development" });
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    console.info("[electron/startup] Renderer load start", { mode: "bundled" });
    await window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return window;
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch((error) => {
  console.error("[electron/main] Startup failed", error instanceof Error ? error.message : "unknown error");
  app.quit();
});

app.on("window-all-closed", () => app.quit());
