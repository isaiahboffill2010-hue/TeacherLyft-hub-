import { useCallback, useEffect, useState } from "react";
import type { LocalDeviceState } from "@/shared/device-types";
import { appendDigit, canSubmitCode, formatPairingCode, removeLastDigit } from "@/shared/keypad";
import { HubDashboard } from "@/renderer/components/HubDashboard";

type Screen = "checking" | "unpaired" | "connected" | "offline" | "bridge-error";
const DEVICE_REVALIDATION_INTERVAL_MS = 60_000;

export function AssistantApp() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);

  console.info("[renderer] AssistantApp render entered");

  useEffect(() => {
    console.info(`[renderer] current UI state: ${screen}`);
  }, [screen]);

  const applyState = useCallback((state: LocalDeviceState) => {
    if (state.state === "connected") {
      setTeacherName(state.teacherDisplayName);
      setNotice(null);
      setScreen("connected");
    } else if (state.state === "offline") {
      setScreen("offline");
    } else {
      setTeacherName(null);
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
      if (!window.teacherlyft) throw new Error("Preload bridge unavailable");
      applyState(await window.teacherlyft.retryConnection());
    }
    catch {
      setError("Unable to check this device. Try again.");
      setScreen(window.teacherlyft ? "offline" : "bridge-error");
    } finally { setBusy(false); }
  }, [applyState]);

  useEffect(() => {
    let cancelled = false;
    const bridge = window.teacherlyft;
    console.info(`[renderer] window.teacherlyft ${bridge ? "exists" : "does not exist"}`);
    if (!bridge) {
      setError("The secure preload bridge did not start.");
      setScreen("bridge-error");
      return () => { cancelled = true; };
    }

    console.info("[renderer] getDeviceState called");
    void bridge.getDeviceState()
      .then((state) => {
        console.info("[renderer] getDeviceState resolved");
        if (!cancelled) applyState(state);
      })
      .catch(() => {
        console.error("[renderer] getDeviceState rejected");
        if (!cancelled) {
          setError("Unable to check this device. Try again.");
          setScreen("offline");
        }
      });
    return () => { cancelled = true; };
  }, [applyState]);

  useEffect(() => {
    if (screen !== "connected" && screen !== "offline") return;
    const bridge = window.teacherlyft;
    if (!bridge) return;

    const timer = window.setInterval(() => {
      void bridge.getDeviceState()
        .then(applyState)
        .catch(() => console.error("[renderer] periodic device validation rejected"));
    }, DEVICE_REVALIDATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [applyState, screen]);

  const connect = async () => {
    if (!canSubmitCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const bridge = window.teacherlyft;
      if (!bridge) throw new Error("Preload bridge unavailable");
      const result = await bridge.pair({ code });
      setCode("");
      if (result.ok) applyState(result.state);
      else setError(result.message);
    } catch {
      setError("Unable to pair this device.");
    } finally { setBusy(false); }
  };

  if (screen === "checking") return <Shell><div className="status-card"><Spinner /><h1>Checking your Assistant</h1><p>Connecting securely to TeacherLyft…</p></div></Shell>;
  if (screen === "bridge-error") return <Shell><div className="status-card" role="alert"><div className="status-icon muted">!</div><p className="eyebrow">TeacherLyft Assistant</p><h1>Unable to start securely.</h1><p>{error || "The secure connection to this device is unavailable."}</p><button className="primary wide" onClick={() => window.location.reload()}>Retry</button></div></Shell>;
  if (screen === "offline" || screen === "connected") return <HubDashboard connection={screen} teacherName={teacherName} retrying={busy} onRetry={() => void checkDevice()}/>;

  return <Shell><main className="pairing-layout"><section className="instructions"><p className="eyebrow">TeacherLyft</p><h1>Connect Your Account</h1><p>Generate a pairing code from:</p><ol><li>TeacherLyft</li><li>Settings → Devices</li><li>Connect New Device</li></ol><p className="privacy-note">Your password and Google credentials never go on this device.</p></section><section className="keypad-panel">{notice && <p className="notice" role="status">{notice}</p>}<label>Enter your six-digit code</label><output className="code-display" aria-label={`Pairing code ${code || "empty"}`}>{formatPairingCode(code)}</output>{error && <p className="error" role="alert">{error}</p>}<div className="keypad" aria-label="Numeric keypad">{["1","2","3","4","5","6","7","8","9"].map((digit) => <button key={digit} disabled={busy || code.length >= 6} onClick={() => { setCode((current) => appendDigit(current, digit)); setError(null); }}>{digit}</button>)}<button aria-label="Backspace" disabled={busy || code.length === 0} onClick={() => setCode((current) => removeLastDigit(current))}>⌫</button><button disabled={busy || code.length >= 6} onClick={() => { setCode((current) => appendDigit(current, "0")); setError(null); }}>0</button><button className="connect" disabled={busy || !canSubmitCode(code)} onClick={() => void connect()}>{busy ? <Spinner /> : "Connect"}</button></div></section></main></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell"><div className="brand-mark" aria-hidden="true">TL</div>{children}</div>;
}

function Spinner() { return <span className="spinner" aria-label="Loading" />; }
