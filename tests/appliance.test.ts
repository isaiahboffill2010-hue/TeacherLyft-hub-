import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const text = (relativePath: string) => readFile(new URL(relativePath, root), "utf8");

describe("Phase 2 appliance configuration", () => {
  it("provides a minimal no-store health endpoint", async () => {
    const { GET } = await import("@/app/api/local/health/route");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("runs the production server only on loopback and restarts it", async () => {
    const service = await text("deploy/teacherlyft-assistant.service");
    expect(service).toContain("Environment=NODE_ENV=production");
    expect(service).toContain("--hostname 127.0.0.1 --port 3000");
    expect(service).toContain("Restart=always");
    expect(service).toContain("User=teacherlyft");
    expect(service).not.toContain("npm run dev");
  });

  it("waits for local health, relaunches Chromium, and keeps its sandbox", async () => {
    const kiosk = await text("scripts/start-kiosk.sh");
    expect(kiosk).toContain("/api/local/health");
    expect(kiosk).toContain("until curl --fail");
    expect(kiosk).toContain("Chromium exited with status");
    expect(kiosk).toContain("--kiosk");
    expect(kiosk).not.toContain("--no-sandbox");
  });

  it("never removes the persistent credential directory during installation", async () => {
    const installer = await text("scripts/install-pi.sh");
    expect(installer).toContain('STATE_DIR="/var/lib/teacherlyft-assistant"');
    expect(installer).toContain('install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$STATE_DIR"');
    expect(installer).toContain("systemd-analyze verify");
    expect(installer).toContain("bash -n");
    expect(installer).not.toMatch(/rm\s+-[^\n]*r[^\n]*STATE_DIR/);
    expect(installer).not.toMatch(/rm\s+[^\n]*device\.json/);
  });

  it("configures labwc autostart with an XDG fallback", async () => {
    const installer = await text("scripts/install-pi.sh");
    expect(installer).toContain(".config/labwc");
    expect(installer).toContain(".config/autostart");
    expect(installer).toContain("command -v labwc");
  });
});
