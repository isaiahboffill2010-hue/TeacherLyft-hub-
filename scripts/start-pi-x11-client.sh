#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export XDG_SESSION_TYPE=x11
unset WAYLAND_DISPLAY
export TEACHERLYFT_PI_COMPATIBILITY="${TEACHERLYFT_PI_COMPATIBILITY:-1}"

printf 'Launching TeacherLyft Electron in X11 compatibility mode (renderer sandbox=%s)\n' \
  "$([[ "$TEACHERLYFT_PI_COMPATIBILITY" == "1" ]] && printf disabled || printf enabled)"
exec npm run start
