import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTeacherLyftDashboard } from "@/main/teacherlyft-api";
import type { DeviceCredential } from "@/shared/device-types";

const token = `tla_${"a".repeat(32)}_${"B".repeat(43)}`;
const credential: DeviceCredential = { deviceId: "device-123", deviceToken: token };
const response = {
  teacherName: "Dr. Okafor",
  classes: 0,
  toGrade: 7,
  students: 24,
  reminders: 2,
  needsAttention: [{ id: "grade-1", title: "7 papers to grade", detail: "Algebra · Period 2", kind: "grading" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("device dashboard API client", () => {
  it("uses the fixed dashboard URL and existing device credential", async () => {
    vi.stubEnv("TEACHERLYFT_API_URL", "https://teacherlyft.example/base/path");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTeacherLyftDashboard(credential)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://teacherlyft.example/api/device/dashboard");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${token}` });
  });

  it("rejects malformed counts instead of passing unsafe data to the renderer", async () => {
    vi.stubEnv("TEACHERLYFT_API_URL", "https://teacherlyft.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...response, classes: -1 }), { status: 200 })));
    await expect(fetchTeacherLyftDashboard(credential)).rejects.toMatchObject({ kind: "malformed" });
  });

  it("classifies revoked dashboard credentials as unauthorized", async () => {
    vi.stubEnv("TEACHERLYFT_API_URL", "https://teacherlyft.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(fetchTeacherLyftDashboard(credential)).rejects.toMatchObject({ kind: "unauthorized", status: 401 });
  });
});
