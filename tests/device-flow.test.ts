import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const token = `tla_${"a".repeat(32)}_${"B".repeat(43)}`;
const deviceId = "device-123";
let directory: string;
let credentialPath: string;

function pairResponse(body: unknown = { success: true, deviceId, deviceToken: token }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function meResponse(status = 200) {
  const body = status === 200
    ? { connected: true, deviceId, deviceName: "TeacherLyft Assistant", teacherDisplayName: "Ms. Rivera" }
    : { error: "Unauthorized device" };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "teacherlyft-electron-test-"));
  credentialPath = path.join(directory, "state", "device.json");
  vi.stubEnv("TEACHERLYFT_CREDENTIAL_PATH", credentialPath);
  vi.stubEnv("TEACHERLYFT_API_URL", "https://teacherlyft.test");
  vi.resetModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

describe("Electron main-process device flow", () => {
  it("pairs, stores the credential, verifies, and returns no token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(pairResponse()).mockResolvedValueOnce(meResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { pairLocalDevice } = await import("@/main/local-device");
    const state = await pairLocalDevice("123456");
    expect(state).toEqual({ state: "connected", deviceName: "TeacherLyft Assistant", teacherDisplayName: "Ms. Rivera" });
    expect(JSON.stringify(state)).not.toContain(token);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("https://teacherlyft.test/api/devices/pair");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({ code: "123456", name: "TeacherLyft Assistant" });
    expect(await readFile(credentialPath, "utf8")).toContain(token);
  });

  it("loads a persisted credential after module restart", async () => {
    const store = await import("@/main/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.resetModules();
    const restarted = await import("@/main/credential-store");
    expect(await restarted.loadDeviceCredential()).toEqual({ deviceId, deviceToken: token });
  });

  it("returns connected for a valid stored credential", async () => {
    const store = await import("@/main/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(meResponse()));
    const { getLocalDeviceState } = await import("@/main/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "connected", deviceName: "TeacherLyft Assistant", teacherDisplayName: "Ms. Rivera" });
  });

  it("deletes a revoked credential", async () => {
    const store = await import("@/main/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(meResponse(401)));
    const { getLocalDeviceState } = await import("@/main/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "unpaired", reason: "revoked" });
    expect(await store.loadDeviceCredential()).toBeNull();
  });

  it("keeps the credential and reports offline on network failure", async () => {
    const store = await import("@/main/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { getLocalDeviceState } = await import("@/main/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "offline", paired: true });
    expect(await store.loadDeviceCredential()).toEqual({ deviceId, deviceToken: token });
  });

  it("does not persist a malformed pairing response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pairResponse({ success: true, deviceId })));
    const { pairLocalDevice } = await import("@/main/local-device");
    await expect(pairLocalDevice("123456")).rejects.toThrow();
    const { loadDeviceCredential } = await import("@/main/credential-store");
    expect(await loadDeviceCredential()).toBeNull();
  });

  it("removes an incomplete credential when immediate verification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(pairResponse()).mockResolvedValueOnce(meResponse(401)));
    const { pairLocalDevice } = await import("@/main/local-device");
    await expect(pairLocalDevice("123456")).rejects.toThrow("verification failed");
    const { loadDeviceCredential } = await import("@/main/credential-store");
    expect(await loadDeviceCredential()).toBeNull();
  });

  it("keeps a newly paired credential when immediate verification is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(pairResponse()).mockRejectedValueOnce(new Error("offline")));
    const { pairLocalDevice } = await import("@/main/local-device");
    expect(await pairLocalDevice("123456")).toEqual({ state: "offline", paired: true });
    const { loadDeviceCredential } = await import("@/main/credential-store");
    expect(await loadDeviceCredential()).toEqual({ deviceId, deviceToken: token });
  });

  it("classifies backend 400 as an invalid pairing code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"invalid"}', { status: 400 })));
    const { pairWithTeacherLyft } = await import("@/main/teacherlyft-api");
    await expect(pairWithTeacherLyft("123456")).rejects.toMatchObject({ kind: "invalid_code", status: 400 });
  });

  it("local disconnect deletes the credential", async () => {
    const store = await import("@/main/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    const { disconnectLocalDevice } = await import("@/main/local-device");
    await disconnectLocalDevice();
    expect(await store.loadDeviceCredential()).toBeNull();
  });

  it("distinguishes credential save failures", async () => {
    const blockedParent = path.join(directory, "not-a-directory");
    await writeFile(blockedParent, "file");
    vi.stubEnv("TEACHERLYFT_CREDENTIAL_PATH", path.join(blockedParent, "device.json"));
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pairResponse()));
    const { pairLocalDevice } = await import("@/main/local-device");
    await expect(pairLocalDevice("123456")).rejects.toMatchObject({ kind: "credential_save" });
  });
});
