# 🌉 ChatGPT Bridge — Companion Dashboard: Full Blueprint & Implementation

---

## 1. System & Information Architecture

### 1.1 Topology (Zero New Containers)

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Container: chatgpt_bridge                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  FastAPI (uvicorn) :8465                              │  │
│  │                                                       │  │
│  │  GET /            → dashboard.html (SPA, 1 file)      │  │
│  │  GET /api/*       → JSON (gallery, chats, accounts,   │  │
│  │                     telemetry, settings)              │  │
│  │  GET /images/*    → existing static image streaming   │  │
│  │  POST /image|/ask → existing engine endpoints         │  │
│  │  WS   /ws/events  → live telemetry & progress push    │  │
│  └───────────────────────────────────────────────────────┘  │
│         │                        │                          │
│   ┌─────▼──────┐          ┌──────▼───────┐                  │
│   │ Telegram   │          │ Playwright/  │                  │
│   │ Bot poller │          │ Chromium     │                  │
│   └────────────┘          └──────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

The dashboard is **one static file** served from memory. No Node, no build, no extra RAM beyond a few KB of HTML. Tailwind + Alpine via CDN (cached by browser).

### 1.2 SPA Layout & Navigation

```
┌────────────────────────────────────────────────────────────┐
│ ◆ BRIDGE   [Gallery] [Accounts] [Chats] [Studio]     ● live│  ← top nav (glassy, sticky)
├────────────────────────────────────────────────────────────┤
│                                                            │
│  VIEW: GALLERY                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [All] [Today] [Favorites] [By Conversation ▾]  🔍    │  │ ← filter bar
│  ├──────────────────────────────────────────────────────┤  │
│  │  ▓▓▓   ▓▓▓▓▓   ▓▓▓    ▓▓▓▓                           │  │
│  │  ▓▓▓▓  ▓▓▓▓▓   ▓▓▓▓▓  ▓▓▓▓   ← CSS columns masonry   │  │
│  │  ▓▓▓   ▓▓▓     ▓▓▓▓▓  ▓▓▓▓▓                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  VIEW: ACCOUNTS ─ card grid w/ status pills, switch btn    │
│  VIEW: CHATS    ─ table w/ thumbnails, turn counts         │
│  VIEW: STUDIO   ─ composer + live progress overlay         │
└────────────────────────────────────────────────────────────┘
  Slide-overs: Lightbox (right, 60%w) · Cookie import · Toasts (bottom-right)
```

### 1.3 State Management (Alpine.js)

One root store (`Alpine.store('app')`) holds: `view`, `gallery {items, cursor, filter}`, `accounts`, `chats`, `telemetry`, `toasts`, `lightbox`. Components are thin renderers; all mutations go through store actions that call the API. Live updates via a single WebSocket (`/ws/events`) merged into the store — no polling except a 15s telemetry fallback.

---

## 2. Backend API Extension Specification

Add to `daemon.py`:

```python
# ─────────────────────────── API MODELS ───────────────────────────
from pydantic import BaseModel
from typing import Optional, Literal

class GalleryItem(BaseModel):
    id: str                      # filename stem (epoch ms)
    url: str                     # /images/<file>
    prompt: Optional[str] = None
    tweaked_prompt: Optional[str] = None
    tweaked_prompt_2: Optional[str] = None
    conversation_id: Optional[str] = None
    account_used: Optional[str] = None
    created_at: float            # epoch
    size_bytes: int
    md5: str
    duration_s: Optional[float] = None
    favorite: bool = False

class GalleryPage(BaseModel):
    items: list[GalleryItem]
    next_cursor: Optional[str] = None   # epoch-ms of last item; None = end
    total: int

class ChatSummary(BaseModel):
    conversation_id: str
    turns: int
    thumbnails: list[str]        # up to 4 image urls
    last_active: float
    last_prompt: Optional[str] = None

class CookieImport(BaseModel):
    account: str
    cookies_json: str            # raw exported cookie JSON

class SettingsPatch(BaseModel):
    auto_switch: Optional[bool] = None
    max_retries: Optional[int] = None

class ContinueChatReq(BaseModel):
    conversation_id: str
    prompt: str
    tweaked_prompt: Optional[str] = None
    tweaked_prompt_2: Optional[str] = None
    timeout_s: int = 300
```

### Endpoint table

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/gallery?cursor=&limit=40&filter=all\|today\|favorites&conversation_id=` | Paginated gallery, newest-first, cursor = last item's epoch |
| `GET` | `/api/gallery/{id}` | Single item metadata (lightbox) |
| `POST` | `/api/gallery/{id}/favorite` | Toggle favorite |
| `DELETE` | `/api/gallery/{id}` | Delete image file + metadata |
| `GET` | `/api/chats` | Chat pool summaries w/ thumbnails |
| `DELETE` | `/api/chats/{id}` | Delete chat (proxies to `DELETE /conversations/{id}`) |
| `POST` | `/api/chats/purge_stale?older_than_h=24` | Clear stale chats |
| `GET` | `/api/accounts` | (reuse existing, enrich with computed `status` field) |
| `POST` | `/api/accounts/cookies` | Import cookies → writes `cookies.json`, re-auths profile |
| `GET` | `/api/telemetry` | Engine status, active account, totals, uptime |
| `GET`/`PATCH` | `/api/settings` | Read/update `auto_switch`, `max_retries` |
| `WS` | `/ws/events` | Push: `generation_progress`, `generation_done`, `account_switched`, `rate_limited` |

### Implementation — metadata sidecar

Your engine currently returns metadata but doesn't persist it. Add a **sidecar index** so the gallery has prompt/account/conversation data:

```python
# daemon.py — additions
import hashlib, json, time, asyncio
from pathlib import Path
from fastapi import WebSocket, WebSocketDisconnect, Query
from fastapi.responses import HTMLResponse, FileResponse

DATA_DIR   = Path(os.environ.get("BRIDGE_DATA", Path.home() / ".chatgpt-bridge"))
IMAGES_DIR = DATA_DIR / "images"
META_FILE  = DATA_DIR / "gallery_index.json"
FAVS_FILE  = DATA_DIR / "favorites.json"
DASH_HTML  = Path(__file__).parent / "dashboard.html"

_meta_lock = asyncio.Lock()

def _load_json(p: Path, default):
    try: return json.loads(p.read_text())
    except Exception: return default

def _save_json(p: Path, obj):
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, indent=1))
    tmp.replace(p)  # atomic

# Call this from your existing /image handler right after a successful save:
async def index_generation(path: Path, *, prompt, tweaked_prompt, tweaked_prompt_2,
                           conversation_id, account_used, duration_s):
    data = path.read_bytes()
    entry = {
        "id": path.stem,
        "prompt": prompt, "tweaked_prompt": tweaked_prompt,
        "tweaked_prompt_2": tweaked_prompt_2,
        "conversation_id": conversation_id, "account_used": account_used,
        "created_at": path.stat().st_mtime, "size_bytes": len(data),
        "md5": hashlib.md5(data).hexdigest(), "duration_s": duration_s,
    }
    async with _meta_lock:
        idx = _load_json(META_FILE, {})
        idx[entry["id"]] = entry
        _save_json(META_FILE, idx)
    await ws_broadcast({"type": "generation_done", "item": entry})
    return entry

# ── Gallery ──
@app.get("/api/gallery", response_model=GalleryPage)
async def api_gallery(cursor: Optional[str] = None, limit: int = Query(40, le=100),
                      filter: str = "all", conversation_id: Optional[str] = None):
    idx  = _load_json(META_FILE, {})
    favs = set(_load_json(FAVS_FILE, []))
    # self-heal: index any image on disk missing from the index
    for p in IMAGES_DIR.glob("*.png"):
        if p.stem not in idx:
            idx[p.stem] = {"id": p.stem, "prompt": None, "conversation_id": None,
                           "account_used": None, "created_at": p.stat().st_mtime,
                           "size_bytes": p.stat().st_size,
                           "md5": hashlib.md5(p.read_bytes()).hexdigest(),
                           "duration_s": None}
    items = sorted(idx.values(), key=lambda e: e["created_at"], reverse=True)
    now = time.time()
    if filter == "today":
        items = [e for e in items if now - e["created_at"] < 86400]
    elif filter == "favorites":
        items = [e for e in items if e["id"] in favs]
    if conversation_id:
        items = [e for e in items if e.get("conversation_id") == conversation_id]
    if cursor:
        items = [e for e in items if str(int(e["created_at"]*1000)) < cursor]
    page, total = items[:limit], len(items)
    for e in page:
        e["url"] = f"/images/{e['id']}.png"
        e["favorite"] = e["id"] in favs
    nxt = str(int(page[-1]["created_at"]*1000)) if len(page) == limit and page else None
    return GalleryPage(items=page, next_cursor=nxt, total=total)

@app.get("/api/gallery/{gid}", response_model=GalleryItem)
async def api_gallery_one(gid: str):
    idx = _load_json(META_FILE, {}); favs = set(_load_json(FAVS_FILE, []))
    if gid not in idx: raise HTTPException(404)
    e = idx[gid]; e["url"] = f"/images/{gid}.png"; e["favorite"] = gid in favs
    return e

@app.post("/api/gallery/{gid}/favorite")
async def api_fav(gid: str):
    favs = set(_load_json(FAVS_FILE, []))
    (favs.discard if gid in favs else favs.add)(gid)
    _save_json(FAVS_FILE, sorted(favs))
    return {"favorite": gid in favs}

@app.delete("/api/gallery/{gid}")
async def api_del_img(gid: str):
    (IMAGES_DIR / f"{gid}.png").unlink(missing_ok=True)
    idx = _load_json(META_FILE, {}); idx.pop(gid, None); _save_json(META_FILE, idx)
    return {"deleted": gid}

# ── Chats ──
@app.get("/api/chats", response_model=list[ChatSummary])
async def api_chats():
    pool = _load_json(DATA_DIR / "chat_pool.json", {"_ids": []})
    idx  = _load_json(META_FILE, {})
    out = []
    for cid in pool.get("_ids", []):
        imgs = sorted([e for e in idx.values() if e.get("conversation_id") == cid],
                      key=lambda e: e["created_at"], reverse=True)
        out.append(ChatSummary(
            conversation_id=cid, turns=len(imgs),
            thumbnails=[f"/images/{e['id']}.png" for e in imgs[:4]],
            last_active=imgs[0]["created_at"] if imgs else 0,
            last_prompt=imgs[0].get("prompt") if imgs else None))
    return sorted(out, key=lambda c: c.last_active, reverse=True)

@app.post("/api/chats/purge_stale")
async def api_purge(older_than_h: int = 24):
    pool = _load_json(DATA_DIR / "chat_pool.json", {"_ids": []})
    idx  = _load_json(META_FILE, {})
    cutoff, kept, purged = time.time() - older_than_h*3600, [], 0
    for cid in pool.get("_ids", []):
        last = max([e["created_at"] for e in idx.values()
                    if e.get("conversation_id") == cid] or [0])
        if last < cutoff:
            try: await delete_conversation(cid)  # your existing helper
            except Exception: pass
            purged += 1
        else: kept.append(cid)
    _save_json(DATA_DIR / "chat_pool.json", {"_ids": kept})
    return {"purged": purged, "remaining": len(kept)}

# ── Accounts / cookies / settings / telemetry ──
SETTINGS_FILE = DATA_DIR / "settings.json"

@app.post("/api/accounts/cookies")
async def api_import_cookies(body: CookieImport):
    accts = _load_json(DATA_DIR / "accounts.json", [])
    acct = next((a for a in accts if a.get("alias") == body.account or a.get("id") == body.account), None)
    if not acct: raise HTTPException(404, "unknown account")
    json.loads(body.cookies_json)  # validate
    Path(acct["cookies_file"]).write_text(body.cookies_json)
    acct["is_authenticated"] = True
    _save_json(DATA_DIR / "accounts.json", accts)
    return {"ok": True, "account": body.account}

@app.get("/api/settings")
async def get_settings():
    return _load_json(SETTINGS_FILE, {"auto_switch": True, "max_retries": 10})

@app.patch("/api/settings")
async def patch_settings(p: SettingsPatch):
    s = _load_json(SETTINGS_FILE, {"auto_switch": True, "max_retries": 10})
    if p.auto_switch is not None: s["auto_switch"] = p.auto_switch
    if p.max_retries is not None: s["max_retries"] = p.max_retries
    _save_json(SETTINGS_FILE, s)
    engine.configure(auto_switch=s["auto_switch"], max_retries=s["max_retries"])  # hook into core
    return s

@app.get("/api/telemetry")
async def api_telemetry():
    idx = _load_json(META_FILE, {})
    return {"status": "ok", "uptime_s": time.time() - START_TS,
            "total_images": len(list(IMAGES_DIR.glob('*.png'))),
            "active_account": engine.active_account_alias,
            "browser_busy": _lock.locked(),
            "settings": _load_json(SETTINGS_FILE, {"auto_switch": True, "max_retries": 10})}

# ── WebSocket live events ──
_ws_clients: set[WebSocket] = set()

@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    await ws.accept(); _ws_clients.add(ws)
    try:
        while True: await ws.receive_text()  # keepalive / ignore
    except WebSocketDisconnect: pass
    finally: _ws_clients.discard(ws)

async def ws_broadcast(msg: dict):
    dead = []
    for ws in list(_ws_clients):
        try: await ws.send_json(msg)
        except Exception: dead.append(ws)
    for ws in dead: _ws_clients.discard(ws)

# Hook inside your generation retry loop:
#   await ws_broadcast({"type":"generation_progress","retry":i,"max":retries,"elapsed":...})
```

### Serving the SPA

```python
@app.get("/", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return HTMLResponse(DASH_HTML.read_text())
```

---

## 3. Complete Production SPA — `dashboard.html`

Save beside `daemon.py`. Fully self-contained: Tailwind CDN + Alpine.js, Inter font, all 5 modules, lightbox w/ zoom-pan, toasts, WebSocket live updates, keyboard shortcuts.

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bridge · Command Deck</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = { theme: { extend: {
  colors: { base:'#09090b', panel:'#121214', raise:'#18181b', edge:'#27272a',
            glow:'#6366f1', mint:'#10b981' },
  fontFamily: { sans:['Inter','system-ui','sans-serif'], mono:['JetBrains Mono','monospace'] }
}}}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.x/dist/cdn.min.js"></script>
<style>
  [x-cloak]{display:none!important}
  body{background:#09090b}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-thumb{background:#27272a;border-radius:8px}
  ::-webkit-scrollbar-track{background:transparent}
  .glass{background:rgba(18,18,20,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
  .hairline{border:1px solid #27272a}
  .masonry{columns:1;column-gap:1rem}
  @media(min-width:640px){.masonry{columns:2}}
  @media(min-width:1024px){.masonry{columns:3}}
  @media(min-width:1536px){.masonry{columns:4}}
  .masonry>*{break-inside:avoid;margin-bottom:1rem}
  .card-img{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
  .card-img:hover{transform:translateY(-3px);box-shadow:0 12px 40px -8px rgba(99,102,241,.35)}
  .fadein{animation:fi .3s ease both}
  @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .pulse-dot{animation:pd 1.6s ease-in-out infinite}
  @keyframes pd{0%,100%{opacity:1}50%{opacity:.35}}
  .toast-in{animation:ti .25s cubic-bezier(.2,.8,.2,1) both}
  @keyframes ti{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
  .shimmer{background:linear-gradient(110deg,#18181b 30%,#222226 50%,#18181b 70%);
           background-size:200% 100%;animation:sh 1.4s linear infinite}
  @keyframes sh{to{background-position:-200% 0}}
  input,textarea,select{outline:none}
  input:focus,textarea:focus,select:focus{border-color:#6366f1!important;
    box-shadow:0 0 0 3px rgba(99,102,241,.15)}
</style>
</head>
<body class="text-zinc-200 font-sans antialiased min-h-screen"
      x-data="app()" x-init="init()" @keydown.escape.window="closeAll()">

<!-- ══════════ NAV ══════════ -->
<header class="sticky top-0 z-40 glass hairline border-x-0 border-t-0">
  <div class="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
    <div class="flex items-center gap-2.5 font-bold tracking-tight text-white">
      <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-glow to-violet-500 grid place-items-center text-sm shadow-lg shadow-glow/30">◆</div>
      <span class="hidden sm:inline">BRIDGE<span class="text-zinc-500 font-medium">/deck</span></span>
    </div>
    <nav class="flex items-center gap-1 text-sm">
      <template x-for="t in ['gallery','accounts','chats','studio']" :key="t">
        <button @click="view=t" class="px-3 py-1.5 rounded-md capitalize transition-colors"
          :class="view===t ? 'bg-raise text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'"
          x-text="t"></button>
      </template>
    </nav>
    <div class="ml-auto flex items-center gap-3 text-xs">
      <span class="hidden md:flex items-center gap-1.5 text-zinc-400">
        <span class="w-2 h-2 rounded-full" :class="wsLive?'bg-mint pulse-dot':'bg-zinc-600'"></span>
        <span x-text="wsLive?'live':'offline'"></span>
      </span>
      <span class="px-2 py-1 rounded-md hairline bg-panel text-zinc-300 font-mono"
            x-text="telemetry.active_account||'—'"></span>
      <span class="w-2 h-2 rounded-full" :class="telemetry.browser_busy?'bg-amber-400 pulse-dot':'bg-mint'"></span>
    </div>
  </div>
</header>

<main class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">

<!-- ══════════ MODULE 1: GALLERY ══════════ -->
<section x-show="view==='gallery'" x-cloak>
  <div class="flex flex-wrap items-center gap-2 mb-5">
    <template x-for="f in [['all','All Generations'],['today','Latest · Today'],['favorites','★ Favorites']]" :key="f[0]">
      <button @click="setFilter(f[0])" class="px-3 py-1.5 rounded-full text-xs font-medium hairline transition"
        :class="filter===f[0]?'bg-glow/15 text-indigo-300 border-glow/40':'bg-panel text-zinc-400 hover:text-zinc-200'"
        x-text="f[1]"></button>
    </template>
    <select x-model="convFilter" @change="resetGallery();loadGallery()"
      class="ml-auto bg-panel hairline rounded-md text-xs px-2.5 py-1.5 text-zinc-300">
      <option value="">All Conversations</option>
      <template x-for="c in chats" :key="c.conversation_id">
        <option :value="c.conversation_id" x-text="(c.last_prompt||c.conversation_id).slice(0,42)+' · '+c.turns+' turns'"></option>
      </template>
    </select>
    <span class="text-xs text-zinc-500 font-mono" x-text="galleryTotal+' items'"></span>
  </div>

  <div class="masonry">
    <template x-for="img in gallery" :key="img.id">
      <div class="card-img relative rounded-xl overflow-hidden hairline bg-panel cursor-pointer group fadein"
           @click="openLightbox(img)">
        <img :src="img.url" loading="lazy" class="w-full block" :alt="img.prompt||'generation'">
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
          <p class="text-xs text-zinc-200 line-clamp-2" x-text="img.prompt||'—'"></p>
          <div class="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400 font-mono">
            <span x-text="img.account_used||'?'"></span>·<span x-text="timeAgo(img.created_at)"></span>
            <span x-show="img.favorite" class="text-amber-400">★</span>
          </div>
        </div>
      </div>
    </template>
    <!-- skeletons -->
    <template x-if="galleryLoading"><div class="space-y-4">
      <template x-for="i in 6"><div class="shimmer rounded-xl h-56 hairline"></div></template>
    </div></template>
  </div>
  <div x-show="!gallery.length && !galleryLoading" class="text-center py-24 text-zinc-500">
    <div class="text-4xl mb-3">🌉</div><p>No generations yet. Open the <b>Studio</b> and create.</p>
  </div>
  <div x-show="nextCursor" class="text-center py-8">
    <button @click="loadGallery()" class="px-5 py-2 rounded-lg hairline bg-panel text-sm hover:bg-raise transition">Load more</button>
  </div>
</section>

<!-- ══════════ MODULE 2: ACCOUNTS ══════════ -->
<section x-show="view==='accounts'" x-cloak>
  <div class="flex items-center justify-between mb-5">
    <h2 class="text-lg font-bold text-white">Account Command Center</h2>
    <button @click="cookieDrawer=true" class="px-4 py-2 rounded-lg bg-glow hover:bg-indigo-500 text-white text-sm font-medium transition shadow-lg shadow-glow/25">+ Import Cookies</button>
  </div>
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <template x-for="a in accounts" :key="a.alias||a.id">
      <div class="rounded-xl hairline bg-panel p-5 fadein" :class="a.is_active&&'ring-1 ring-glow/50'">
        <div class="flex items-start justify-between">
          <div>
            <div class="font-semibold text-white" x-text="a.alias||a.id"></div>
            <div class="text-xs text-zinc-500 font-mono mt-0.5" x-text="a.email||''"></div>
          </div>
          <span class="text-[11px] px-2 py-1 rounded-full font-medium"
            :class="statusPill(a).cls" x-text="statusPill(a).label"></span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
          <div class="rounded-lg bg-raise py-2"><div class="text-sm font-bold text-white" x-text="a.total_generations||0"></div><div class="text-[10px] text-zinc-500">gens</div></div>
          <div class="rounded-lg bg-raise py-2"><div class="text-sm font-bold text-white" x-text="a.consecutive_rate_limits||0"></div><div class="text-[10px] text-zinc-500">strikes</div></div>
          <div class="rounded-lg bg-raise py-2"><div class="text-sm font-bold text-white" x-text="cooldownLeft(a)"></div><div class="text-[10px] text-zinc-500">cooldown</div></div>
        </div>
        <button @click="switchAccount(a)" :disabled="a.is_active"
          class="mt-4 w-full py-2 rounded-lg text-sm font-medium transition"
          :class="a.is_active?'bg-glow/15 text-indigo-300 cursor-default':'bg-raise hover:bg-glow hover:text-white text-zinc-300'"
          x-text="a.is_active?'● Active':'Switch to this account'"></button>
      </div>
    </template>
  </div>

  <!-- settings / telemetry strip -->
  <div class="mt-8 rounded-xl hairline bg-panel p-5">
    <h3 class="text-sm font-semibold text-white mb-4">⚙ Engine Toggles & Telemetry</h3>
    <div class="flex flex-wrap items-center gap-6 text-sm">
      <label class="flex items-center gap-2 cursor-pointer">
        <button @click="patchSettings({auto_switch:!settings.auto_switch})"
          class="w-10 h-5.5 h-6 rounded-full transition relative" :class="settings.auto_switch?'bg-mint':'bg-zinc-700'">
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" :class="settings.auto_switch?'left-4.5 left-[18px]':'left-0.5'"></span>
        </button><span class="text-zinc-300">Auto account switching</span>
      </label>
      <label class="flex items-center gap-2 text-zinc-300">Max retries
        <input type="number" min="1" max="30" :value="settings.max_retries"
          @change="patchSettings({max_retries:+$event.target.value})"
          class="w-16 bg-raise hairline rounded-md px-2 py-1 text-center font-mono">
      </label>
      <div class="ml-auto flex gap-5 text-xs text-zinc-400 font-mono">
        <span>uptime <b class="text-zinc-200" x-text="fmtDur(telemetry.uptime_s)"></b></span>
        <span>images <b class="text-zinc-200" x-text="telemetry.total_images||0"></b></span>
        <span>engine <b :class="telemetry.browser_busy?'text-amber-400':'text-mint'" x-text="telemetry.browser_busy?'BUSY':'IDLE'"></b></span>
      </div>
    </div>
  </div>
</section>

<!-- ══════════ MODULE 3: CHATS ══════════ -->
<section x-show="view==='chats'" x-cloak>
  <div class="flex items-center justify-between mb-5">
    <h2 class="text-lg font-bold text-white">Conversation Pool</h2>
    <button @click="purgeStale()" class="px-4 py-2 rounded-lg hairline bg-panel hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 text-sm text-zinc-300 transition">🧹 Purge stale (>24h)</button>
  </div>
  <div class="space-y-3">
    <template x-for="c in chats" :key="c.conversation_id">
      <div class="rounded-xl hairline bg-panel p-4 flex flex-wrap items-center gap-4 fadein">
        <div class="flex -space-x-3">
          <template x-for="t in c.thumbnails" :key="t">
            <img :src="t" class="w-12 h-12 rounded-lg object-cover border-2 border-base">
          </template>
          <div x-show="!c.thumbnails.length" class="w-12 h-12 rounded-lg bg-raise grid place-items-center text-zinc-600">💬</div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-mono text-xs text-indigo-300" x-text="c.conversation_id"></div>
          <div class="text-sm text-zinc-300 truncate mt-0.5" x-text="c.last_prompt||'—'"></div>
          <div class="text-[11px] text-zinc-500 mt-0.5"><span x-text="c.turns"></span> turns · last active <span x-text="timeAgo(c.last_active)"></span></div>
        </div>
        <div class="flex gap-2">
          <button @click="filterByChat(c)" class="px-3 py-1.5 rounded-md hairline bg-raise text-xs hover:text-white transition">View images</button>
          <button @click="studioFromChat(c)" class="px-3 py-1.5 rounded-md bg-glow/15 text-indigo-300 text-xs hover:bg-glow/30 transition">Continue →</button>
          <button @click="deleteChat(c)" class="px-3 py-1.5 rounded-md text-xs text-zinc-500 hover:text-red-400 transition">Delete</button>
        </div>
      </div>
    </template>
    <div x-show="!chats.length" class="text-center py-16 text-zinc-500">No active conversations in pool.</div>
  </div>
</section>

<!-- ══════════ MODULE 4: STUDIO ══════════ -->
<section x-show="view==='studio'" x-cloak class="max-w-3xl mx-auto">
  <h2 class="text-lg font-bold text-white mb-5">Prompt Studio</h2>
  <div class="rounded-xl hairline bg-panel p-5 space-y-4">
    <div>
      <label class="text-xs font-medium text-zinc-400 mb-1.5 block">PROMPT</label>
      <textarea x-model="studio.prompt" rows="4" @keydown.meta.enter="generate()" @keydown.ctrl.enter="generate()"
        placeholder="A cinematic portrait of…   (⌘/Ctrl + Enter to generate)"
        class="w-full bg-raise hairline rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-600 resize-y"></textarea>
    </div>
    <div class="hairline rounded-lg overflow-hidden">
      <button @click="studio.showTweaks=!studio.showTweaks" class="w-full px-3 py-2 text-xs text-zinc-400 bg-raise/50 flex justify-between items-center hover:text-zinc-200">
        <span>⚗ Prompt refinement layers</span><span x-text="studio.showTweaks?'▾':'▸'"></span>
      </button>
      <div x-show="studio.showTweaks" x-collapse class="p-3 space-y-3 bg-raise/30">
        <textarea x-model="studio.t1" rows="2" placeholder="Level 1 — softening / style nudge (optional)"
          class="w-full bg-raise hairline rounded-md p-2.5 text-xs text-zinc-200 placeholder-zinc-600"></textarea>
        <textarea x-model="studio.t2" rows="2" placeholder="Level 2 — deep refinement (optional)"
          class="w-full bg-raise hairline rounded-md p-2.5 text-xs text-zinc-200 placeholder-zinc-600"></textarea>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <select x-model="studio.conv" class="bg-raise hairline rounded-md text-xs px-2.5 py-2 text-zinc-300 max-w-[260px]">
        <option value="">✦ New conversation</option>
        <template x-for="c in chats" :key="c.conversation_id">
          <option :value="c.conversation_id" x-text="'↳ '+(c.last_prompt||c.conversation_id).slice(0,40)"></option>
        </template>
      </select>
      <button @click="generate()" :disabled="generating||!studio.prompt.trim()"
        class="ml-auto px-6 py-2.5 rounded-lg bg-glow hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-lg shadow-glow/25">
        <span x-show="!generating">Generate ✦</span><span x-show="generating">Working…</span>
      </button>
    </div>
  </div>

  <!-- live progress -->
  <div x-show="generating" class="mt-5 rounded-xl hairline bg-panel p-5 fadein">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full border-2 border-glow border-t-transparent animate-spin"></div>
      <div>
        <div class="text-sm font-medium text-white" x-text="progress.status||'Contacting DALL·E…'"></div>
        <div class="text-xs text-zinc-400 font-mono mt-0.5">
          attempt <span x-text="progress.retry||1"></span>/<span x-text="settings.max_retries||10"></span>
          · <span x-text="progress.elapsed||0"></span>s elapsed
          · account <span class="text-indigo-300" x-text="telemetry.active_account||'?'"></span>
        </div>
      </div>
    </div>
    <div class="mt-3 h-1.5 rounded-full bg-raise overflow-hidden">
      <div class="h-full bg-gradient-to-r from-glow to-violet-400 transition-all duration-500" :style="`width:${progress.pct||8}%`"></div>
    </div>
  </div>
</section>
</main>

<!-- ══════════ LIGHTBOX ══════════ -->
<div x-show="lightbox" x-cloak class="fixed inset-0 z-50 flex" @click.self="lightbox=null">
  <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
  <div class="relative flex-1 grid place-items-center p-6 overflow-hidden">
    <img :src="lightbox?.url" class="max-h-[88vh] max-w-full rounded-lg shadow-2xl cursor-grab select-none fadein"
         :style="`transform:scale(${zoom}) translate(${pan.x}px,${pan.y}px)`"
         @wheel.prevent="zoom=Math.min(4,Math.max(.5,zoom-($event.deltaY>0?.15:-.15)))"
         @mousedown.prevent="startPan($event)" @dblclick="zoom=1;pan={x:0,y:0}" draggable="false">
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 glass hairline rounded-full px-3 py-1.5 text-xs">
      <button @click="zoom=Math.max(.5,zoom-.25)" class="hover:text-white">−</button>
      <span class="font-mono text-zinc-400" x-text="Math.round(zoom*100)+'%'"></span>
      <button @click="zoom=Math.min(4,zoom+.25)" class="hover:text-white">+</button>
      <button @click="zoom=1;pan={x:0,y:0}" class="text-zinc-500 hover:text-white ml-1">reset</button>
    </div>
  </div>
  <aside class="relative w-full max-w-sm glass hairline border-y-0 border-r-0 overflow-y-auto p-5 space-y-5">
    <div class="flex items-center justify-between">
      <h3 class="font-bold text-white">Inspector</h3>
      <button @click="lightbox=null" class="text-zinc-500 hover:text-white text-xl leading-none">×</button>
    </div>
    <template x-if="lightbox">
      <div class="space-y-4 text-sm">
        <div><div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Prompt</div>
          <p class="text-zinc-200 bg-raise hairline rounded-lg p-3 text-xs leading-relaxed" x-text="lightbox.prompt||'—'"></p></div>
        <template x-if="lightbox.tweaked_prompt"><div>
          <div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Level 1 tweak</div>
          <p class="text-zinc-300 bg-raise hairline rounded-lg p-3 text-xs" x-text="lightbox.tweaked_prompt"></p></div></template>
        <template x-if="lightbox.tweaked_prompt_2"><div>
          <div class="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Level 2 tweak</div>
          <p class="text-zinc-300 bg-raise hairline rounded-lg p-3 text-xs" x-text="lightbox.tweaked_prompt_2"></p></div></template>
        <div class="grid grid-cols-2 gap-2 text-xs font-mono">
          <div class="bg-raise hairline rounded-lg p-2.5"><div class="text-zinc-500 text-[10px]">ACCOUNT</div><div class="text-indigo-300" x-text="lightbox.account_used||'—'"></div></div>
          <div class="bg-raise hairline rounded-lg p-2.5"><div class="text-zinc-500 text-[10px]">DURATION</div><div x-text="lightbox.duration_s?lightbox.duration_s.toFixed(1)+'s':'—'"></div></div>
          <div class="bg-raise hairline rounded-lg p-2.5"><div class="text-zinc-500 text-[10px]">SIZE</div><div x-text="fmtBytes(lightbox.size_bytes)"></div></div>
          <div class="bg-raise hairline rounded-lg p-2.5"><div class="text-zinc-500 text-[10px]">MD5</div><div class="truncate" x-text="lightbox.md5"></div></div>
          <div class="bg-raise hairline rounded-lg p-2.5 col-span-2"><div class="text-zinc-500 text-[10px]">CONVERSATION</div><div class="truncate text-indigo-300" x-text="lightbox.conversation_id||'—'"></div></div>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button @click="copy(lightbox.prompt,'Prompt copied')" class="py-2 rounded-lg hairline bg-raise text-xs hover:text-white transition">📋 Copy prompt</button>
          <button @click="fav(lightbox)" class="py-2 rounded-lg hairline bg-raise text-xs transition" :class="lightbox.favorite?'text-amber-400':'hover:text-white'" x-text="lightbox.favorite?'★ Favorited':'☆ Favorite'"></button>
          <button @click="continueChat(lightbox)" class="py-2 rounded-lg bg-glow/15 text-indigo-300 text-xs hover:bg-glow/30 transition">↳ Continue chat</button>
          <a :href="lightbox.url" download class="py-2 rounded-lg hairline bg-raise text-xs hover:text-white transition text-center">⬇ Download</a>
          <button @click="deleteImage(lightbox)" class="col-span-2 py-2 rounded-lg text-xs text-red-400/80 hover:bg-red-500/10 transition">🗑 Delete image</button>
        </div>
      </div>
    </template>
  </aside>
</div>

<!-- ══════════ COOKIE DRAWER ══════════ -->
<div x-show="cookieDrawer" x-cloak class="fixed inset-0 z-50" @click.self="cookieDrawer=false">
  <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
  <aside class="absolute right-0 top-0 h-full w-full max-w-md glass hairline p-6 space-y-4 fadein overflow-y-auto">
    <div class="flex justify-between items-center"><h3 class="font-bold text-white">Import Cookies</h3>
      <button @click="cookieDrawer=false" class="text-zinc-500 hover:text-white text-xl">×</button></div>
    <select x-model="cookieForm.account" class="w-full bg-raise hairline rounded-md px-3 py-2 text-sm text-zinc-200">
      <option value="">Select account…</option>
      <template x-for="a in accounts" :key="a.alias||a.id"><option :value="a.alias||a.id" x-text="a.alias||a.id"></option></template>
    </select>
    <textarea x-model="cookieForm.json" rows="12" placeholder='Paste exported cookies.json here…'
      class="w-full bg-raise hairline rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600"></textarea>
    <button @click="importCookies()" class="w-full py-2.5 rounded-lg bg-glow hover:bg-indigo-500 text-white text-sm font-semibold transition">Validate & Import</button>
    <p class="text-[11px] text-zinc-500">Cookies are written to the account's <code>cookies_file</code> and the profile is marked authenticated. Existing sessions are not interrupted.</p>
  </aside>
</div>

<!-- ══════════ TOASTS ══════════ -->
<div class="fixed bottom-4 right-4 z-[60] space-y-2 w-80">
  <template x-for="t in toasts" :key="t.id">
    <div class="toast-in glass hairline rounded-lg px-4 py-3 text-sm flex items-start gap-2.5 shadow-xl"
         :class="t.kind==='error'&&'border-red-500/50'">
      <span x-text="t.kind==='error'?'⛔':t.kind==='success'?'✅':'ℹ️'"></span>
      <span class="text-zinc-200" x-text="t.msg"></span>
    </div>
  </template>
</div>

<script>
function app(){ return {
  // ── state ──
  view:'gallery', gallery:[], galleryTotal:0, nextCursor:null, galleryLoading:false,
  filter:'all', convFilter:'', accounts:[], chats:[], telemetry:{}, settings:{},
  toasts:[], lightbox:null, zoom:1, pan:{x:0,y:0}, cookieDrawer:false,
  cookieForm:{account:'',json:''}, studio:{prompt:'',t1:'',t2:'',conv:'',showTweaks:false},
  generating:false, progress:{}, wsLive:false, _ws:null,

  // ── lifecycle ──
  async init(){
    await Promise.all([this.loadAccounts(),this.loadChats(),this.loadTelemetry(),this.loadSettings()]);
    this.resetGallery(); await this.loadGallery();
    this.connectWS();
    setInterval(()=>this.loadTelemetry(),15000);
    window.addEventListener('mousemove',e=>{ if(this._panning){this.pan.x+=e.movementX;this.pan.y+=e.movementY;} });
    window.addEventListener('mouseup',()=>this._panning=false);
  },

  // ── helpers ──
  async api(path,opts={}){
    const r = await fetch(path,{headers:{'Content-Type':'application/json'},...opts});
    if(!r.ok) throw new Error((await r.json().catch(()=>({detail:r.statusText}))).detail||r.statusText);
    return r.json();
  },
  toast(msg,kind='info'){ const id=Date.now()+Math.random(); this.toasts.push({id,msg,kind});
    setTimeout(()=>this.toasts=this.toasts.filter(t=>t.id!==id),4200); },
  copy(txt,msg){ navigator.clipboard.writeText(txt||'').then(()=>this.toast(msg,'success')); },
  timeAgo(ts){ if(!ts)return'—'; const s=(Date.now()/1000)-ts;
    if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+'m ago';
    if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; },
  fmtBytes(b){ if(!b)return'—'; const u=['B','KB','MB','GB']; let i=0; while(b>=1024&&i<3){b/=1024;i++} return b.toFixed(1)+' '+u[i]; },
  fmtDur(s){ if(!s)return'—'; const h=Math.floor(s/3600),m=Math.floor(s%3600/60); return h?h+'h '+m+'m':m+'m'; },
  cooldownLeft(a){ const t=a.rate_limited_until||0, d=t-Date.now()/1000;
    return d>0?Math.ceil(d/60)+'m':'—'; },
  statusPill(a){
    if(a.rate_limited_until && a.rate_limited_until>Date.now()/1000)
      return {label:'⏳ '+this.cooldownLeft(a), cls:'bg-amber-500/15 text-amber-300'};
    if(a.is_active) return {label:'🟢 Active & Healthy', cls:'bg-mint/15 text-emerald-300'};
    return {label:'⚪ Standby', cls:'bg-zinc-700/40 text-zinc-400'};
  },
  startPan(){ this._panning=true; },
  closeAll(){ this.lightbox=null; this.cookieDrawer=false; },

  // ── gallery ──
  setFilter(f){ this.filter=f; this.resetGallery(); this.loadGallery(); },
  resetGallery(){ this.gallery=[]; this.nextCursor=null; },
  async loadGallery(){
    if(this.galleryLoading) return; this.galleryLoading=true;
    try{
      const q=new URLSearchParams({filter:this.filter,limit:40});
      if(this.nextCursor)q.set('cursor',this.nextCursor);
      if(this.convFilter)q.set('conversation_id',this.convFilter);
      const p=await this.api('/api/gallery?'+q);
      this.gallery.push(...p.items); this.nextCursor=p.next_cursor; this.galleryTotal=p.total;
    }catch(e){ this.toast('Gallery: '+e.message,'error'); }
    this.galleryLoading=false;
  },
  async openLightbox(img){ this.lightbox=img; this.zoom=1; this.pan={x:0,y:0};
    try{ this.lightbox=await this.api('/api/gallery/'+img.id); }catch(e){} },
  async fav(img){ try{ const r=await this.api(`/api/gallery/${img.id}/favorite`,{method:'POST'});
    img.favorite=r.favorite; if(this.lightbox?.id===img.id)this.lightbox.favorite=r.favorite; }catch(e){this.toast(e.message,'error')} },
  async deleteImage(img){ if(!confirm('Delete this image permanently?'))return;
    try{ await this.api('/api/gallery/'+img.id,{method:'DELETE'});
      this.gallery=this.gallery.filter(g=>g.id!==img.id); this.lightbox=null;
      this.toast('Image deleted','success'); }catch(e){this.toast(e.message,'error')} },
  continueChat(img){ this.studio.conv=img.conversation_id||''; this.studio.prompt=img.prompt||'';
    this.studio.t1=img.tweaked_prompt||''; this.studio.t2=img.tweaked_prompt_2||'';
    this.lightbox=null; this.view='studio'; this.toast('Loaded into Studio — edit & generate'); },

  // ── accounts ──
  async loadAccounts(){ try{ this.accounts=await this.api('/accounts'); }catch(e){this.toast('Accounts: '+e.message,'error')} },
  async switchAccount(a){ try{ await this.api('/accounts/switch',{method:'POST',body:JSON.stringify({account:a.alias||a.id})});
    this.toast('Switched to '+(a.alias||a.id),'success'); await this.loadAccounts(); await this.loadTelemetry();
  }catch(e){this.toast(e.message,'error')} },
  async importCookies(){ if(!this.cookieForm.account||!this.cookieForm.json)return this.toast('Pick account & paste JSON','error');
    try{ await this.api('/api/accounts/cookies',{method:'POST',body:JSON.stringify({account:this.cookieForm.account,cookies_json:this.cookieForm.json})});
      this.toast('Cookies imported for '+this.cookieForm.account,'success');
      this.cookieDrawer=false; this.cookieForm={account:'',json:''}; await this.loadAccounts();
    }catch(e){this.toast('Invalid cookies: '+e.message,'error')} },

  // ── chats ──
  async loadChats(){ try{ this.chats=await this.api('/api/chats'); }catch(e){} },
  async deleteChat(c){ if(!confirm('Delete conversation '+c.conversation_id.slice(0,8)+'…?'))return;
    try{ await this.api('/conversations/'+c.conversation_id,{method:'DELETE'});
      this.chats=this.chats.filter(x=>x.conversation_id!==c.conversation_id);
      this.toast('Chat deleted','success'); }catch(e){this.toast(e.message,'error')} },
  async purgeStale(){ try{ const r=await this.api('/api/chats/purge_stale?older_than_h=24',{method:'POST'});
    this.toast(`Purged ${r.purged} stale chats`,'success'); await this.loadChats(); }catch(e){this.toast(e.message,'error')} },
  filterByChat(c){ this.convFilter=c.conversation_id; this.view='gallery'; this.resetGallery(); this.loadGallery(); },
  studioFromChat(c){ this.studio.conv=c.conversation_id; this.view='studio'; },

  // ── studio ──
  async generate(){
    if(this.generating||!this.studio.prompt.trim())return;
    this.generating=true; this.progress={status:'Submitting to engine…',retry:1,elapsed:0,pct:8};
    const t0=Date.now(); const tick=setInterval(()=>{this.progress.elapsed=Math.round((Date.now()-t0)/1000);this.progress.pct=Math.min(92,this.progress.pct+1.2);},1000);
    try{
      const r=await this.api('/image',{method:'POST',body:JSON.stringify({
        prompt:this.studio.prompt, tweaked_prompt:this.studio.t1||null, tweaked_prompt_2:this.studio.t2||null,
        conversation_id:this.studio.conv||null, timeout_s:300})});
      clearInterval(tick); this.progress={status:'Complete ✓',pct:100,elapsed:Math.round((Date.now()-t0)/1000)};
      this.toast('Image generated via '+r.account_used,'success');
      this.studio.conv=r.conversation_id; // pin continuity
      await new Promise(r2=>setTimeout(r2,900));
      this.resetGallery(); await Promise.all([this.loadGallery(),this.loadChats(),this.loadTelemetry()]);
      this.view='gallery';
    }catch(e){ clearInterval(tick); this.toast('Generation failed: '+e.message,'error'); }
    this.generating=false;
  },

  // ── settings / telemetry ──
  async loadSettings(){ try{ this.settings=await this.api('/api/settings'); }catch(e){} },
  async patchSettings(p){ try{ this.settings=await this.api('/api/settings',{method:'PATCH',body:JSON.stringify(p)});
    this.toast('Settings saved','success'); }catch(e){this.toast(e.message,'error')} },
  async loadTelemetry(){ try{ this.telemetry=await this.api('/api/telemetry');
    if(this.telemetry.settings)this.settings=this.telemetry.settings; }catch(e){} },

  // ── websocket ──
  connectWS(){
    const ws=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/ws/events');
    ws.onopen=()=>this.wsLive=true;
    ws.onclose=()=>{ this.wsLive=false; setTimeout(()=>this.connectWS(),3000); };
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.type==='generation_progress'){ this.progress={...this.progress,retry:m.retry,status:m.status||'Generating…'}; }
      if(m.type==='account_switched'){ this.toast('⚡ Auto-switched to '+m.account); this.loadAccounts(); this.loadTelemetry(); }
      if(m.type==='rate_limited'){ this.toast('⏳ '+m.account+' rate-limited, resets '+m.resets_in,'error'); this.loadAccounts(); }
      if(m.type==='generation_done'&&this.view==='gallery'&&!this.generating){ this.resetGallery(); this.loadGallery(); }
    };
  },
}}
</script>
</body>
</html>
```

---

## 4. Deployment Checklist

1. **Place** `dashboard.html` next to `daemon.py` (path resolved via `Path(__file__).parent`).
2. **Patch `daemon.py`** with the Section-2 code; wire `index_generation()` into your existing `POST /image` success path and `ws_broadcast()` into the retry/failover loop (3 one-line hooks).
3. **Restart container.** Visit `http://host:8465/` — done.

### Design decisions worth noting

- **Self-healing index**: `/api/gallery` auto-indexes orphan PNGs on disk, so all historical images appear immediately even before the sidecar exists.
- **Atomic JSON writes** (`.tmp` + `rename`) prevent corruption if the container is killed mid-write.
- **Cursor pagination** by epoch-ms is stable under concurrent inserts (no offset drift).
- **WebSocket with 3s auto-reconnect** + 15s telemetry polling fallback means the UI is truthful even if the socket drops.
- **Zero lock contention**: all dashboard reads hit small JSON files, never the engine's `_lock` — the UI stays instant even mid-generation.

You now have a Linear-grade command deck riding entirely inside your existing process. 🚀