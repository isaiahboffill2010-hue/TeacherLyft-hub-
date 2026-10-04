#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_SCRIPT="$ROOT_DIR/scripts/start-pi-x11-client.sh"

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Linux" ]] || fail "This launcher is for Raspberry Pi Linux only."
[[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]] \
  || fail "This launcher requires Raspberry Pi OS 64-bit ARM64."
[[ -t 0 ]] || fail "Run this launcher interactively from a local text TTY."
command -v startx >/dev/null 2>&1 \
  || fail "startx is missing. Install it with: sudo apt install xserver-xorg xinit"
[[ -f "$ROOT_DIR/out/main/index.js" ]] \
  || fail "The Electron build is missing. Run: npm run build"
[[ ! -e /tmp/.X0-lock ]] \
  || fail "X display :0 is already active. Stop the display manager before this isolated test."

export DISPLAY=:0
printf 'Starting isolated X11 session on %s\n' "$DISPLAY"
exec startx "$CLIENT_SCRIPT" -- :0 -nolisten tcp
