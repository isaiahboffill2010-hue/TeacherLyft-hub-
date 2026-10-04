#!/usr/bin/env bash
set -euo pipefail

APP_USER="teacherlyft"
APP_GROUP="teacherlyft"
APP_DIR="/opt/teacherlyft-assistant"
STATE_DIR="/var/lib/teacherlyft-assistant"
ENV_FILE="/etc/teacherlyft-assistant.env"
SERVICE_FILE="/etc/systemd/system/teacherlyft-assistant.service"
MIN_NODE_MAJOR=22
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_USER="${TEACHERLYFT_DESKTOP_USER:-${SUDO_USER:-}}"

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
note() { printf '==> %s\n' "$*"; }

[[ "$(uname -s)" == "Linux" ]] || fail "This installer supports Linux only."
architecture="$(uname -m)"
[[ "$architecture" == "aarch64" || "$architecture" == "arm64" ]] \
  || fail "Expected Raspberry Pi OS arm64, found ${architecture}."
[[ "$EUID" -eq 0 ]] || fail "Run with sudo: sudo scripts/install-pi.sh"

command -v node >/dev/null 2>&1 || fail "Node.js 22 or newer is required."
node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$node_major" =~ ^[0-9]+$ ]] || fail "Unable to determine the Node.js version."
(( node_major >= MIN_NODE_MAJOR )) || fail "Node.js ${MIN_NODE_MAJOR}+ is required; found $(node --version)."
command -v npm >/dev/null 2>&1 || fail "npm is required."
command -v curl >/dev/null 2>&1 || fail "curl is required. Install it with: sudo apt install curl"

chromium_bin=""
for candidate in chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then chromium_bin="$candidate"; break; fi
done
[[ -n "$chromium_bin" ]] || fail "Chromium is required. Install it with: sudo apt install chromium"

[[ -n "$DESKTOP_USER" && "$DESKTOP_USER" != "root" ]] \
  || fail "Set TEACHERLYFT_DESKTOP_USER to the Raspberry Pi desktop-login user."
desktop_home="$(getent passwd "$DESKTOP_USER" | cut -d: -f6)"
[[ -n "$desktop_home" && -d "$desktop_home" ]] || fail "Desktop user ${DESKTOP_USER} does not have a valid home directory."
desktop_group="$(id -gn "$DESKTOP_USER")"

if ! id "$APP_USER" >/dev/null 2>&1; then
  note "Creating unprivileged service account ${APP_USER}"
  useradd --system --home-dir "$STATE_DIR" --shell /usr/sbin/nologin --user-group "$APP_USER"
fi

note "Creating application and persistent-state directories"
install -d -m 0755 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR"
install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$STATE_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$SOURCE_DIR/.env.local" ]] \
    || fail "Create ${SOURCE_DIR}/.env.local with TEACHERLYFT_API_URL before the first install."
  note "Installing initial environment configuration at ${ENV_FILE}"
  install -m 0600 -o root -g root "$SOURCE_DIR/.env.local" "$ENV_FILE"
else
  note "Preserving existing ${ENV_FILE}"
fi

note "Copying the committed application tree without touching ${STATE_DIR}"
git -C "$SOURCE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "Run this installer from a Git checkout."
git -C "$SOURCE_DIR" diff --quiet --ignore-submodules -- \
  || fail "Commit or stash tracked changes before installation; only committed files are deployed."
git -C "$SOURCE_DIR" archive --format=tar HEAD | tar -xf - -C "$APP_DIR"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
chmod 0755 "$APP_DIR/scripts/start-kiosk.sh"

note "Validating shell and systemd configuration"
bash -n "$APP_DIR/scripts/start-kiosk.sh"
bash -n "$APP_DIR/scripts/install-pi.sh"
systemd-analyze verify "$APP_DIR/deploy/teacherlyft-assistant.service"

note "Installing dependencies and creating the production build"
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" ci --no-audit --no-fund
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" run build
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" prune --omit=dev --no-audit --no-fund

note "Installing and enabling the system service"
install -m 0644 "$APP_DIR/deploy/teacherlyft-assistant.service" "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable teacherlyft-assistant.service

autostart_command="/opt/teacherlyft-assistant/scripts/start-kiosk.sh >>\"${desktop_home}/.local/state/teacherlyft-assistant/kiosk.log\" 2>&1 &"
if command -v labwc >/dev/null 2>&1; then
  note "Configuring Raspberry Pi OS labwc autostart for ${DESKTOP_USER}"
  autostart_dir="$desktop_home/.config/labwc"
  autostart_file="$autostart_dir/autostart"
  install -d -m 0755 -o "$DESKTOP_USER" -g "$desktop_group" "$autostart_dir"
  touch "$autostart_file"
  if ! grep -Fq '/opt/teacherlyft-assistant/scripts/start-kiosk.sh' "$autostart_file"; then
    printf '\n# TeacherLyft Assistant kiosk\n%s\n' "$autostart_command" >> "$autostart_file"
  fi
  chown "$DESKTOP_USER:$desktop_group" "$autostart_file"
else
  note "labwc not detected; installing a freedesktop XDG autostart entry"
  autostart_dir="$desktop_home/.config/autostart"
  install -d -m 0755 -o "$DESKTOP_USER" -g "$desktop_group" "$autostart_dir"
  install -m 0644 -o "$DESKTOP_USER" -g "$desktop_group" \
    "$APP_DIR/deploy/teacherlyft-kiosk.desktop" "$autostart_dir/teacherlyft-kiosk.desktop"
fi

install -d -m 0755 -o "$DESKTOP_USER" -g "$desktop_group" \
  "$desktop_home/.local/state/teacherlyft-assistant" \
  "$desktop_home/.config/teacherlyft-assistant"
rm -f "$desktop_home/.config/teacherlyft-assistant/disable-kiosk"

note "Starting TeacherLyft Assistant"
systemctl restart teacherlyft-assistant.service
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 \
      http://127.0.0.1:3000/api/local/health >/dev/null; then
    systemctl --no-pager --full status teacherlyft-assistant.service || true
    note "Installation complete. Reboot to test the complete appliance startup flow."
    exit 0
  fi
  sleep 1
done
systemctl --no-pager --full status teacherlyft-assistant.service || true
journalctl -u teacherlyft-assistant.service -n 30 --no-pager || true
fail "The service did not pass its local health check within 30 seconds."
