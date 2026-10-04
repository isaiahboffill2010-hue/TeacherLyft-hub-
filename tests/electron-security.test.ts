import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createTeacherLyftBridge } from "@/preload/bridge";
import { IPC_CHANNELS, isValidPairRequest } from "@/shared/ipc";
import { browserWindowOptions } from "@/main/window-options";

const root = new URL("../", import.meta.url);
const text = (relativePath: string) => readFile(new URL(relativePath, root), "utf8");

describe("Electron security boundary", () => {
  it("enables isolation and sandboxing while disabling renderer Node access", () => {
    const options = browserWindowOptions("/trusted/preload.js", true);
    expect(options.webPreferences).toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false });
  });

  it("exposes only the four approved bridge methods", () => {
    const bridge = createTeacherLyftBridge(vi.fn());
    expect(Object.keys(bridge).sort()).toEqual(["getDeviceState", "localDisconnect", "pair", "retryConnection"]);
    expect(Object.isFrozen(bridge)).toBe(true);
  });

  it("maps calls only to fixed IPC channels", async () => {
    const invoke = vi.fn().mockResolvedValue({ state: "unpaired" });
    const bridge = createTeacherLyftBridge(invoke);
    await bridge.getDeviceState();
    await bridge.pair({ code: "123456" });
    await bridge.retryConnection();
    await bridge.localDisconnect();
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(Object.values(IPC_CHANNELS));
    expect(JSON.stringify(invoke.mock.calls)).not.toContain("deviceToken");
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
