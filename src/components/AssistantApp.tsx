"use client";

import { useCallback, useEffect, useState } from "react";
import type { LocalDeviceState } from "@/lib/device-types";
import { appendDigit, canSubmitCode, formatPairingCode, removeLastDigit } from "@/lib/keypad";

type Screen = "checking" | "unpaired" | "connected" | "offline" | "complete";

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || fallback;
  } catch { return fallback; }
}

export function AssistantApp() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("TeacherLyft Assistant");
  const [teacherName, setTeacherName] = useState<string | null>(null);

  const applyState = useCallback((state: LocalDeviceState) => {
    if (state.state === "connected") {
      setDeviceName(state.deviceName);
      setTeacherName(state.teacherDisplayName);
      setNotice(null);
      setScreen("connected");
    } else if (state.state === "offline") {
      setScreen("offline");
    } else {
      setNotice(state.reason === "revoked"
        ? "This TeacherLyft Assistant has been disconnected from the account."
        : null);
      setScreen("unpaired");
    }
  }, []);

  const checkDevice = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/local/device", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to check this device.");
      applyState(await response.json() as LocalDeviceState);
    } catch {
      setError("Unable to check this device. Try again.");
      setScreen("offline");
    } finally { setBusy(false); }
  }, [applyState]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/local/device", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to check this device.");
        return response.json() as Promise<LocalDeviceState>;
      })
      .then((state) => { if (!cancelled) applyState(state); })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to check this device. Try again.");
          setScreen("offline");
        }
      });
    return () => { cancelled = true; };
  }, [applyState]);

  const connect = async () => {
    if (!canSubmitCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/local/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setCode("");
      if (!response.ok) throw new Error(await parseError(response, "Unable to pair this device."));
      applyState(await response.json() as LocalDeviceState);
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : "Unable to pair this device.");
    } finally { setBusy(false); }
  };

  if (screen === "checking") return <Shell><div className="status-card"><Spinner /><h1>Checking your Assistant</h1><p>Connecting securely to TeacherLyft…</p></div></Shell>;
  if (screen === "offline") return <Shell><div className="status-card"><div className="status-icon muted">!</div><p className="eyebrow">TeacherLyft Assistant</p><h1>You’re offline.</h1><p>Your device is still paired. Reconnect to the internet and try again.</p>{error && <p className="error" role="alert">{error}</p>}<button className="primary wide" onClick={() => void checkDevice()} disabled={busy}>{busy ? "Checking…" : "Retry"}</button></div></Shell>;
  if (screen === "connected") return <Shell><div className="status-card"><div className="status-icon success">✓</div><p className="eyebrow">TeacherLyft</p><h1>Connected</h1><p>TeacherLyft Assistant is linked to:</p><strong className="account-name">{teacherName || "Your TeacherLyft account"}</strong><dl><div><dt>Device</dt><dd>{deviceName}</dd></div></dl><button className="primary wide" onClick={() => setScreen("complete")}>Continue</button></div></Shell>;
  if (screen === "complete") return <Shell><div className="status-card"><div className="status-icon success">✓</div><p className="eyebrow">TeacherLyft</p><h1>Setup complete.</h1><p>Your Assistant is securely connected and ready for the next phase.</p><button className="secondary wide" onClick={() => setScreen("connected")}>Back</button></div></Shell>;

  return <Shell><main className="pairing-layout"><section className="instructions"><p className="eyebrow">TeacherLyft</p><h1>Connect Your Account</h1><p>Generate a pairing code from:</p><ol><li>TeacherLyft</li><li>Settings → Devices</li><li>Connect New Device</li></ol><p className="privacy-note">Your password and Google credentials never go on this device.</p></section><section className="keypad-panel">{notice && <p className="notice" role="status">{notice}</p>}<label>Enter your six-digit code</label><output className="code-display" aria-label={`Pairing code ${code || "empty"}`}>{formatPairingCode(code)}</output>{error && <p className="error" role="alert">{error}</p>}<div className="keypad" aria-label="Numeric keypad">{["1","2","3","4","5","6","7","8","9"].map((digit) => <button key={digit} disabled={busy || code.length >= 6} onClick={() => { setCode((current) => appendDigit(current, digit)); setError(null); }}>{digit}</button>)}<button aria-label="Backspace" disabled={busy || code.length === 0} onClick={() => setCode((current) => removeLastDigit(current))}>⌫</button><button disabled={busy || code.length >= 6} onClick={() => { setCode((current) => appendDigit(current, "0")); setError(null); }}>0</button><button className="connect" disabled={busy || !canSubmitCode(code)} onClick={() => void connect()}>{busy ? <Spinner /> : "Connect"}</button></div></section></main></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell"><div className="brand-mark" aria-hidden="true">TL</div>{children}</div>;
}

function Spinner() { return <span className="spinner" aria-label="Loading" />; }
