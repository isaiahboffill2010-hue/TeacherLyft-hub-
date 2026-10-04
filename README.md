# TeacherLyft Assistant

TeacherLyft Assistant is a touchscreen-first Electron desktop application for securely pairing a Raspberry Pi appliance with a TeacherLyft teacher account.

The canonical runtime is Electron + Vite + React + TypeScript. It does not run a local web server or launch an external Chromium browser.

## Architecture

```text
React/Vite renderer (no Node.js access)
  → frozen contextBridge API with four methods
  → fixed, sender-validated IPC channels
  → Electron main process
      → credential store
      → TeacherLyft device API
```

The renderer receives only safe device state and safe error messages. The device token and authorization header remain in the Electron main process.

## Requirements

- Node.js 22.12 or newer
- npm
- Raspberry Pi OS 64-bit ARM64 or Windows for development
- A graphical desktop session for Electron

There are no native application dependencies beyond Electron itself. npm downloads the Electron binary matching the host architecture.

## Configuration

Create the ignored `.env.local` file:

```dotenv
TEACHERLYFT_API_URL=http://10.0.0.18:3000
```

Do not hardcode development addresses in source. Production can use the deployed HTTPS TeacherLyft origin.

Optional window override:

```dotenv
TEACHERLYFT_FULLSCREEN=false
```

Development runs in a normal resizable window. Production preview is fullscreen by default. `Ctrl+Shift+F11` toggles fullscreen as an administrator escape; `F12` toggles DevTools only during development.

## Commands

```bash
npm ci
npm run dev
npm test
npm run type-check
npm run lint
npm run build
npm run start
```

`npm run dev` starts the Vite renderer and Electron together with live reload. `npm run build` produces main, preload, and renderer outputs under `out/`. `npm run start` opens the built Electron application; it does not start a localhost server.

## Electron security

The `BrowserWindow` explicitly sets:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webviewTag: false`

The app also enables the sandbox globally, denies all permission requests, blocks new windows, blocks cross-origin navigation, removes the application menu, and loads only the bundled renderer in production.

The frozen preload bridge exposes only:

```ts
window.teacherlyft.getDeviceState()
window.teacherlyft.pair({ code: "123456" })
window.teacherlyft.retryConnection()
window.teacherlyft.localDisconnect()
```

Raw `ipcRenderer`, arbitrary channel names, filesystem access, shell access, credentials, and authorization headers are not exposed.

## Credential storage

Linux/Raspberry Pi uses:

```text
/var/lib/teacherlyft-assistant/device.json
```

The directory is mode `0700`; the file is mode `0600`. Writes use a private temporary file followed by atomic rename, and existing paths are rejected if they are symbolic links. Windows development uses the ignored `.teacherlyft-state/device.json` fallback.

A backend `401` deletes the credential and returns the UI to pairing. DNS, TCP, timeout, and backend availability errors retain the credential and produce the offline screen.

The desktop user running Electron must own the state directory. When migrating from the retired `teacherlyft` systemd account, transfer ownership without deleting or recreating the credential:

```bash
sudo chown "$(id -un):$(id -gn)" /var/lib/teacherlyft-assistant
sudo chmod 700 /var/lib/teacherlyft-assistant
if sudo test -f /var/lib/teacherlyft-assistant/device.json; then
  sudo chown "$(id -un):$(id -gn)" /var/lib/teacherlyft-assistant/device.json
  sudo chmod 600 /var/lib/teacherlyft-assistant/device.json
fi
```

## Manual Raspberry Pi preview

Automatic boot and kiosk installation are intentionally retired for this preview phase. Run Electron manually from the desktop session:

```bash
cd ~/TeacherLyft-hub-
git status --short
git pull --ff-only origin main
npm ci
npm test
npm run type-check
npm run build
sudo chown "$(id -un):$(id -gn)" /var/lib/teacherlyft-assistant
sudo chmod 700 /var/lib/teacherlyft-assistant
if sudo test -f /var/lib/teacherlyft-assistant/device.json; then
  sudo chown "$(id -un):$(id -gn)" /var/lib/teacherlyft-assistant/device.json
  sudo chmod 600 /var/lib/teacherlyft-assistant/device.json
fi
npm run start
```

If the existing checkout is `/opt/teacherlyft-assistant`, use that path instead. Run the command as the graphical desktop user, not over a headless SSH-only session.

## Real-Pi acceptance test

1. Before updating, record `sudo stat /var/lib/teacherlyft-assistant/device.json` and its checksum.
2. Pull the update and run the commands above.
3. Measure from `npm run start` until the Electron window appears.
4. Confirm the window is fullscreen and touchscreen input/keypad sizing work.
5. If a credential exists, confirm the connected screen loads without re-pairing.
6. For a fresh flow, disconnect locally or use an unpaired test device, generate a six-digit code in TeacherLyft Settings → Devices, and pair.
7. Close Electron and run `npm run start` again; confirm it remains connected.
8. Revoke the device in main TeacherLyft and retry/reopen; confirm the credential is deleted and pairing returns with a disconnection notice.
9. Pair again, disconnect networking, and retry/reopen; confirm the Offline screen appears and the credential checksum remains unchanged.
10. Restore networking and press Retry; confirm Connected returns.
11. Confirm the renderer never displays or logs the raw token.

## Retired architecture

The following are no longer part of the application:

- Next.js and `/api/local/*` routes
- the localhost health endpoint
- the Node/Next production web server
- external Chromium kiosk flags and watchdog
- the Next.js systemd service
- labwc/XDG kiosk autostart installation

Boot-time Electron autostart will be designed only after manual Pi performance, touchscreen, credential ownership, pairing, restart, revocation, and offline behavior are accepted.
