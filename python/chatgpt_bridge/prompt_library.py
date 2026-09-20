import json
import os
from pathlib import Path
import uuid

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
DEFAULT_CUSTOM_CHIPS_FILE = STATE_DIR / "custom_chips.json"


class PromptLibrary:
    STANDARD_CATEGORIES = {
        "camera_angles": [
            "wide shot",
            "close-up",
            "macro",
            "drone view",
            "low angle"
        ],
        "lighting": [
            "cinematic lighting",
            "natural light",
            "neon lighting",
            "volumetric lighting",
            "golden hour"
        ],
        "film_styles": [
            "cyberpunk",
            "steampunk",
            "vintage 35mm",
            "polaroid",
            "noir"
        ]
    }

    def __init__(self, db_path=None):
        if db_path is None:
            self.db_path = str(DEFAULT_CUSTOM_CHIPS_FILE)
        else:
            self.db_path = str(db_path)
            
        self._curated_prompts: list[dict] | None = None
        self._taxonomy: dict | None = None
        self._ensure_db()

    def _ensure_db(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        if not os.path.exists(self.db_path):
            with open(self.db_path, "w") as f:
                json.dump([], f)

    def _load_db(self):
        with open(self.db_path, "r") as f:
            return json.load(f)

    def _save_db(self, data):
        with open(self.db_path, "w") as f:
            json.dump(data, f)

    def get_standard_categories(self) -> dict[str, list[str]]:
        return self.STANDARD_CATEGORIES

    def get_custom_chips(self) -> list[dict]:
        return self._load_db()

    def add_custom_chip(self, text: str) -> str:
        data = self._load_db()
        chip_id = str(uuid.uuid4())
        data.append({"id": chip_id, "text": text})
        self._save_db(data)
        return chip_id

    def delete_custom_chip(self, chip_id: str):
        data = self._load_db()
        data = [chip for chip in data if chip["id"] != chip_id]
        self._save_db(data)

    def _load_curated_prompts(self) -> list[dict]:
        if self._curated_prompts is None:
            data_file = Path(__file__).parent / "data" / "curated_prompts.json"
            if data_file.exists():
                with open(data_file, "r", encoding="utf-8") as f:
                    self._curated_prompts = json.load(f).get("prompts", [])
            else:
                self._curated_prompts = []
        return self._curated_prompts

    def _load_taxonomy(self) -> dict:
        if self._taxonomy is None:
            data_file = Path(__file__).parent / "data" / "style_taxonomy.json"
            if data_file.exists():
                with open(data_file, "r", encoding="utf-8") as f:
                    self._taxonomy = json.load(f)
            else:
                self._taxonomy = {"categories": [], "styles": [], "scenes": [], "templates": []}
        return self._taxonomy

    def get_taxonomy(self) -> dict:
        """Return the hierarchical style taxonomy with categories, styles, scenes and templates."""
        return self._load_taxonomy()

    def get_slash_commands(self) -> list[dict]:
        """Return curated slash commands for instant chatbox prompt fusion."""
        data_file = Path(__file__).parent / "data" / "curated_prompts.json"
        if data_file.exists():
            try:
                with open(data_file, "r", encoding="utf-8") as f:
                    return json.load(f).get("slash_commands", [])
            except Exception:
                return []
        return []

    def get_curated_prompts(
        self,
        category: str | None = None,
        style: str | None = None,
        scene: str | None = None,
        source: str | None = None,
        search: str | None = None,
        page: int = 1,
        per_page: int = 24,
    ) -> dict:
        """
        Query curated prompts with multi-tag filtering, keyword search and pagination.
        All original prompt text is preserved verbatim.
        """
        all_prompts = self._load_curated_prompts()
        filtered = all_prompts

        if category and category.strip() and category.lower() != "all":
            c_target = category.strip().lower()
            filtered = [
                p for p in filtered
                if p.get("category", "").lower() == c_target or
                   c_target in p.get("category", "").lower()
            ]

        if style and style.strip() and style.lower() != "all":
            s_target = style.strip().lower()
            filtered = [
                p for p in filtered
                if any(s_target == st.lower() for st in p.get("styles", []))
            ]

        if scene and scene.strip() and scene.lower() != "all":
            sc_target = scene.strip().lower()
            filtered = [
                p for p in filtered
                if any(sc_target == sc.lower() for sc in p.get("scenes", []))
            ]

        if source and source.strip() and source.lower() != "all":
            src_target = source.strip().lower()
            filtered = [
                p for p in filtered
                if p.get("source", "").lower() == src_target
            ]

        if search and search.strip():
            query_terms = [t.lower() for t in search.strip().split() if t.strip()]
            def matches(p):
                text = f"{p.get('title', '')} {p.get('prompt', '')} {p.get('category', '')} {' '.join(p.get('styles', []))} {' '.join(p.get('scenes', []))}".lower()
                return all(term in text for term in query_terms)
            filtered = [p for p in filtered if matches(p)]

        total = len(filtered)
        per_page = max(1, min(per_page, 100))
        page = max(1, page)
        start = (page - 1) * per_page
        end = start + per_page
        pages = (total + per_page - 1) // per_page if total > 0 else 1

        return {
            "prompts": filtered[start:end],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        }

    def get_thumbnail(self, prompt_id: int) -> tuple[bytes, str] | None:
        """
        Get or dynamically generate a compressed WebP thumbnail (max 480x480) for a prompt.
        Caches the WebP file locally in data/thumbnails/{prompt_id}.webp.
        """
        thumbnails_dir = Path(__file__).parent / "data" / "thumbnails"
        thumbnails_dir.mkdir(parents=True, exist_ok=True)
        cached_file = thumbnails_dir / f"{prompt_id}.webp"

        if cached_file.exists():
            return cached_file.read_bytes(), "image/webp"

        # Find prompt to get full_image URL
        all_prompts = self._load_curated_prompts()
        prompt = next((p for p in all_prompts if p["id"] == prompt_id), None)
        if not prompt or not prompt.get("full_image"):
            return None

        full_url = prompt["full_image"]
        try:
            import urllib.request
            import io
            from PIL import Image

            req = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw_data = resp.read()

            img = Image.open(io.BytesIO(raw_data))
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")

            img.thumbnail((480, 480), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=80)
            webp_bytes = buf.getvalue()
            cached_file.write_bytes(webp_bytes)
            return webp_bytes, "image/webp"
        except Exception:
            return None
