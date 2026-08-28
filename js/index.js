// chatgpt-bridge JS client.
// Talks to the local Python daemon (FastAPI) on 127.0.0.1:8765.
// No npm dependencies: Node >=18 native fetch.

import { ensureDaemon } from "./daemon.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:8765";

function buildError(res, body) {
  const type = body?.error?.type || "unknown";
  const message = body?.error?.message || `request failed with status ${res.status}`;
  const err = new Error(message);
  err.type = type;
  err.status = res.status;
  return err;
}

export class ChatGPT {
  constructor({ baseUrl = DEFAULT_BASE_URL } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async #request(path, payload) {
    await ensureDaemon();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      throw buildError(res, body);
    }
    return body;
  }

  /**
   * Ask ChatGPT a question.
   * @param {string} prompt
   * @param {{model?: string, conversationId?: string}} [opts]
   * @returns {Promise<{text: string, conversationId: string}>}
   */
  async ask(prompt, opts = {}) {
    const payload = { prompt };
    if (opts.model) payload.model = opts.model;
    if (opts.conversationId) payload.conversation_id = opts.conversationId;
    const body = await this.#request("/ask", payload);
    return {
      text: body?.text ?? "",
      conversationId: body?.conversation_id ?? null,
    };
  }

  /**
   * Generate an image.
   * @param {string} prompt
   * @param {{timeoutS?: number}} [opts]
   * @returns {Promise<{path: string, prompt: string}>}
   */
  async generateImage(prompt, opts = {}) {
    const payload = { prompt };
    if (opts.timeoutS) payload.timeout_s = opts.timeoutS;
    const body = await this.#request("/image", payload);
    return {
      path: body?.path ?? "",
      prompt: body?.prompt ?? prompt,
    };
  }
}