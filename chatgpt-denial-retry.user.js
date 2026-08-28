// ==UserScript==
// @name         ChatGPT Image Denial Auto-Retry
// @namespace    local.test
// @version      0.8.0
// @description  Single-prompt tool: sends prompt to ChatGPT, detects image-policy denials, auto-retries same-chat (Try again / variant) up to N times with random gap + backoff, then falls back to fresh chat with last image as reference. Downloads resulting image. DOM mode only.
// @match        https://chatgpt.com/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // ============ CORE (pure, unit-testable) ============
    const CONFIG = {
        maxTries: 5,
        minGapSec: 5,
        maxGapSec: 10,
        backoff: [0, 5, 15, 30, 60],       // added on top of random gap per attempt index
        freshChatPhases: 2,                  // same-chat retry loop, then fresh chat + loop again
        genTimeoutMs: 240000,
        rephraseAfter: 3,                    // LLM rephrase the prompt after this many tries
        rephraseModel: 'glm-5.2',
        rephraseEndpoint: 'https://llm.002529.xyz/v1/chat/completions',
        rephraseApiKey: 'sk-JqMN5zYagqvjH-5YF7QE5Q',
        rephraseSystem: 'Rephrase this image-generation prompt keeping the same meaning but different wording. Output only the rephrased prompt, no preamble.',
        guardText: 'Do not change or expand this prompt. Send it exactly as written.',
        steerText: 'Generate an image of the above.'
    };

    const REFUSAL_RE = /usage polic|content polic|may violate|don'?t comply|can'?t help|policy forbids|not allowed to|safety|guardrails|unable to (generate|create)|we'?re so sorry/i;
    const RATE_RE = /rate.?limit|too many (requests|tries)|try again (later|in|soon|after)|((\d+)\s*(minute|minuto)s?)/i;
    // deterministic IP/copyright denials: resend NEVER slips through — stop immediately, don't waste attempts
    const DETERMINISTIC_RE = /similarity to third-?party|third-?party content|copyright|intellectual property|trademark/i;

    function backoffFor(tries) {
        let arr = CONFIG.backoff;
        try {
            const o = JSON.parse(localStorage.getItem('cdr_backoff') || 'null');
            if (Array.isArray(o) && o.length) arr = o;
        } catch (_) { /* default */ }
        return arr[Math.min(Math.max(tries - 1, 0), arr.length - 1)];
    }

    function randomGap(minSec, maxSec) {
        const lo = Math.min(minSec, maxSec);
        const hi = Math.max(minSec, maxSec);
        return lo + Math.random() * (hi - lo);
    }

    // blob <-> base64 for persisting the reference image across fresh-chat reloads
    function blobToBase64(blob) {
        return new Promise((resolve) => {
            if (typeof FileReader === 'undefined' || !blob) { resolve(''); return; }
            try {
                const r = new FileReader();
                r.onload = () => {
                    const s = String(r.result || '');
                    const i = s.indexOf(',');
                    resolve(i >= 0 ? s.slice(i + 1) : s);
                };
                r.onerror = () => resolve('');
                r.readAsDataURL(blob);
            } catch (_) { resolve(''); }
        });
    }

    function base64ToBlob(b64, type) {
        if (typeof atob === 'undefined' || typeof Blob === 'undefined' || !b64) return null;
        try {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: type || 'image/png' });
        } catch (_) { return null; }
    }

    function classifyDomText(text) {
        if (DETERMINISTIC_RE.test(text)) return { kind: 'deterministic', text: text.slice(0, 200) };
        if (REFUSAL_RE.test(text)) return { kind: 'denial', text: text.slice(0, 200) };
        if (RATE_RE.test(text)) return { kind: 'rate', text: text.slice(0, 200) };
        if (/Image generation failed|something went wrong|error/i.test(text)) return { kind: 'generic_fail', text: text.slice(0, 200) };
        return { kind: 'no_image', text: text.slice(0, 200) };
    }

    const core = {
        CONFIG, REFUSAL_RE, RATE_RE, DETERMINISTIC_RE,
        backoffFor, randomGap, classifyDomText, blobToBase64, base64ToBlob
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = core;
    // ============ END CORE ============

    if (typeof document === 'undefined') return; // node test mode: core only

    let stopFlag = false;
    let state = { running: false, tries: 0, phase: 1 };
    let resuming = false;
    let awaitingResume = false; // SPA New-chat nav: resume phase 2 via cdr_state poll (no page reload)

    function bootUI() {
    const style = document.createElement('style');
    style.textContent = `
        #cdr-panel {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 99999;
            width: min(360px, 92vw);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.5;
            color: #f5f5f7;
            background: rgba(28, 28, 30, 0.65);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 14px;
            padding: 11px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, background-color 0.3s ease, border-radius 0.3s ease, padding 0.3s ease, width 0.3s ease;
            box-sizing: border-box;
        }
        #cdr-panel * {
            box-sizing: border-box;
        }
        #cdr-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        #cdr-head b {
            font-weight: 600;
            font-size: 14px;
            letter-spacing: -0.01em;
            background: linear-gradient(135deg, #ffffff 30%, rgba(255, 255, 255, 0.7) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        #cdr-status {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.85);
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 2px 8px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.2s ease;
        }
        #cdr-prompt {
            width: 100%;
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 6px 8px;
            resize: vertical;
            outline: none;
            font-family: inherit;
            font-size: 13px;
            transition: all 0.2s ease;
            min-height: 50px;
        }
        #cdr-prompt:focus {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
        }
        #cdr-opts {
            margin-top: 8px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 6px;
        }
        #cdr-opts summary {
            cursor: pointer;
            user-select: none;
            font-weight: 500;
            outline: none;
            transition: color 0.2s ease;
        }
        #cdr-opts summary:hover {
            color: #ffffff;
        }
        #cdr-opts[open] summary {
            margin-bottom: 8px;
        }
        .cdr-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 6px 10px;
            align-items: center;
            background: rgba(0, 0, 0, 0.15);
            padding: 8px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .cdr-grid label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 500;
        }
        .cdr-grid input {
            width: 100%;
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 6px 10px;
            font-family: inherit;
            font-size: 12px;
            outline: none;
            transition: all 0.2s ease;
        }
        .cdr-grid input:focus {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
        }
        .cdr-grid select {
            width: 100%;
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 6px 10px;
            font-family: inherit;
            font-size: 12px;
            outline: none;
            transition: all 0.2s ease;
        }
        .cdr-grid select option {
            background: #1a1a1a;
            color: #ffffff;
        }
        .cdr-grid input[type="checkbox"] {
            width: auto;
            justify-self: start;
            accent-color: #4f8cff;
        }
        .cdr-controls-row {
            display: flex;
            gap: 6px;
            margin-top: 8px;
            align-items: center;
            flex-wrap: wrap;
        }
        .cdr-guard-label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.85);
            cursor: pointer;
            user-select: none;
            padding: 2px 0;
            white-space: nowrap;
        }
        .cdr-guard-label input[type="checkbox"] {
            appearance: none;
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            outline: none;
            background: rgba(255, 255, 255, 0.05);
            cursor: pointer;
            display: grid;
            place-content: center;
            transition: all 0.2s ease;
        }
        .cdr-guard-label input[type="checkbox"]::before {
            content: "";
            width: 8px;
            height: 8px;
            transform: scale(0);
            transition: 120ms transform ease-in-out;
            box-shadow: inset 1em 1em #ffffff;
            transform-origin: center;
            clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
        }
        .cdr-guard-label input[type="checkbox"]:checked {
            background: rgba(48, 209, 97, 0.85);
            border-color: rgba(48, 209, 97, 1);
        }
        .cdr-guard-label input[type="checkbox"]:checked::before {
            transform: scale(1);
        }
        .cdr-btn-spacer {
            flex: 1;
        }
        .cdr-opt-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1 1 100%;
        }
        .cdr-opt-group .cdr-text-inline {
            flex: 1;
            min-width: 0;
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            padding: 3px 6px;
            font-family: inherit;
            font-size: 11px;
            outline: none;
            transition: all 0.2s ease;
        }
        .cdr-opt-group .cdr-text-inline:focus {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
        }
        #cdr-start, #cdr-stop {
            border: 0;
            border-radius: 999px;
            padding: 5px 14px;
            cursor: pointer;
            font-weight: 600;
            font-size: 11.5px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            outline: none;
            user-select: none;
        }
        #cdr-start {
            background: rgba(48, 209, 97, 0.9);
            color: #ffffff;
        }
        #cdr-start:hover:not(:disabled) {
            background: rgba(48, 209, 97, 1);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(48, 209, 97, 0.3);
        }
        #cdr-start:active:not(:disabled) {
            transform: translateY(0);
        }
        #cdr-stop {
            background: rgba(255, 69, 58, 0.85);
            color: #ffffff;
        }
        #cdr-stop:hover:not(:disabled) {
            background: rgba(255, 69, 58, 1);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 69, 58, 0.3);
        }
        #cdr-stop:active:not(:disabled) {
            transform: translateY(0);
        }
        #cdr-start:disabled, #cdr-stop:disabled {
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.35);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        #cdr-log {
            margin-top: 4px;
            max-height: 140px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 8px 10px;
            color: #30d161;
            text-shadow: 0 0 2px rgba(48, 209, 97, 0.3);
            white-space: pre-wrap;
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
        }
        #cdr-log::-webkit-scrollbar, #cdr-panel::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        #cdr-log::-webkit-scrollbar-track, #cdr-panel::-webkit-scrollbar-track {
            background: transparent;
        }
        #cdr-log::-webkit-scrollbar-thumb, #cdr-panel::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
        }
        #cdr-log::-webkit-scrollbar-thumb:hover, #cdr-panel::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .cdr-toggle-btn {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s ease;
            outline: none;
        }
        .cdr-toggle-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }
        .cdr-chevron, .cdr-log-chevron {
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #cdr-panel.cdr-collapsed {
            width: auto;
            max-width: min(360px, 92vw);
            padding: 8px 12px;
            border-radius: 14px;
        }
        #cdr-panel.cdr-collapsed > *:not(#cdr-head) {
            display: none !important;
        }
        #cdr-panel.cdr-collapsed #cdr-head {
            margin-bottom: 0;
        }
        #cdr-panel.cdr-collapsed .cdr-chevron {
            transform: rotate(180deg);
        }
        .cdr-log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        #cdr-panel.cdr-log-collapsed #cdr-log {
            display: none !important;
        }
        #cdr-panel.cdr-log-collapsed .cdr-log-chevron {
            transform: rotate(180deg);
        }
        @media (max-width: 480px) {
            #cdr-panel {
                top: 8px;
                right: 8px;
                padding: 8px;
                border-radius: 12px;
            }
            #cdr-head b {
                font-size: 12px;
            }
            #cdr-status {
                font-size: 9px;
                padding: 1px 6px;
            }
            #cdr-prompt, .cdr-grid input, #cdr-start, #cdr-stop {
                font-size: 11.5px;
            }
            .cdr-grid label, #cdr-opts, .cdr-log-header, .cdr-guard-label {
                font-size: 10.5px;
            }
            #cdr-log {
                max-height: 100px;
                font-size: 10px;
                padding: 6px 8px;
            }
            #cdr-start, #cdr-stop {
                padding: 5px 12px;
            }
        }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'cdr-panel';
    panel.innerHTML = `
        <div id="cdr-head">
            <b>Denial Retry</b>
            <div style="display:flex;align-items:center;gap:8px">
                <span id="cdr-status">idle</span>
                <button id="cdr-toggle" class="cdr-toggle-btn" title="Toggle Panel">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="cdr-chevron"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
            </div>
        </div>
        <textarea id="cdr-prompt" rows="2" placeholder="Prompt for one image (retried on policy denial)"></textarea>
        <details id="cdr-opts">
            <summary>timing & retries</summary>
            <div class="cdr-grid">
                <label>tries</label><input type="number" id="cdr-tries" value="${CONFIG.maxTries}" min="1" max="20">
                <label>min gap (s)</label><input type="number" id="cdr-mingap" value="${CONFIG.minGapSec}" min="0" max="120">
                <label>max gap (s)</label><input type="number" id="cdr-maxgap" value="${CONFIG.maxGapSec}" min="0" max="300">
                <label>backoff (s)</label><input type="text" id="cdr-backoff" value="${CONFIG.backoff.join(',')}">
                <label>retry btn</label><input type="text" id="cdr-retrytext" value="try again|retry|regenerate">
                <label>rephrase</label><input type="checkbox" id="cdr-rephrase" checked>
                <label>model</label><select id="cdr-rephrasemodel">
                    <option value="glm-5.2" selected>glm-5.2</option>
                    <option value="gpt-oss-120b">gpt-oss-120b</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                </select>
                <label>after</label><input type="number" id="cdr-rephraseafter" value="${CONFIG.rephraseAfter}" min="1" max="10">
            </div>
        </details>
        <div class="cdr-controls-row">
            <div class="cdr-opt-group">
                <label class="cdr-guard-label"><input type="checkbox" id="cdr-guard" checked> verbatim guard</label>
                <input type="text" id="cdr-guardtext" class="cdr-text-inline" value="${CONFIG.guardText}" title="guard prefix text">
            </div>
            <div class="cdr-opt-group">
                <label class="cdr-guard-label"><input type="checkbox" id="cdr-steer" checked> steer to image gen</label>
                <input type="text" id="cdr-steertext" class="cdr-text-inline" value="${CONFIG.steerText}" title="steer suffix text">
            </div>
            <span class="cdr-btn-spacer"></span>
            <button id="cdr-start">Start</button>
            <button id="cdr-stop" disabled>Stop</button>
        </div>
        <div class="cdr-log-header">
            <span>Activity Log</span>
            <button id="cdr-logtoggle" class="cdr-toggle-btn" title="Toggle Log">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="cdr-log-chevron"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
        </div>
        <div id="cdr-log"></div>
    `;
    document.body.appendChild(panel);

    let isCollapsed = false;
    if (window.innerWidth <= 480) {
        isCollapsed = true;
    } else {
        try {
            const saved = localStorage.getItem('cdr_collapsed');
            if (saved !== null) {
                isCollapsed = JSON.parse(saved);
            }
        } catch (_) {}
    }
    if (isCollapsed) {
        panel.classList.add('cdr-collapsed');
    }

    let isLogCollapsed = false;
    try {
        const savedLog = localStorage.getItem('cdr_log_collapsed');
        if (savedLog !== null) {
            isLogCollapsed = JSON.parse(savedLog);
        }
    } catch (_) {}
    if (isLogCollapsed) {
        panel.classList.add('cdr-log-collapsed');
    }

    const $ = (id) => panel.querySelector(id);
    const statusEl = $('#cdr-status');
    const logEl = $('#cdr-log');

    // Draggable panel
    const head = $('#cdr-head');
    head.style.cursor = 'move';
    
    function clampPos(x, y, rect) {
        const maxX = Math.max(0, window.innerWidth - rect.width);
        const maxY = Math.max(0, window.innerHeight - rect.height);
        return {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY)
        };
    }

    if (window.innerWidth <= 480) {
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        localStorage.removeItem('cdr_pos');
    } else {
        try {
            const pos = JSON.parse(localStorage.getItem('cdr_pos'));
            if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                const rect = panel.getBoundingClientRect();
                const clamped = clampPos(pos.x, pos.y, rect);
                panel.style.left = 'auto';
                panel.style.right = 'auto';
                panel.style.top = clamped.y + 'px';
                panel.style.left = clamped.x + 'px';
            }
        } catch (_) {}
    }

    head.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, input, select, textarea')) return;
        e.preventDefault();
        
        const rect = panel.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        
        function onPointerMove(ev) {
            const rawX = ev.clientX - offsetX;
            const rawY = ev.clientY - offsetY;
            const curRect = panel.getBoundingClientRect();
            const clamped = clampPos(rawX, rawY, curRect);
            panel.style.left = 'auto';
            panel.style.right = 'auto';
            panel.style.top = clamped.y + 'px';
            panel.style.left = clamped.x + 'px';
        }
        
        function onPointerUp(ev) {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            
            const finalRect = panel.getBoundingClientRect();
            localStorage.setItem('cdr_pos', JSON.stringify({ x: finalRect.left, y: finalRect.top }));
        }
        
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    });

    $('#cdr-toggle').addEventListener('click', () => {
        const collapsed = panel.classList.toggle('cdr-collapsed');
        localStorage.setItem('cdr_collapsed', JSON.stringify(collapsed));
    });
    $('#cdr-logtoggle').addEventListener('click', () => {
        const logCollapsed = panel.classList.toggle('cdr-log-collapsed');
        localStorage.setItem('cdr_log_collapsed', JSON.stringify(logCollapsed));
    });
    // 2026 ChatGPT: generated imgs have alt^="Generated image" + estuary src (oaiusercontent legacy fallback)
    const IMG_SEL = 'img[alt^="Generated image"], img[src*="/backend-api/estuary/content"], img[src*="estuary/content"], img[src*="oaiusercontent"]';
    // compiled once per run() from #cdr-retrytext; shared so classifyDom() stays untouched
    let retryRe = /try again|retry|regenerate/i;

    function setStatus(t) { statusEl.textContent = t; }
    function log(msg) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logEl.textContent += line + '\n';
        logEl.scrollTop = logEl.scrollHeight;
    }

    function readConfig() {
        const maxTries = parseInt($('#cdr-tries').value, 10) || CONFIG.maxTries;
        const minGap = parseInt($('#cdr-mingap').value, 10);
        const maxGap = parseInt($('#cdr-maxgap').value, 10);
        let backoff = CONFIG.backoff;
        try {
            const o = $('#cdr-backoff').value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
            if (o.length) backoff = o;
        } catch (_) { /* default */ }
        localStorage.setItem('cdr_backoff', JSON.stringify(backoff));
        const guardText = $('#cdr-guardtext').value.trim() || CONFIG.guardText;
        const steerText = $('#cdr-steertext').value.trim() || CONFIG.steerText;
        const retryText = $('#cdr-retrytext').value.trim() || 'try again|retry|regenerate';
        let retryRe;
        try { retryRe = new RegExp(retryText, 'i'); } catch (_) { retryRe = /try again|retry|regenerate/i; }
        const rephrase = $('#cdr-rephrase').checked;
        const rephraseModel = $('#cdr-rephrasemodel').value || CONFIG.rephraseModel;
        const rephraseAfter = parseInt($('#cdr-rephraseafter').value, 10) || CONFIG.rephraseAfter;
        return { maxTries, minGap: isNaN(minGap) ? CONFIG.minGapSec : minGap, maxGap: isNaN(maxGap) ? CONFIG.maxGapSec : maxGap, backoff, guardText, steerText, retryText, retryRe, rephrase, rephraseModel, rephraseAfter };
    }

    function sleep(seconds) {
        return new Promise((resolve) => {
            const total = seconds * 1000;
            const start = Date.now();
            setStatus(`wait ${seconds.toFixed(1)}s`);
            (function tick() {
                if (stopFlag) return resolve();
                const left = Math.max(0, (total - (Date.now() - start)) / 1000);
                if (left <= 0) return resolve();
                setStatus(`wait ${left.toFixed(1)}s`);
                setTimeout(tick, Math.min(500, left * 1000));
            })();
        });
    }

    // ---- DOM interaction ----
    function findComposer() {
        let box = document.querySelector('#prompt-textarea');
        if (!box) box = document.querySelector('form textarea[contenteditable="true"], #composer-background textarea, textarea[contenteditable="true"]');
        if (!box) box = document.querySelector('textarea');
        return box;
    }

    function sendDom(prompt) {
        const box = findComposer();
        if (!box) return false;
        box.focus();
        document.execCommand('insertText', false, prompt);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
            const sendBtn = document.querySelector('button[data-testid="composer-submit-button"], button[data-testid="send-button"], button.composer-submit-button-color');
            if (sendBtn && !sendBtn.disabled) sendBtn.click();
            else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }, 80);
        return true;
    }

    function findTryAgainBtn() {
        return [...document.querySelectorAll('button')].find((b) => retryRe.test(b.textContent || ''));
    }

    // no-prefix denial fallback: no direct "Try again" button — the Switch model popover reveals one
    function findSwitchModelBtn() {
        const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
        const lastTurn = turns[turns.length - 1];
        const btn = lastTurn && lastTurn.querySelector('button[aria-label="Switch model"]');
        return btn || document.querySelector('button[aria-label="Switch model"]');
    }

    // Radix UI popover triggers open on pointerdown, not synthetic .click() — dispatch trusted
    // pointer/mouse events to simulate a real user interaction
    function trustedClick(el) {
        const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
        el.dispatchEvent(new PointerEvent('pointerdown', opts));
        el.dispatchEvent(new PointerEvent('pointerup', opts));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    }

    function openNewChat() {
        // click "New chat" in sidebar, else navigate to root with cache-bust
        const newChatBtn = document.querySelector('a[href="/"]') || [...document.querySelectorAll('button,a')].find((e) => /new chat/i.test(e.textContent || ''));
        if (newChatBtn) { newChatBtn.click(); return 'navigating'; } // New chat reloads the page on 2026 ChatGPT
        location.href = 'https://chatgpt.com/?cdr=' + Date.now();
        return 'navigating';
    }

    async function grabLastImageBlob() {
        // prefer alt^="Generated image" (most reliable), fall back to src-based scan
        const img = [...document.querySelectorAll('img[alt^="Generated image"]')].pop() || [...document.querySelectorAll(IMG_SEL)].pop();
        if (!img || !img.src) return null;
        try {
            const res = await fetch(img.src);
            if (!res.ok) return null;
            const blob = await res.blob();
            return blob.size ? blob : null;
        } catch (_) { return null; }
    }

    async function uploadReference(blob) {
        // find composer file input, set files via DataTransfer
        const inputs = [...document.querySelectorAll('input[type="file"]')];
        // prefer the real 2026 upload input; else one inside composer region; else first
        const fi = document.querySelector('input#upload-photos, input[data-testid="upload-photos-input"]') || inputs.find((i) => i.closest('#composer-background, form')) || inputs[0];
        if (!fi) return false;
        try {
            const file = new File([blob], 'reference.png', { type: blob.type || 'image/png' });
            const dt = new DataTransfer();
            dt.items.add(file);
            fi.files = dt.files;
            fi.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch (_) { return false; }
    }

    // LLM rephrase via litellm (GM_xmlhttpRequest — userscript context only; falls back to original text)
    function rephrasePrompt(text, model) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest === 'undefined') { resolve(text); return; }
            try {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: CONFIG.rephraseEndpoint,
                    headers: {
                        'Authorization': 'Bearer ' + CONFIG.rephraseApiKey,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        model: model || CONFIG.rephraseModel,
                        messages: [
                            { role: 'system', content: CONFIG.rephraseSystem },
                            { role: 'user', content: text }
                        ],
                        temperature: 0.7,
                        max_tokens: 300
                    }),
                    timeout: 15000,
                    onload: (res) => {
                        try {
                            const body = JSON.parse(res.response);
                            const content = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
                            resolve(typeof content === 'string' && content.trim() ? content.trim() : text);
                        } catch (_) { resolve(text); }
                    },
                    onerror: () => resolve(text),
                    ontimeout: () => resolve(text)
                });
            } catch (_) { resolve(text); }
        });
    }

    async function waitAssistantMessage() {
        const start = Date.now();
        while (!stopFlag && Date.now() - start < CONFIG.genTimeoutMs) {
            const arts = document.querySelectorAll('[data-testid^="conversation-turn-"]');
            const last = arts[arts.length - 1];
            if (last && !document.querySelector('[data-testid="stop-button"]')) {
                let settled = 0;
                let prevLen = last.textContent.length;
                let switchModelClicked = false; // click Switch model at most once per call
                while (!stopFlag && settled < 10) {
                    await new Promise((r) => setTimeout(r, 500));
                    if (last.querySelector(IMG_SEL)) return last;
                    // "Try again" lives in a transient dialog that auto-dismisses within seconds —
                    // click it the MOMENT it renders, before the settle loop can outlast it
                    const retryBtn = findTryAgainBtn();
                    if (retryBtn) {
                        retryBtn.click();
                        return { __retryClicked: true };
                    }
                    // no-prefix denial fallback: no direct "Try again" button — open the Switch model
                    // popover (Radix trigger opens on pointerdown, so use trusted pointer events).
                    // Never for deterministic (IP/copyright) denials.
                    if (!switchModelClicked && classifyDomText(last.textContent).kind === 'denial') {
                        const sm = findSwitchModelBtn();
                        if (sm) {
                            // the Switch model button is covered by an overlay (message content div or the
                            // "Content Guardrails Violation" dialog) — dismiss it with Escape first, then
                            // open the popover via trusted pointer events
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true, cancelable: true }));
                            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true, cancelable: true }));
                            await new Promise((r) => setTimeout(r, 150)); // let overlay dismiss
                            trustedClick(sm);
                            switchModelClicked = true;
                            // poll fast (100ms, up to 2s): the popover's "Try again" appears ~500ms
                            // after the click and the popover may dismiss quickly
                            const fastStart = Date.now();
                            while (!stopFlag && Date.now() - fastStart < 2000) {
                                await new Promise((r) => setTimeout(r, 100));
                                if (last.querySelector(IMG_SEL)) return last;
                                const fastBtn = findTryAgainBtn();
                                if (fastBtn) {
                                    fastBtn.click();
                                    return { __retryClicked: true };
                                }
                            }
                            // popover never rendered "Try again" — fall through to settle/resend fallback
                        }
                    }
                    // image generation in progress: skeleton present, little/no text — do NOT settle-exit,
                    // keep polling until the img appears (1-2s after skeleton clears)
                    if (document.querySelector('[data-testid="image-gen-loading-state"]')) {
                        settled = 0;
                        prevLen = last.textContent.length;
                        continue;
                    }
                    const len = last.textContent.length;
                    if (len === prevLen) settled++;
                    else { settled = 0; prevLen = len; }
                }
                return last;
            }
            await new Promise((r) => setTimeout(r, 500));
        }
        return document.body;
    }

    function classifyDom(lastMsg) {
        const text = (lastMsg && lastMsg.textContent) || document.body.innerText || '';
        // success = image in the LAST assistant message only (document-wide img would false-positive
        // when a previously-generated image lingers in DOM for fresh-chat reference capture)
        const img = lastMsg && lastMsg.querySelector(IMG_SEL);
        if (img) return { kind: 'success', src: img.src };
        const btn = findTryAgainBtn();
        const c = classifyDomText(text);
        c.tryAgain = !!btn;
        c.btn = btn || null;
        return c;
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    async function downloadByUrl(url, name) {
        try {
            if (typeof GM_download === 'function') { GM_download(url, name); return true; }
        } catch (_) { /* fallthrough */ }
        try {
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) { downloadBlob(await res.blob(), name); return true; }
        } catch (_) { /* fallthrough */ }
        window.open(url, '_blank');
        return false;
    }

    // ---- main flow ----
    // Phase 1: same-chat variant retries (click Try again) up to maxTries with random gap + backoff
    // Phase 2: fresh chat + (optional) reference image, then phase 1 again
    async function run(rawPrompt, cfg, guardOn, steerOn) {
        let phase = state.phase || 1; // resumed runs start at the saved phase
        let lastBlob = state.lastBlobB64 ? base64ToBlob(state.lastBlobB64, state.lastBlobType) : null;
        let currentPrompt = rawPrompt; // may be rephrased by the LLM after rephraseAfter tries
        retryRe = cfg.retryRe; // compiled once per run
        // guard prefix + steer suffix re-applied on every send (never cache the assembled prompt)
        const assemble = (p) => (guardOn ? cfg.guardText + '\n\n' : '') + p + (steerOn ? '\n\n' + cfg.steerText : '');
        while (!stopFlag && phase <= CONFIG.freshChatPhases) {
            state.phase = phase;
            let rephrasedThisPhase = false; // rephrase at most once per phase
            // resumed phase 2: attach the persisted reference image before sending
            if (phase > 1 && lastBlob && !state.referenceUploaded) {
                let ready = 0;
                while (!stopFlag && !findComposer() && ready < 20) { await new Promise((r) => setTimeout(r, 500)); ready++; }
                const up = await uploadReference(lastBlob);
                log(up ? 'reference image attached' : 'reference upload failed — continuing without');
                state.referenceUploaded = true;
            }
            let tries = 0;
            let needResend = false; // true when previous attempt was a denial with no retry button
            while (!stopFlag && tries < cfg.maxTries) {
                tries++;
                state.tries = tries;
                log(`phase ${phase} attempt ${tries}/${cfg.maxTries}`);
                // LLM rephrase: once per phase, once the same prompt has failed rephraseAfter tries
                if (cfg.rephrase && !rephrasedThisPhase && tries >= cfg.rephraseAfter) {
                    log('rephrasing prompt (after ' + tries + ' tries)');
                    currentPrompt = await rephrasePrompt(currentPrompt, cfg.rephraseModel);
                    rephrasedThisPhase = true;
                    log('rephrased: ' + currentPrompt.slice(0, 80));
                }
                if (tries === 1 || needResend) {
                    // fresh send (attempt 1) or resend fallback (no retry button ever appeared)
                    if (needResend) {
                        const gap = randomGap(cfg.minGap, cfg.maxGap) + backoffFor(tries);
                        log(`gap ${gap.toFixed(1)}s before resend`);
                        await sleep(gap);
                    }
                    needResend = false;
                    if (!sendDom(assemble(currentPrompt))) {
                        log('composer not ready, waiting');
                        await sleep(5);
                        continue;
                    }
                } else {
                    // retry-button path: waitAssistantMessage clicks "Try again" the moment it renders
                    // (transient dialog auto-dismisses); the regeneration wait IS the gap
                    log('waiting for retry button or result');
                }
                const last = await waitAssistantMessage();
                if (stopFlag) break;
                if (last && last.__retryClicked === true) {
                    log('clicked Try again (variant regeneration)');
                    continue; // regeneration in progress; next iteration waits for its result
                }
                if (!last) {
                    log('fail: no assistant message (timeout)');
                    await sleep(backoffFor(tries));
                    continue;
                }
                // capture any image blob mid-flow (for fresh-chat reference)
                const blob = await grabLastImageBlob();
                if (blob) {
                    lastBlob = blob;
                    try {
                        const b64 = await blobToBase64(blob);
                        if (b64) { state.lastBlobB64 = b64; state.lastBlobType = blob.type || 'image/png'; }
                    } catch (_) { /* keep in-memory only */ }
                }

                const c = classifyDom(last);
                if (c.kind === 'success') {
                    const name = `cdr_p${phase}_${tries}_${Date.now()}.png`;
                    const handled = await downloadByUrl(c.src, name);
                    log(`OK image -> ${name}${handled ? '' : ' (opened in new tab)'}`);
                    log(`SUCCESS on phase ${phase} attempt ${tries}`);
                    localStorage.removeItem('cdr_state');
                    return true;
                }
                log(`fail: ${c.kind} — ${(c.text || '').slice(0, 120)}`);
                if (c.kind === 'denial') log('POLICY DENIAL');
                if (c.kind === 'deterministic') {
                    log('DETERMINISTIC DENIAL (IP/copyright) — stopping, resend will not slip through');
                    localStorage.removeItem('cdr_state');
                    return false; // no retry, no phase 2
                }
                // denial/rate/generic_fail/no_image with no retry button clicked → resend next iteration
                needResend = true;
                log('no retry button — resending');
            }
            phase++;
            if (phase > CONFIG.freshChatPhases || stopFlag) break;
            // fresh chat with reference
            log(`PHASE ${phase}: fresh chat${lastBlob ? ' + reference image' : ' (no reference image captured)'}`);
            // save state BEFORE navigation so a reload (New chat click) resumes at the correct phase
            localStorage.setItem('cdr_state', JSON.stringify({ prompt: rawPrompt, phase, running: true, lastBlobB64: state.lastBlobB64 || null, lastBlobType: state.lastBlobType || 'image/png' }));
            const nav = openNewChat();
            if (nav === 'navigating') {
                return 'navigating'; // state already saved above
            }
            // wait for composer ready in new chat
            let ready = 0;
            while (!stopFlag && !findComposer() && ready < 20) { await new Promise((r) => setTimeout(r, 500)); ready++; }
            if (lastBlob) {
                const up = await uploadReference(lastBlob);
                log(up ? 'reference image attached' : 'reference upload failed — continuing without');
            }
            await sleep(randomGap(cfg.minGap, cfg.maxGap));
        }
        localStorage.removeItem('cdr_state');
        log(stopFlag ? 'STOPPED by user' : 'MANUAL: all phases exhausted');
        return false;
    }

    async function start() {
        const promptRaw = $('#cdr-prompt').value.trim();
        if (!promptRaw) { log('no prompt'); return; }
        const cfg = readConfig();
        const guardOn = $('#cdr-guard').checked;
        const steerOn = $('#cdr-steer').checked;
        state.running = true;
        awaitingResume = false;
        stopFlag = false;
        $('#cdr-stop').disabled = false;
        $('#cdr-start').disabled = true;
        logEl.textContent = '';
        setStatus('running');
        log(`guard=${guardOn ? 'on' : 'off'} steer=${steerOn ? 'on' : 'off'} tries=${cfg.maxTries} gap=${cfg.minGap}-${cfg.maxGap}s`);
        if (guardOn) log(`GUARD prepended: ${cfg.guardText}`);
        if (steerOn) log(`STEER appended: ${cfg.steerText}`);

        if (!resuming) { state.phase = 1; state.lastBlobB64 = null; state.lastBlobType = null; } // fresh run starts at phase 1 (resume keeps the saved phase)
        const ok = await run(promptRaw, cfg, guardOn, steerOn);
        resuming = false;
        if (ok === 'navigating') { awaitingResume = true; return; } // SPA nav: poll resumes phase 2
        state.running = false;
        setStatus(ok ? 'done (success)' : 'done (manual)');
        $('#cdr-stop').disabled = true;
        $('#cdr-start').disabled = false;
    }

    function resumeOrInit() {
        try {
            const saved = localStorage.getItem('cdr_state');
            if (!saved) return;
            const s = JSON.parse(saved);
            if (!s || !s.running) return;
            $('#cdr-prompt').value = s.prompt;
            state.phase = s.phase || 1;
            state.lastBlobB64 = s.lastBlobB64 || null;
            state.lastBlobType = s.lastBlobType || 'image/png';
            resuming = true;
            log(`resumed after fresh-chat nav, phase ${state.phase}`);
            setStatus('resumed');
            (async () => {
                await sleep(randomGap(CONFIG.minGapSec, CONFIG.maxGapSec));
                if (!stopFlag) start();
            })();
        } catch (_) { /* bad state */ }
    }

    $('#cdr-start').addEventListener('click', start);
    $('#cdr-stop').addEventListener('click', () => {
        stopFlag = true;
        // abort the live ChatGPT generation server-side too (button may not exist)
        const sb = document.querySelector('[data-testid="stop-button"]');
        if (sb) sb.click();
    });

    resumeOrInit();

    // 2026 ChatGPT New chat is an SPA navigation (no page reload), so DOMContentLoaded
    // never fires again — poll cdr_state to resume phase 2 after the fresh-chat nav.
    setInterval(() => {
        if (!awaitingResume) return;
        try {
            const saved = localStorage.getItem('cdr_state');
            if (!saved) return;
            const s = JSON.parse(saved);
            if (s && s.running) { awaitingResume = false; resumeOrInit(); }
        } catch (_) { /* bad state */ }
    }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootUI);
    } else {
        bootUI();
    }
})();
