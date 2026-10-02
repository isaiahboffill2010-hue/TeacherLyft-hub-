# TeacherLyft Assistant

Touchscreen-first Raspberry Pi application for securely pairing a physical TeacherLyft Assistant with an existing TeacherLyft Workspace teacher account.

Phase 1B includes pairing, server-side credential persistence, startup verification, revocation handling, offline handling, and a connected placeholder. It does not connect directly to Google, store student data, or implement classroom/AI features.

## Architecture

```text
Touchscreen React UI
  -> local Next.js /api/local/* routes
  -> server-side credential file on this Pi
  -> TeacherLyft device API
  -> teacher's existing Workspace installation
```

The browser never receives the device token. The only client-visible data is pairing state, device name, and teacher display name.

## Requirements

- Node.js 20.9 or newer (Node 22 LTS is recommended on Raspberry Pi OS 64-bit)
- npm
- Chromium and curl for kiosk mode
- Raspberry Pi OS 64-bit or Windows/macOS/Linux for development

All dependencies are JavaScript-only and install on ARM64 without a native application wrapper.

## Laptop development

```bash
git clone https://github.com/isaiahboffill2010-hue/TeacherLyft-hub-.git
cd TeacherLyft-hub-
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell, use:

```powershell
git clone https://github.com/isaiahboffill2010-hue/TeacherLyft-hub-.git
Set-Location TeacherLyft-hub-
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Configure `.env.local`:

```dotenv
TEACHERLYFT_API_URL=https://www.teacherslyft.com
```

For both apps on one development computer, the main TeacherLyft app and this Assistant cannot both use port 3000. Run the main app on 3000 and this app on 3001:

```bash
npm run dev -- --port 3001
```

Then open `http://localhost:3001` while keeping `TEACHERLYFT_API_URL=http://localhost:3000`.

### Pi talking to a laptop

`localhost` on the Pi means the Pi, not the laptop. Use the laptop's LAN address:

```dotenv
TEACHERLYFT_API_URL=http://192.168.x.x:3000
```

Start the main TeacherLyft app so it listens on the LAN:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Allow the port through the laptop firewall only on the trusted local network. Both devices must be on the same network.

## Credential storage

On Linux/Raspberry Pi, the default path is:

```text
/var/lib/teacherlyft-assistant/device.json
```

The directory is mode `0700`; the file is mode `0600`. Writes use a private temporary file followed by an atomic rename. The JSON contains only `deviceId` and `deviceToken`.

On Windows/macOS development, the fallback is `.teacherlyft-state/device.json` inside the repository and is Git-ignored. Override either location with the server-only `TEACHERLYFT_CREDENTIAL_PATH` environment variable. Never use a `NEXT_PUBLIC_` variable for credentials.

## Commands

```bash
npm test
npm run type-check
npm run lint
npm run build
npm run start
```

## Raspberry Pi installation

```bash
git clone https://github.com/isaiahboffill2010-hue/TeacherLyft-hub-.git
cd TeacherLyft-hub-
npm install
cp .env.example .env.local
nano .env.local
npm test
npm run build
npm run start
```

Set `TEACHERLYFT_API_URL` to the deployed HTTPS TeacherLyft origin, or to the laptop LAN URL for temporary local testing.

### Production service

The example service uses a dedicated account and `/opt/teacherlyft-assistant`:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin teacherlyft
sudo mkdir -p /opt/teacherlyft-assistant /var/lib/teacherlyft-assistant
sudo chown -R teacherlyft:teacherlyft /opt/teacherlyft-assistant /var/lib/teacherlyft-assistant
sudo chmod 700 /var/lib/teacherlyft-assistant
sudo cp -a . /opt/teacherlyft-assistant/
sudo chown -R teacherlyft:teacherlyft /opt/teacherlyft-assistant
sudo cp deploy/teacherlyft-assistant.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now teacherlyft-assistant
sudo systemctl status teacherlyft-assistant
```

The service binds only to `127.0.0.1:3000`, restarts after failures, and can write only to the credential state directory under its systemd filesystem restrictions.

### Chromium kiosk mode

Install Chromium and curl:

```bash
sudo apt update
sudo apt install chromium curl
chmod +x scripts/start-kiosk.sh
```

Run `scripts/start-kiosk.sh` from the graphical Raspberry Pi session. It detects both common binary names (`chromium` and `chromium-browser`), waits up to 60 seconds for the local server, and launches `http://127.0.0.1:3000` with kiosk/session-recovery suppression flags.

To autostart after desktop login, add this line to the Pi user's desktop autostart configuration:

```text
@/opt/teacherlyft-assistant/scripts/start-kiosk.sh
```

The exact autostart file varies by Raspberry Pi OS desktop release. Common locations are `~/.config/lxsession/LXDE-pi/autostart` and `~/.config/autostart/`; confirm the active desktop before editing it. The server systemd unit and graphical kiosk launcher are intentionally separate.

## Updating the Pi

If the repository is cloned directly at `/opt/teacherlyft-assistant`:

```bash
cd /opt/teacherlyft-assistant
sudo -u teacherlyft git pull --ff-only
sudo -u teacherlyft npm install
sudo -u teacherlyft npm test
sudo -u teacherlyft npm run build
sudo systemctl restart teacherlyft-assistant
```

## Manual end-to-end test

1. Start the main TeacherLyft Workspace app.
2. Start this Assistant app on a different port or device.
3. In TeacherLyft, sign in and open **Settings → Devices → Connect New Device**.
4. Enter the six-digit code on the Assistant touchscreen keypad.
5. Confirm the Assistant displays the teacher and device names.
6. Stop and restart the Assistant server. Refresh the kiosk; it should remain connected.
7. Temporarily disconnect networking and press Retry. It should show Offline and retain the credential.
8. Restore networking and press Retry. It should return to Connected.
9. Disconnect the device from TeacherLyft Settings.
10. Press Retry or reload the Assistant. A backend `401` removes the local credential and returns to pairing with a disconnection notice.
11. Confirm the old token no longer exists in the local state file.

## Security notes

- Pairing codes are held only in React state for the duration of the request and are not logged or persisted.
- Device credentials never enter browser JavaScript, cookies, Web Storage, source code, or environment variables.
- Only an explicit `401` deletes an established credential. Network, DNS, timeout, and backend availability failures preserve it.
- Local APIs should be exposed only on loopback in production. Anyone with local machine access can operate the kiosk UI.
- Filesystem permissions protect credentials from other non-root users; root and physical-disk access remain trusted boundaries.
