import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createTeacherLyftBridge } from "@/preload/bridge";
import { IPC_CHANNELS, isValidPairRequest } from "@/shared/ipc";
import {
  browserWindowOptions,
  resolvePreloadPath,
  shouldUseSandbox,
} from "@/main/window-options";

const root = new URL("../", import.meta.url);
const rootPath = dirname(fileURLToPath(new URL("package.json", root)));
const text = (relativePath: string) => readFile(new URL(relativePath, root), "utf8");

describe("Electron security boundary", () => {
  it("enables isolation and sandboxing while disabling renderer Node access", () => {
    const options = browserWindowOptions("/trusted/preload.js", true);
    expect(options.webPreferences).toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false });
  });

  it("limits sandbox compatibility mode to Linux ARM64", () => {
    expect(shouldUseSandbox({ platform: "win32", arch: "arm64", compatibilityRequested: true })).toBe(true);
    expect(shouldUseSandbox({ platform: "linux", arch: "x64", compatibilityRequested: true })).toBe(true);
    expect(shouldUseSandbox({ platform: "linux", arch: "arm64", compatibilityRequested: false })).toBe(true);
    expect(shouldUseSandbox({ platform: "linux", arch: "arm64", compatibilityRequested: true })).toBe(false);
  });

  it("pins Electron and launches the explicit built main entry", async () => {
    const packageJson = JSON.parse(await text("package.json")) as {
      scripts: { start: string };
      devDependencies: { electron: string };
    };
    expect(packageJson.devDependencies.electron).toBe("43.2.0");
    expect(packageJson.scripts.start).toBe("electron out/main/index.js");
  });

  it("builds and resolves the sandbox-compatible CommonJS preload artifact", async () => {
    const command = process.platform === "win32"
      ? { executable: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", "npm run build"] }
      : { executable: "npm", args: ["run", "build"] };
    const build = spawnSync(command.executable, command.args, {
      cwd: rootPath,
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(build.error?.message).toBeUndefined();
    expect(build.stderr).not.toContain("error during build");
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

    const expectedPreload = resolve(rootPath, "out/preload/index.cjs");
    expect(existsSync(expectedPreload)).toBe(true);
    expect(resolvePreloadPath(resolve(rootPath, "out/main"))).toBe(expectedPreload);
    expect(existsSync(resolve(rootPath, "out/preload/index.js"))).toBe(false);
    expect(existsSync(resolve(rootPath, "out/preload/index.mjs"))).toBe(false);

    const preloadReferences = `${await text("src/main/index.ts")}\n${await text("out/main/index.js")}`;
    expect(preloadReferences).not.toMatch(/preload[\\/]index\.(?:js|mjs)/);
  }, 120_000);

  it("contains no forced Ozone or GPU flags", async () => {
    const runtime = [
      await text("src/main/index.ts"),
      await text("src/main/window-options.ts"),
      await text("scripts/start-pi-x11.sh"),
      await text("scripts/start-pi-x11-client.sh"),
    ].join("\n");
    expect(runtime).not.toMatch(/--(?:ozone-platform(?:-hint)?|disable-gpu(?:-compositing)?|use-gl|use-angle)/);
  });

  it("has valid Bash syntax for both Pi X11 scripts", () => {
    const windowsBash = "C:/Program Files/Git/bin/bash.exe";
    const bash = process.platform === "win32" && existsSync(windowsBash) ? windowsBash : "bash";
    const result = spawnSync(bash, ["-n", "scripts/start-pi-x11.sh", "scripts/start-pi-x11-client.sh"], {
      cwd: new URL("../", import.meta.url),
      encoding: "utf8",
    });
    expect(result.error?.message).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("exposes only the explicitly approved bridge methods", () => {
    const bridge = createTeacherLyftBridge(vi.fn());
    expect(Object.keys(bridge).sort()).toEqual([
      "getAssignments", "getClasses", "getCurriculum", "getDashboard", "getDetail", "getDeviceState",
      "getDrafts", "getLibrary", "getStudentProgress", "localDisconnect", "pair", "retryConnection",
    ]);
    expect(Object.isFrozen(bridge)).toBe(true);
  });

  it("maps calls only to fixed IPC channels", async () => {
    const invoke = vi.fn().mockResolvedValue({ state: "unpaired" });
    const bridge = createTeacherLyftBridge(invoke);
    await bridge.getDeviceState();
    await bridge.getDashboard();
    await bridge.getClasses();
    await bridge.getAssignments();
    await bridge.getStudentProgress();
    await bridge.getCurriculum();
    await bridge.getDrafts();
    await bridge.getLibrary();
    await bridge.getDetail({ kind: "student", classId: "class-1", id: "student-1" });
    await bridge.pair({ code: "123456" });
    await bridge.retryConnection();
    await bridge.localDisconnect();
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(Object.values(IPC_CHANNELS));
    expect(JSON.stringify(invoke.mock.calls)).not.toContain("deviceToken");
  });

  it("keeps sender validation on every fixed IPC handler", async () => {
    const handlers = await text("src/main/ipc-handlers.ts");
    for (const channel of ["getDeviceState", "getDashboard", "getDetail", "retryConnection", "localDisconnect", "pair"] as const) {
      const start = handlers.indexOf(`IPC_CHANNELS.${channel}`);
      expect(start, `${channel} handler missing`).toBeGreaterThan(-1);
      expect(handlers.slice(start, start + 180)).toContain("requireTrustedSender(event, webContentsId)");
    }
    for (const channel of ["getClasses", "getAssignments", "getStudentProgress", "getCurriculum", "getDrafts", "getLibrary"] as const) {
      expect(handlers).toContain(`IPC_CHANNELS.${channel}`);
    }
    expect(handlers).toMatch(/for \(const \[channel, section\][\s\S]*ipcMain\.handle\(channel[\s\S]*requireTrustedSender\(event, webContentsId\)/);
  });

  it("accepts exactly six numeric pairing digits", () => {
    expect(isValidPairRequest({ code: "123456" })).toBe(true);
    expect(isValidPairRequest({ code: "12345" })).toBe(false);
    expect(isValidPairRequest({ code: "12345x" })).toBe(false);
    expect(isValidPairRequest({ code: 123456 })).toBe(false);
  });

  it("keeps privileged data out of renderer and bridge source", async () => {
    const renderer = `${await text("src/renderer/AssistantApp.tsx")}\n${await text("src/preload/bridge.ts")}`;
    expect(renderer).not.toMatch(/deviceToken|Authorization|credential-store|node:fs|ipcRenderer/);
  });
});
