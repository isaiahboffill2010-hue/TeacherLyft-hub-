import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configureDiagnosticLog, diagnosticInfo, formatDiagnosticEntry } from "@/main/diagnostic-log";

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

describe("diagnostic logging", () => {
  it("redacts credentials and authorization data from structured entries", () => {
    const entry = formatDiagnosticEntry("error", "test", "failed", {
      deviceToken: "secret-token",
      authorization: "Bearer secret",
      pairingCode: "123456",
      nested: { credential: "secret", status: 403 },
      kind: "unauthorized",
      message: `request failed for Bearer abc.def and tla_${"a".repeat(32)}_${"B".repeat(43)} with code 123456`,
    }, new Date("2026-10-04T12:00:00.000Z"));
    expect(entry).not.toContain("secret-token");
    expect(entry).not.toContain("Bearer secret");
    expect(entry).not.toContain("123456");
    expect(entry).not.toContain('"credential":"secret"');
    expect(entry).not.toContain("abc.def");
    expect(entry).toContain('"kind":"unauthorized"');
    expect(entry).toContain('"status":403');
  });

  it("writes newline-delimited diagnostic entries to the configured log file", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "teacherlyft-log-test-"));
    const target = configureDiagnosticLog(directory);
    diagnosticInfo("device_state", "verification_started");
    const content = await readFile(target, "utf8");
    expect(content).toContain('"event":"configured"');
    expect(content).toContain('"event":"verification_started"');
    expect(content.trim().split("\n")).toHaveLength(2);
  });

  it("keeps timing metadata while redacting credentials", () => {
    const entry=formatDiagnosticEntry("warn","api","request_failed",{endpoint:"/api/device/assignments",kind:"timeout",elapsedMs:90000,configuredTimeoutMs:90000,authorization:"Bearer private",deviceToken:"private"});
    expect(entry).toContain('"elapsedMs":90000'); expect(entry).toContain('"configuredTimeoutMs":90000'); expect(entry).toContain("/api/device/assignments");
    expect(entry).not.toContain("Bearer private"); expect(entry).not.toContain('"deviceToken":"private"');
  });
});
