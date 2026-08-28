// Internal daemon bootstrap for the chatgpt-bridge JS client.
// Reads ~/.chatgpt-bridge/daemon.json, checks /health, and spawns the
// Python daemon (python -m chatgpt_bridge.daemon) if it is not running.
// No npm dependencies: Node >=18 native fetch + node:child_process/fs/os/path.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE_DIR = path.join(os.homedir(), ".chatgpt-bridge");
const DAEMON_JSON = path.join(STATE_DIR, "daemon.json");
const DAEMON_LOG = path.join(STATE_DIR, "daemon.log");
const DEFAULT_PORT = 8765;
const HEALTH_TIMEOUT_MS = 1500;
const STARTUP_TIMEOUT_MS = 30_000;
const STARTUP_POLL_MS = 250;

function readDaemonConfig() {
  try {
    const raw = fs.readFileSync(DAEMON_JSON, "utf8");
    const data = JSON.parse(raw);
    return {
      pid: Number(data.pid) || null,
      port: Number(data.port) || DEFAULT_PORT,
    };
  } catch {
    return { pid: null, port: DEFAULT_PORT };
  }
}

async function fetchHealth(port, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body && body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function spawnDaemon() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const log = fs.openSync(DAEMON_LOG, "a");
  const child = spawn("python", ["-m", "chatgpt_bridge.daemon"], {
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  fs.closeSync(log);
  return child;
}

async function waitForHealth(port, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fetchHealth(port, HEALTH_TIMEOUT_MS)) return true;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

/**
 * Ensure the daemon is running and healthy.
 * @returns {Promise<number>} the port the daemon is listening on.
 * @throws {Error} if the daemon cannot be reached after spawning.
 */
export async function ensureDaemon() {
  const { pid, port } = readDaemonConfig();

  // If a recorded pid is alive and /health responds, we are good.
  if (pid) {
    try {
      process.kill(pid, 0);
      if (await fetchHealth(port, HEALTH_TIMEOUT_MS)) return port;
    } catch {
      // pid not alive or health failed — fall through to spawn.
    }
  } else if (await fetchHealth(port, HEALTH_TIMEOUT_MS)) {
    // No config but something already answers on the default port.
    return port;
  }

  // Spawn the daemon and poll until it becomes healthy.
  spawnDaemon();
  if (await waitForHealth(port, STARTUP_TIMEOUT_MS, STARTUP_POLL_MS)) {
    return port;
  }

  throw new Error("daemon unreachable: failed to start within 30s");
}