#!/usr/bin/env bash
set -euo pipefail

APP_URL="${TEACHERLYFT_LOCAL_URL:-http://127.0.0.1:3000}"

for candidate in chromium-browser chromium; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [[ -z "${CHROMIUM_BIN:-}" ]]; then
  echo "Chromium was not found. Install it with: sudo apt install chromium" >&2
  exit 1
fi

echo "Waiting for TeacherLyft Assistant at ${APP_URL}..."
for _ in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 2 "$APP_URL" >/dev/null; then
    exec "$CHROMIUM_BIN" \
      --kiosk \
      --no-first-run \
      --disable-session-crashed-bubble \
      --disable-infobars \
      --overscroll-history-navigation=0 \
      --check-for-update-interval=31536000 \
      "$APP_URL"
  fi
  sleep 1
done

echo "TeacherLyft Assistant did not become ready within 60 seconds." >&2
exit 1
