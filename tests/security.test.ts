import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("client credential isolation", () => {
  it("does not reference device tokens or credential storage in client source", () => {
    const client = read("src/components/AssistantApp.tsx");
    expect(client).not.toMatch(/deviceToken|Authorization|credential-store|localStorage|sessionStorage/);
  });

  it("returns an allowlisted safe connected shape", () => {
    const localDevice = read("src/lib/local-device.ts");
    expect(localDevice).toContain('state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName');
    expect(localDevice).not.toMatch(/state: "connected"[^\n]*deviceToken/);
  });
});
