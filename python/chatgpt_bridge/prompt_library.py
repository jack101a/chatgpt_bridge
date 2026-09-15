import json
import os
import uuid

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
            # Default path in the same directory or somewhere configurable
            self.db_path = os.path.join(os.path.dirname(__file__), "custom_chips.json")
        else:
            self.db_path = db_path
            
        self._ensure_db()

    def _ensure_db(self):
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
