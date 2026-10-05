import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { app, BrowserWindow, Menu, session } from "electron";
import { registerIpcHandlers, removeIpcHandlers } from "@/main/ipc-handlers";
import { browserWindowOptions, resolvePreloadPath, shouldUseSandbox } from "@/main/window-options";
import { configureDiagnosticLog, diagnosticError, diagnosticInfo } from "@/main/diagnostic-log";

try { loadEnvFile(join(process.cwd(), ".env.local")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

const development = Boolean(process.env.ELECTRON_RENDERER_URL);
const sandboxEnabled = shouldUseSandbox();
if (sandboxEnabled) app.enableSandbox();

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow(browserWindowOptions(
    resolvePreloadPath(__dirname),
    !development,
    sandboxEnabled,
  ));
  diagnosticInfo("startup", "browser_window_created");
  Menu.setApplicationMenu(null);
  registerIpcHandlers(window.webContents.id);

  window.webContents.on("console-message", (details) => {
    const metadata = { level: details.level, message: details.message };
    if (details.level === "error") diagnosticError("renderer", "console_message", metadata);
    else diagnosticInfo("renderer", "console_message", metadata);
  });
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    diagnosticError("preload", "load_failed", { preloadPath, message: error.message });
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
  window.webContents.once("did-finish-load", () => diagnosticInfo("startup", "renderer_finished_load"));
  window.on("closed", removeIpcHandlers);

  if (development && process.env.ELECTRON_RENDERER_URL) {
    diagnosticInfo("startup", "renderer_load_started", { mode: "development" });
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    diagnosticInfo("startup", "renderer_load_started", { mode: "bundled" });
    await window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return window;
}

app.whenReady().then(async () => {
  const diagnosticPath = configureDiagnosticLog(join(app.getPath("appData"), "teacherlyft-assistant", "logs"));
  diagnosticInfo("startup", "runtime_ready", {
    diagnosticPath,
    electron: process.versions.electron,
    platform: process.platform,
    arch: process.arch,
    sessionType: process.env.XDG_SESSION_TYPE ?? "unknown",
    displayConfigured: Boolean(process.env.DISPLAY),
    waylandConfigured: Boolean(process.env.WAYLAND_DISPLAY),
    sandbox: sandboxEnabled,
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch((error) => {
  diagnosticError("startup", "failed", { message: error instanceof Error ? error.message : "unknown error" });
  app.quit();
});

app.on("window-all-closed", () => app.quit());
