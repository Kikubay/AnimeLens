#!/bin/sh
# Brings up a virtual display, a VNC server and the web client in front of it, then hands the
# display to Electron. The desktop build is the same program a local install runs; only the
# screen it draws on is virtual, so nothing here reaches AnimeLens' internals.
set -eu

SCREEN_SIZE="${SCREEN_SIZE:-1280x900x24}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
NOVNC_ROOT="${NOVNC_ROOT:-/usr/share/novnc}"
ANIMELENS_CONFIG_DIR="${ANIMELENS_CONFIG_DIR:-/config}"
ELECTRON_BIN="${ELECTRON_BIN:?ELECTRON_BIN must point at the Electron binary}"
APP_DIR="${APP_DIR:?APP_DIR must point at the unpacked desktop app}"

DISPLAY="${DISPLAY:-:${DISPLAY_NUMBER:-99}}"
export DISPLAY

password_file="$(mktemp)"
generated_password=''

if [ -n "${VNC_PASSWORD:-}" ]; then
    printf '%s' "$VNC_PASSWORD" >"$password_file"
else
    # Classic VNC auth only carries eight characters, so generating more would mislead whoever reads the log.
    generated_password="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-8)"
    printf '%s' "$generated_password" >"$password_file"
fi

shutdown() {
    trap - TERM INT EXIT
    kill "${XVFB_PID:-}" "${VNC_PID:-}" "${NOVNC_PID:-}" "${ELECTRON_PID:-}" 2>/dev/null || true
    rm -f "$password_file"
}
trap shutdown TERM INT EXIT

echo "Starting virtual display ${DISPLAY} at ${SCREEN_SIZE}."
Xvfb "$DISPLAY" -screen 0 "$SCREEN_SIZE" -nolisten tcp &
XVFB_PID=$!

display_waited=0
until [ -e "/tmp/.X11-unix/X${DISPLAY_NUMBER}" ]; do
    if ! kill -0 "$XVFB_PID" 2>/dev/null; then
        echo "The virtual display server exited during startup." >&2
        exit 1
    fi
    display_waited=$((display_waited + 1))
    if [ "$display_waited" -gt 100 ]; then
        echo "Timed out waiting for the virtual display." >&2
        exit 1
    fi
    sleep 0.1
done

# Loopback only: the published noVNC port is the only way in, so x11vnc never needs its own wider bind.
x11vnc -display "$DISPLAY" -rfbport "$VNC_PORT" -forever -shared -localhost -passwdfile "$password_file" &
VNC_PID=$!

websockify --web="$NOVNC_ROOT" "$NOVNC_PORT" "127.0.0.1:${VNC_PORT}" &
NOVNC_PID=$!

if [ -n "$generated_password" ]; then
    echo "VNC_PASSWORD was unset, so a one-time password was generated: $generated_password"
    echo "Set VNC_PASSWORD in your compose file to choose your own."
else
    echo "VNC password accepted."
fi
echo "Open http://localhost:${NOVNC_PORT}/vnc.html to reach AnimeLens."

set -- --user-data-dir="$ANIMELENS_CONFIG_DIR" --disable-gpu --disable-dev-shm-usage
# The Chromium sandbox needs privileges a default container denies, so it is off unless the operator grants them.
if [ "${ANIMELENS_CHROMIUM_SANDBOX:-false}" != 'true' ]; then
    set -- "$@" --no-sandbox
fi

"$ELECTRON_BIN" "$@" "$APP_DIR" &
ELECTRON_PID=$!

wait "$ELECTRON_PID"