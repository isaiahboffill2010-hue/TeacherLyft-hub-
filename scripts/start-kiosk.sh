#!/usr/bin/env bash
set -euo pipefail

APP_URL="${TEACHERLYFT_LOCAL_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${APP_URL%/}/api/local/health"
RETRY_SECONDS="${TEACHERLYFT_KIOSK_RETRY_SECONDS:-5}"
STATE_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}"
CONTROL_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/teacherlyft-assistant"
DISABLE_FILE="${CONTROL_DIR}/disable-kiosk"
PROFILE_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/teacherlyft-chromium"

mkdir -p "$STATE_HOME/teacherlyft-assistant" "$CONTROL_DIR" "$PROFILE_DIR"

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
}

for candidate in chromium-browser chromium; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [[ -z "${CHROMIUM_BIN:-}" ]]; then
  log "Chromium was not found. Install it with: sudo apt install chromium" >&2
  exit 1
fi

while [[ ! -e "$DISABLE_FILE" ]]; do
  log "Waiting for TeacherLyft Assistant health check at ${HEALTH_URL}"
  until curl --fail --silent --show-error --max-time 2 "$HEALTH_URL" >/dev/null; do
    if [[ -e "$DISABLE_FILE" ]]; then
      log "Kiosk disabled by ${DISABLE_FILE}"
      exit 0
    fi
    sleep "$RETRY_SECONDS"
  done

  log "Assistant is ready; launching Chromium kiosk"
  set +e
  "$CHROMIUM_BIN" \
    --kiosk \
    --start-maximized \
    --no-first-run \
    --no-default-browser-check \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-translate \
    --disable-save-password-bubble \
    --disable-features=Translate,PasswordManagerOnboarding,MediaRouter \
    --overscroll-history-navigation=0 \
    --ozone-platform-hint=auto \
    --user-data-dir="$PROFILE_DIR" \
    "$APP_URL"
  chromium_status=$?
  set -e

  if [[ -e "$DISABLE_FILE" ]]; then
    log "Chromium exited and kiosk is administratively disabled"
    exit 0
  fi
  log "Chromium exited with status ${chromium_status}; relaunching in ${RETRY_SECONDS}s"
  sleep "$RETRY_SECONDS"
done

log "Kiosk disabled by ${DISABLE_FILE}"
