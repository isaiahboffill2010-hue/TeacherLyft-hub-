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
  directory = await mkdtemp(path.join(os.tmpdir(), "teacherlyft-assistant-test-"));
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

describe("local pairing boundary", () => {
  it("forwards a valid code, stores the credential, verifies it, and never returns the token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(pairResponse())
      .mockResolvedValueOnce(meResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/local/pair/route");
    const response = await POST(new Request("http://localhost/api/local/pair", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "123456" }),
    }));
    const browserBody = await response.json();

    expect(response.status).toBe(200);
    expect(browserBody).toEqual({ state: "connected", deviceName: "TeacherLyft Assistant", teacherDisplayName: "Ms. Rivera" });
    expect(JSON.stringify(browserBody)).not.toContain(token);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("https://teacherlyft.test/api/devices/pair");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({ code: "123456", name: "TeacherLyft Assistant" });
    expect(await readFile(credentialPath, "utf8")).toContain(token);
  });

  it("loads a persisted credential after module restart", async () => {
    const store = await import("@/lib/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.resetModules();
    const restartedStore = await import("@/lib/credential-store");
    expect(await restartedStore.loadDeviceCredential()).toEqual({ deviceId, deviceToken: token });
  });

  it("returns connected for a valid stored credential", async () => {
    const store = await import("@/lib/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(meResponse()));
    const { getLocalDeviceState } = await import("@/lib/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "connected", deviceName: "TeacherLyft Assistant", teacherDisplayName: "Ms. Rivera" });
  });

  it("deletes a revoked credential and reports the reason", async () => {
    const store = await import("@/lib/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(meResponse(401)));
    const { getLocalDeviceState } = await import("@/lib/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "unpaired", reason: "revoked" });
    expect(await store.loadDeviceCredential()).toBeNull();
  });

  it("keeps the credential on a network error", async () => {
    const store = await import("@/lib/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { getLocalDeviceState } = await import("@/lib/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "offline", paired: true });
    expect(await store.loadDeviceCredential()).toEqual({ deviceId, deviceToken: token });
  });

  it("does not persist a malformed pairing response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pairResponse({ success: true, deviceId })));
    const { pairLocalDevice } = await import("@/lib/local-device");
    await expect(pairLocalDevice("123456")).rejects.toThrow();
    const { loadDeviceCredential } = await import("@/lib/credential-store");
    expect(await loadDeviceCredential()).toBeNull();
  });

  it("removes an incomplete credential when verification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(pairResponse()).mockResolvedValueOnce(meResponse(401)));
    const { pairLocalDevice } = await import("@/lib/local-device");
    await expect(pairLocalDevice("123456")).rejects.toThrow();
    const { loadDeviceCredential } = await import("@/lib/credential-store");
    expect(await loadDeviceCredential()).toBeNull();
  });

  it("local disconnect deletes the credential", async () => {
    const store = await import("@/lib/credential-store");
    await store.saveDeviceCredential({ deviceId, deviceToken: token });
    const { POST } = await import("@/app/api/local/disconnect/route");
    const response = await POST(new Request("http://localhost/api/local/disconnect", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await store.loadDeviceCredential()).toBeNull();
  });

  it("reports unpaired when there is no credential", async () => {
    const { getLocalDeviceState } = await import("@/lib/local-device");
    expect(await getLocalDeviceState()).toEqual({ state: "unpaired" });
  });

  it("rejects cross-origin local mutations", async () => {
    const { POST: pair } = await import("@/app/api/local/pair/route");
    const response = await pair(new Request("http://localhost/api/local/pair", {
      method: "POST",
      headers: { Origin: "https://malicious.example", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    }));
    expect(response.status).toBe(403);
  });

  it("logs a safe HTTP status diagnostic without logging the pairing code", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 })));
    const { POST } = await import("@/app/api/local/pair/route");
    const response = await POST(new Request("http://localhost/api/local/pair", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "123456" }),
    }));

    expect(response.status).toBe(503);
    const output = JSON.stringify(errorSpy.mock.calls);
    expect(output).toContain('"kind":"http"');
    expect(output).toContain('"status":403');
    expect(output).not.toContain("123456");
    expect(output).not.toContain(token);
  });

  it("distinguishes credential save failures without logging the credential", async () => {
    const blockedParent = path.join(directory, "not-a-directory");
    await writeFile(blockedParent, "file");
    vi.stubEnv("TEACHERLYFT_CREDENTIAL_PATH", path.join(blockedParent, "device.json"));
    vi.resetModules();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pairResponse()));
    const { POST } = await import("@/app/api/local/pair/route");
    const response = await POST(new Request("http://localhost/api/local/pair", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "123456" }),
    }));

    expect(response.status).toBe(503);
    const output = JSON.stringify(errorSpy.mock.calls);
    expect(output).toContain('"kind":"credential_save"');
    expect(output).not.toContain("123456");
    expect(output).not.toContain(token);
  });

  it("returns only safe backend probe fields", async () => {
    vi.stubEnv("TEACHERLYFT_API_URL", "http://10.0.0.18:3000");
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
    const { GET } = await import("@/app/api/local/debug-backend/route");
    const response = await GET(new Request("http://localhost/api/local/debug-backend"));
    const body = await response.json();

    expect(body).toEqual({
      host: "10.0.0.18:3000",
      protocol: "http",
      fetchSucceeded: true,
      status: 200,
      latencyMs: expect.any(Number),
    });
    expect(JSON.stringify(body)).not.toContain(token);
  });
});
