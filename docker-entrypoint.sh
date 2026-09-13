#!/usr/bin/env bash
set -e

PORT="${PORT:-8465}"
SCREEN_WIDTH="${SCREEN_WIDTH:-1280}"
SCREEN_HEIGHT="${SCREEN_HEIGHT:-720}"
DATA_DIR="${CHATGPT_BRIDGE_STATE:-/data}"

mkdir -p "${DATA_DIR}/images" "${DATA_DIR}/profile"

echo "=============================================="
echo " Starting ChatGPT Bridge Container"
echo " Port: ${PORT}"
echo " Display: ${SCREEN_WIDTH}x${SCREEN_HEIGHT} (720p 16:9)"
echo " Data Directory: ${DATA_DIR}"
echo "=============================================="

# Start Xvfb virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -nolisten tcp &
XVFB_PID=$!

cleanup() {
    echo "Shutting down gracefully..."
    kill $APP_PID 2>/dev/null || true
    kill $XVFB_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Check if cookies exist
if [ -f "${DATA_DIR}/cookies.json" ] || [ -f "${DATA_DIR}/cookies.txt" ]; then
    echo "Found cookie file in ${DATA_DIR}. Session ready."
else
    echo "NOTICE: No cookies.json or cookies.txt found in ${DATA_DIR}."
    echo "Mount or copy your ChatGPT cookies into ${DATA_DIR}/cookies.json to authenticate."
fi

# Determine service to run
if [ "$MODE" = "api" ] || [ "$MODE" = "daemon" ]; then
    echo "Starting Universal REST API on port ${PORT}..."
    python -m chatgpt_bridge.daemon &
    APP_PID=$!
elif [ "$MODE" = "bot" ]; then
    echo "Starting Telegram Bot..."
    python -m chatgpt_bridge.bot &
    APP_PID=$!
elif [ -n "${TELEGRAM_BOT_TOKEN}" ]; then
    echo "TELEGRAM_BOT_TOKEN detected. Starting Telegram Bot..."
    python -m chatgpt_bridge.bot &
    APP_PID=$!
else
    echo "Starting Universal REST API on port ${PORT}..."
    python -m chatgpt_bridge.daemon &
    APP_PID=$!
fi

wait $APP_PID
