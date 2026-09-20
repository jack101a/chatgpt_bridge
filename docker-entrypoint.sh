#!/usr/bin/env bash
# docker-entrypoint.sh — ChatGPT Bridge production container startup
# Run as a child of tini -g (PID 1) so zombie Chromium renderers are reaped
# and SIGTERM is broadcast to the whole process group on graceful shutdown.
set -e

PORT="${PORT:-8465}"
SCREEN_WIDTH="${SCREEN_WIDTH:-1280}"
SCREEN_HEIGHT="${SCREEN_HEIGHT:-720}"
DATA_DIR="${CHATGPT_BRIDGE_STATE:-/data}"

# Create required subdirectories
mkdir -p "${DATA_DIR}/images" "${DATA_DIR}/profile" "${DATA_DIR}/uploads"

echo "=================================================="
echo " ChatGPT Bridge Production Container"
echo " Port          : ${PORT}"
echo " Display       : ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24 (Xvfb)"
echo " State Dir     : ${DATA_DIR}"
echo " Mode          : ${MODE:-api}"
echo "=================================================="

# ---------------------------------------------------------------------------
# 1. Clean stale lockfiles from unclean previous shutdowns
# ---------------------------------------------------------------------------
# Stale X11 locks prevent Xvfb from starting ("Server is already active for :99")
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

# Stale Chromium Singleton locks prevent browser from opening the profile
# ("The profile appears to be in use by another Chrome process")
rm -f "${DATA_DIR}/profile/SingletonLock" \
      "${DATA_DIR}/profile/SingletonCookie" \
      "${DATA_DIR}/profile/SingletonSocket"

# ---------------------------------------------------------------------------
# 2. Start Xvfb Virtual Framebuffer Display
# ---------------------------------------------------------------------------
export DISPLAY=:99
Xvfb :99 -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -nolisten tcp &
XVFB_PID=$!

# Wait up to 5s for Xvfb socket to appear (up to 20 × 250ms)
XVFB_READY=0
for i in $(seq 1 20); do
    if [ -S /tmp/.X11-unix/X99 ]; then
        XVFB_READY=1
        echo "[Xvfb] Display :99 is ready."
        break
    fi
    sleep 0.25
done

if [ "$XVFB_READY" -ne 1 ]; then
    echo "[ERROR] Xvfb failed to start within 5 seconds. Aborting."
    exit 1
fi

# ---------------------------------------------------------------------------
# 3. Graceful signal handler — tini -g sends SIGTERM to the whole process
#    group, but we trap it here for clean ordered teardown + lock cleanup.
# ---------------------------------------------------------------------------
cleanup() {
    echo ""
    echo "[SHUTDOWN] SIGTERM received. Initiating graceful shutdown..."
    if [ -n "$APP_PID" ]; then
        kill -TERM "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    if [ -n "$XVFB_PID" ]; then
        kill -TERM "$XVFB_PID" 2>/dev/null || true
        wait "$XVFB_PID" 2>/dev/null || true
    fi
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
    echo "[SHUTDOWN] Clean exit complete."
    exit 0
}
trap cleanup SIGTERM SIGINT

# ---------------------------------------------------------------------------
# 4. Cookie / authentication notice
# ---------------------------------------------------------------------------
if [ -f "${DATA_DIR}/cookies.json" ] || [ -f "${DATA_DIR}/cookies.txt" ]; then
    echo "[AUTH] Cookie session file found in ${DATA_DIR}."
else
    echo "[NOTICE] No cookies.json or cookies.txt found in ${DATA_DIR}."
    echo "         POST cookies to /accounts or mount them before use."
fi

# ---------------------------------------------------------------------------
# 5. Launch service
# ---------------------------------------------------------------------------
if [ "$MODE" = "bot" ]; then
    echo "[START] Launching Telegram Bot..."
    python -m chatgpt_bridge.bot &
    APP_PID=$!
elif [ -n "${TELEGRAM_BOT_TOKEN}" ] && [ "$MODE" != "api" ] && [ "$MODE" != "daemon" ]; then
    echo "[START] TELEGRAM_BOT_TOKEN detected. Launching Telegram Bot..."
    python -m chatgpt_bridge.bot &
    APP_PID=$!
else
    echo "[START] Launching Universal REST API & Dashboard on port ${PORT}..."
    python -m chatgpt_bridge.daemon &
    APP_PID=$!
fi

# Block until the application process exits
wait $APP_PID
