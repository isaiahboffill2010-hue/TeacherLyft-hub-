# TeacherLyft Assistant

Touchscreen-first Raspberry Pi application for securely pairing a physical TeacherLyft Assistant with an existing TeacherLyft Workspace teacher account.

Phase 1 includes pairing, server-side credential persistence, startup verification, revocation handling, and offline handling. Phase 2 adds production boot, health checking, Chromium kiosk startup, and crash recovery. It does not connect directly to Google, store student data, or implement classroom/AI features.

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

## Raspberry Pi development run

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

## One-time Raspberry Pi appliance installation

Use Raspberry Pi OS 64-bit with the desktop enabled, Node.js 22, Git, curl, and Chromium. Clone the repository as the normal desktop user, create `.env.local`, then run the installer. Do not place credentials in the repository.

```bash
sudo apt update
sudo apt install -y git curl chromium
git clone https://github.com/isaiahboffill2010-hue/TeacherLyft-hub-.git
cd TeacherLyft-hub-
cp .env.example .env.local
nano .env.local
sudo TEACHERLYFT_DESKTOP_USER="$(id -un)" bash scripts/install-pi.sh
```

The installer refuses non-Linux/non-ARM64 systems, Node versions below 22, missing Chromium, missing curl, and an unknown desktop user. It creates the unprivileged `teacherlyft` service account, copies only the committed Git tree to `/opt/teacherlyft-assistant`, builds as that account, and stores the environment in root-only `/etc/teacherlyft-assistant.env`. On later runs it preserves that environment file and never removes `/var/lib/teacherlyft-assistant/device.json`.

The systemd service:

- starts at boot after `network-online.target`;
- verifies that `.next/BUILD_ID` exists;
- runs `next start` in production on `127.0.0.1:3000` only;
- restarts after five seconds whenever the process exits;
- runs as the unprivileged `teacherlyft` account;
- gives the process write access only to `/var/lib/teacherlyft-assistant` and private temporary storage;
- applies systemd filesystem, privilege, kernel, and SUID hardening;
- sends output to the system journal without logging credentials.

## Chromium kiosk and graphical autostart

Raspberry Pi OS Bookworm and later use Wayland/labwc by default. The installer detects `labwc` and adds an idempotent launch line to:

```text
~/.config/labwc/autostart
```

If labwc is not installed, the installer uses the freedesktop-compatible `~/.config/autostart/teacherlyft-kiosk.desktop` fallback for an X11 desktop. Desktop auto-login must be enabled separately with `sudo raspi-config` under **System Options → Boot/Auto Login → Desktop Autologin**.

The kiosk waits indefinitely for `http://127.0.0.1:3000/api/local/health`. It then runs this equivalent Chromium command:

```bash
chromium --kiosk --start-maximized --no-first-run --no-default-browser-check \
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --disable-translate --disable-save-password-bubble \
  --disable-features=Translate,PasswordManagerOnboarding,MediaRouter \
  --overscroll-history-navigation=0 --ozone-platform-hint=auto \
  --user-data-dir="$HOME/.config/teacherlyft-chromium" \
  http://127.0.0.1:3000
```

Chromium's sandbox remains enabled. The launcher relaunches Chromium five seconds after any exit and returns to the health-wait loop if the server is unavailable. Kiosk output is appended to `~/.local/state/teacherlyft-assistant/kiosk.log`. Cursor hiding is intentionally not forced because common X11 cursor tools do not work reliably under Wayland and can interfere with touchscreen feedback.

## Health and diagnostics

The unauthenticated loopback health endpoint contains no device or account information:

```bash
curl --fail http://127.0.0.1:3000/api/local/health
# {"ok":true}
```

Useful server commands:

```bash
systemctl status teacherlyft-assistant
journalctl -u teacherlyft-assistant -f
tail -f ~/.local/state/teacherlyft-assistant/kiosk.log
```

## Admin escape

SSH is the preferred escape path and remains unaffected. From another computer:

```bash
ssh <desktop-user>@<pi-hostname>
touch ~/.config/teacherlyft-assistant/disable-kiosk
pkill -x chromium || pkill -x chromium-browser || true
```

The disable marker prevents the watchdog from reopening Chromium. To restore kiosk mode:

```bash
rm -f ~/.config/teacherlyft-assistant/disable-kiosk
sudo reboot
```

With a physical keyboard, `Ctrl+Alt+F2` opens a text console where the same commands can be run. There is intentionally no teacher-visible exit control.

## Updating the Pi

Pull in the original desktop-user checkout, review the update, and rerun the idempotent installer. The app deployment and credential state are separate, so the update never deletes `device.json`:

```bash
cd ~/TeacherLyft-hub-
git status --short
git pull --ff-only origin main
npm ci
npm test
npm run type-check
npm run build
sudo TEACHERLYFT_DESKTOP_USER="$(id -un)" bash scripts/install-pi.sh
```

If `.env.local` changes intentionally after the first installation, update the protected service environment explicitly, then restart:

```bash
sudo install -m 0600 -o root -g root .env.local /etc/teacherlyft-assistant.env
sudo systemctl restart teacherlyft-assistant
```

## Reboot acceptance test

1. Confirm `/var/lib/teacherlyft-assistant/device.json` exists and record only its checksum: `sudo sha256sum /var/lib/teacherlyft-assistant/device.json`.
2. Run `sudo reboot`.
3. Do not touch the Pi. Confirm the desktop loads and Chromium opens the Assistant in kiosk mode without browser controls or restore prompts.
4. Confirm the previously paired account is still connected.
5. SSH into the Pi and run `systemctl is-active teacherlyft-assistant` and the health `curl` command above.
6. Re-run the credential checksum and confirm it is unchanged.
7. Test server recovery with `sudo systemctl kill -s SIGKILL teacherlyft-assistant`; after at least five seconds, confirm the service and health endpoint recover.
8. Test kiosk recovery with `pkill -x chromium || pkill -x chromium-browser`; after at least five seconds, confirm Chromium reopens.
9. Review the server journal and kiosk log for unexpected errors and confirm neither contains a pairing code, token, or authorization header.

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
