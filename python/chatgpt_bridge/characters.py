"""Character Studio storage engine, Pydantic models, and session lock manager."""

from __future__ import annotations

from contextlib import contextmanager
import json
import logging
import os
from pathlib import Path
import re
import time
from typing import Any
import uuid

from pydantic import BaseModel, Field, field_validator

try:
    import fcntl
    HAS_FCNTL = True
except ImportError:  # pragma: no cover
    HAS_FCNTL = False

log = logging.getLogger("chatgpt_bridge.characters")

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
DEFAULT_CHARACTERS_FILE = STATE_DIR / "characters.json"


class WardrobeItem(BaseModel):
    """An outfit or wardrobe variation for a character."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str = Field(..., description="Short name of the outfit or attire")
    description: str = Field(..., description="Detailed visual description of clothing, accessories, footwear")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Wardrobe name cannot be empty")
        return s

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Wardrobe description cannot be empty")
        return s


def repair_json_string(raw: str) -> dict[str, Any] | None:
    """Safely parse JSON strings with trailing commas, markdown fences, or minor syntax issues."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    # Strip trailing commas before } or ]
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except Exception:
        try:
            relaxed = re.sub(r"(\w+)\s*:", r'"\1":', cleaned)
            relaxed = re.sub(r"'([^']*)'", r'"\1"', relaxed)
            relaxed = re.sub(r",\s*([}\]])", r"\1", relaxed)
            data = json.loads(relaxed)
            return data if isinstance(data, dict) else None
        except Exception:
            return None


class CharacterCard(BaseModel):
    """Full character profile containing Visual DNA, style anchor, and wardrobe items."""

    id: str = Field(default_factory=lambda: f"char_{uuid.uuid4().hex[:8]}")
    name: str = Field(..., description="Name of the character")
    tagline: str = Field(default="", description="Catchphrase, role, or brief summary")
    visual_dna: str = Field(..., description="Immutable physical traits: face, eyes, hair, skin, height, body type")
    persona: str = Field(default="", description="Personality, mannerisms, tone, and behavioral traits")
    style_anchor: str = Field(default="", description="Default film/camera/lighting anchor style for this character")
    wardrobes: list[WardrobeItem] = Field(default_factory=list, description="Available outfits for this character")
    active_wardrobe_id: str | None = Field(default=None, description="Currently selected wardrobe outfit ID")
    avatar_image_id: str | None = Field(default=None, description="Gallery image ID used as character avatar portrait")
    face_lock_image_id: str | None = Field(default=None, description="Image ID of the Face Identity Reference Card (Image 1)")
    body_lock_image_id: str | None = Field(default=None, description="Image ID of the Body Reference Card (Image 2)")
    expression_lock_image_id: str | None = Field(default=None, description="Image ID of the Expression Reference Card (Image 3)")
    character_lock: dict[str, Any] | None = Field(default=None, description="Full structured character lock JSON")
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Character name cannot be empty")
        return s

    @field_validator("visual_dna")
    @classmethod
    def validate_visual_dna(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Character visual_dna cannot be empty")
        return s

    @field_validator("character_lock", mode="before")
    @classmethod
    def validate_character_lock(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, str):
            parsed = repair_json_string(v)
            if parsed is not None:
                return parsed
            try:
                return json.loads(v)
            except Exception:
                return None
        if isinstance(v, dict):
            return v
        return None

    def get_active_wardrobe(self) -> WardrobeItem | None:
        """Return the WardrobeItem matching active_wardrobe_id, or None."""
        if not self.active_wardrobe_id:
            return None
        for item in self.wardrobes:
            if item.id == self.active_wardrobe_id:
                return item
        return None

    def get_reference_card_paths(self, images_dir: Path | str | None = None) -> list[Path]:
        """Return list of existing Path objects for the character's reference cards."""
        base_dir = Path(images_dir).expanduser().resolve() if images_dir else (STATE_DIR / "images").expanduser().resolve()
        paths: list[Path] = []
        for card_id in (self.face_lock_image_id, self.body_lock_image_id, self.expression_lock_image_id):
            if not card_id:
                continue
            clean_id = str(card_id).strip()
            if clean_id.startswith("/images/"):
                clean_id = clean_id[len("/images/"):]
            elif clean_id.startswith("images/"):
                clean_id = clean_id[len("images/"):]
            p = base_dir / clean_id
            if not p.exists() and not clean_id.endswith(".png"):
                p = base_dir / f"{clean_id}.png"
            if p.exists() and p not in paths:
                paths.append(p)
            elif Path(card_id).exists() and Path(card_id) not in paths:
                paths.append(Path(card_id))
        return paths

    def build_character_lock_dict(self) -> dict[str, Any]:
        """Build compact physical specification JSON following the 3-pillar character lock schema."""
        char_data: dict[str, Any] = {}
        raw_lock = self.character_lock
        if isinstance(raw_lock, str):
            parsed = repair_json_string(raw_lock)
            if parsed:
                raw_lock = parsed

        if isinstance(raw_lock, dict):
            if "character_lock" in raw_lock and isinstance(raw_lock["character_lock"], dict):
                inner = raw_lock["character_lock"]
                if "physical_identity" in inner:
                    return raw_lock
            if "charData" in raw_lock and isinstance(raw_lock["charData"], dict):
                char_data = raw_lock["charData"]
            elif "physical_identity" in raw_lock:
                return {
                    "character_lock": {
                        "references": {
                            "image_1": "FACE_LOCK — primary facial identity reference.",
                            "image_2": "BODY_LOCK — primary body and proportion reference.",
                            "image_3": "EXPRESSION_LOCK — primary expression and facial realism reference.",
                        },
                        "physical_identity": raw_lock["physical_identity"],
                        "lock_rule": self.character_lock.get(
                            "lock_rule",
                            (
                                f"Preserve {self.name} as the same person across generations. "
                                "Image 1 controls facial identity, Image 2 controls body proportions, "
                                "and Image 3 controls expression realism. Do not redesign, beautify, "
                                "age, de-age, or alter these physical characteristics unless explicitly instructed."
                            ),
                        ),
                    }
                }

        face_shape = char_data.get("face_shape") or char_data.get("face_structure") or ""
        eye_size = char_data.get("eye_size") or ""
        eye_color = char_data.get("eye_color") or ""
        eyes = f"{eye_size} {eye_color}".strip() or char_data.get("eyes") or ""
        brow_shape = char_data.get("brow_shape") or ""
        brow_color = char_data.get("brow_color") or ""
        brows = f"{brow_shape} {brow_color}".strip() or char_data.get("eyebrows") or ""
        nose = char_data.get("nose") or ""
        cheeks = char_data.get("cheeks") or ""
        if not cheeks and "cheeks" in face_shape.lower():
            cheeks = "full soft cheeks"
        lip_shape = char_data.get("lip_shape") or ""
        lip_color = char_data.get("lip_color") or ""
        lips = f"{lip_shape} {lip_color}".strip() or char_data.get("lips") or ""
        distinctive_features = char_data.get("makeup") or char_data.get("distinctive_features") or ""

        skin_tone = char_data.get("skin_tone") or char_data.get("skin_tone_undertone") or ""
        skin_undertone = char_data.get("skin_undertone") or ""
        skin_texture = char_data.get("skin_texture") or ""
        skin_finish = char_data.get("finish") or ("soft, silky, naturally luminous" if "luminous" in (skin_tone + skin_texture + skin_undertone).lower() else "")

        hair_desc = char_data.get("hair_description") or ""
        hair_color = char_data.get("hair_color") or ""
        if not hair_color:
            if "black" in hair_desc.lower():
                hair_color = "dark brown to black" if "dark brown" in hair_desc.lower() else "jet black"
            elif "blonde" in hair_desc.lower():
                hair_color = "ash-blonde" if "ash" in hair_desc.lower() else "blonde"
            elif "auburn" in hair_desc.lower() or "copper" in hair_desc.lower():
                hair_color = "copper-strawberry auburn"
        hair_length = char_data.get("hair_length") or ("long" if "long" in hair_desc.lower() else "shoulder-length" if "shoulder" in hair_desc.lower() else "")
        hair_texture = char_data.get("hair_texture") or hair_desc
        hair_details = char_data.get("hair_details") or ""

        silhouette = char_data.get("silhouette") or char_data.get("presence_silhouette") or ""
        build = char_data.get("physique") or ""
        proportions = char_data.get("proportions_limbs") or ""
        abdomen = char_data.get("abdomen") or ""

        bust = (
            char_data.get("bust")
            or ("very heavy prominent natural bust" if any(k in proportions.lower() for k in ("heavy", "prominent", "big natural", "ultra")) else "natural firm bust")
        )
        waist = char_data.get("waist") or ("narrow and clearly defined" if any(k in proportions.lower() for k in ("defined", "narrow", "tiny")) else "naturally defined")
        hips = char_data.get("hips") or ("wide and rounded" if any(k in proportions.lower() for k in ("wide", "round", "curv")) else "naturally proportioned")
        thighs = char_data.get("thighs") or ("full and soft" if any(k in proportions.lower() for k in ("full", "soft")) else "toned")
        legs = char_data.get("legs") or char_data.get("limbs") or ("long-looking with natural feminine shape" if "legs" in proportions.lower() else "naturally proportioned")
        arms = char_data.get("arms") or ("soft with natural fullness" if "arms" in proportions.lower() else "naturally proportioned")
        shoulders = char_data.get("shoulders") or ("soft balanced feminine shoulders" if "shoulders" in proportions.lower() else "balanced")

        if not face_shape and not build:
            face_shape = self.visual_dna
            skin_tone = "natural human tone with realistic micro-texture"
            build = "natural proportionate build"

        return {
            "character_lock": {
                "references": {
                    "image_1": "FACE_LOCK — primary facial identity reference.",
                    "image_2": "BODY_LOCK — primary body and proportion reference.",
                    "image_3": "EXPRESSION_LOCK — primary expression and facial realism reference.",
                },
                "physical_identity": {
                    "face": {
                        "shape": face_shape,
                        "eyes": eyes,
                        "brows": brows,
                        "nose": nose,
                        "cheeks": cheeks,
                        "lips": lips,
                        "distinctive_features": distinctive_features,
                    },
                    "skin": {
                        "tone": skin_tone,
                        "undertone": skin_undertone,
                        "texture": skin_texture,
                        "finish": skin_finish,
                    },
                    "hair": {
                        "color": hair_color,
                        "length": hair_length,
                        "texture": hair_texture,
                        "distinctive_features": hair_details,
                    },
                    "body": {
                        "build": build,
                        "silhouette": silhouette,
                        "shoulders": shoulders,
                        "chest_bust": bust,
                        "waist": waist,
                        "hips": hips,
                        "thighs": thighs,
                        "legs": legs,
                        "arms": arms,
                        "abdomen": abdomen,
                    },
                },
                "lock_rule": (
                    f"Preserve {self.name} as the same person across generations. "
                    "Image 1 controls facial identity, Image 2 controls body proportions, "
                    "and Image 3 controls expression realism. Do not redesign, beautify, "
                    "age, de-age, or alter these physical characteristics unless explicitly instructed."
                ),
            }
        }

    def build_contract_handshake_prompt(self) -> str:
        """Format the Turn 0 Identity Lock prompt: pure compact JSON with the 3 reference images."""
        lock_dict = self.build_character_lock_dict()
        return json.dumps(lock_dict, indent=2, ensure_ascii=False)

    def compile_delta_prompt(
        self,
        scene: str,
        outfit: str = "",
        pose: str = "",
        expression: str = "",
        camera: str = "",
        lighting: str = "",
        background: str = "",
        style_override: str = "",
    ) -> str:
        """Compile a clean recurring generation prompt in full natural language without bracket tags."""
        parts = []
        if camera.strip():
            parts.append(camera.strip().rstrip(".,") + ".")
        if scene.strip():
            parts.append(scene.strip().rstrip(".,") + ".")
        active_outfit = outfit.strip()
        if not active_outfit:
            wardrobe = self.get_active_wardrobe()
            if wardrobe:
                active_outfit = wardrobe.description
        if active_outfit:
            parts.append(f"Wearing {active_outfit.rstrip('.,')}.")
        if pose.strip():
            parts.append(pose.strip().rstrip(".,") + ".")
        if expression.strip():
            parts.append(expression.strip().rstrip(".,") + ".")
        if lighting.strip():
            parts.append(f"Lighting is {lighting.strip().rstrip('.,')}.")
        if background.strip():
            parts.append(f"Background features {background.strip().rstrip('.,')}.")

        full_prompt = " ".join(parts).strip()
        if not full_prompt:
            full_prompt = scene.strip() or "In the scene."

        return (
            "Use locked Image from the original identity reference set as the primary character reference. "
            "Preserve the established identity and physical appearance.\n\n"
            "Create a new image:\n\n"
            f"{full_prompt}\n\n"
            "Only change what is specified for this new image. "
            "Keep the person's recognizable face, skin, hair, and body proportions consistent with the established reference."
        )


class DeltaPromptRequest(BaseModel):
    character_id: str = Field(..., description="Character ID to compile delta for")
    scene: str = Field(..., description="Scene action, location, and environment")
    outfit: str = Field(default="", description="Clothing and accessories (defaults to active wardrobe if empty)")
    pose: str = Field(default="", description="Body posture, gesture, action")
    expression: str = Field(default="", description="Facial expression, gaze")
    camera: str = Field(default="", description="Camera angle, lens, framing")
    lighting: str = Field(default="", description="Lighting setup and mood")
    background: str = Field(default="", description="Atmosphere and background details")
    style_override: str = Field(default="", description="Optional style override")


class DeltaPromptResponse(BaseModel):
    character_id: str
    character_name: str
    compiled_prompt: str


class CharacterListResponse(BaseModel):
    """API response envelope for character listing and active lock status."""

    characters: list[CharacterCard] = Field(default_factory=list)
    active_character_id: str | None = None
    active_character: CharacterCard | None = None


class CharacterManager:
    """Manages character storage, persistence with file locks, and active lock state."""

    def __init__(
        self,
        file_path: Path | str | None = None,
        state_dir: Path | str | None = None,
    ) -> None:
        if file_path is not None:
            self.file_path = Path(file_path).expanduser().resolve()
        elif state_dir is not None:
            self.file_path = (Path(state_dir).expanduser().resolve()) / "characters.json"
        else:
            self.file_path = DEFAULT_CHARACTERS_FILE.expanduser().resolve()

        self.lock_path = self.file_path.with_suffix(".lock")

    @contextmanager
    def _file_lock(self):
        """Cross-process and cross-thread file lock."""
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.lock_path, "w", encoding="utf-8") as lf:
            if HAS_FCNTL:
                fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                if HAS_FCNTL:
                    try:
                        fcntl.flock(lf.fileno(), fcntl.LOCK_UN)
                    except OSError:
                        pass

    def _load(self) -> tuple[dict[str, CharacterCard], str | None]:
        """Load character mapping and active_character_id from file."""
        if not self.file_path.exists():
            return {}, None

        try:
            content = self.file_path.read_text(encoding="utf-8")
            data = json.loads(content)
        except Exception as e:
            log.warning("Failed to parse characters JSON (%s): %s", self.file_path, e)
            return {}, None

        active_id: str | None = None
        characters: dict[str, CharacterCard] = {}

        if isinstance(data, dict):
            active_id = data.get("active_character_id")
            raw_chars = data.get("characters", [])
            if isinstance(raw_chars, list):
                for item in raw_chars:
                    try:
                        card = CharacterCard.model_validate(item)
                        characters[card.id] = card
                    except Exception as err:
                        log.warning("Skipping invalid character entry: %s", err)
            elif isinstance(raw_chars, dict):
                for k, item in raw_chars.items():
                    try:
                        card = CharacterCard.model_validate(item)
                        characters[card.id] = card
                    except Exception as err:
                        log.warning("Skipping invalid character entry (%s): %s", k, err)
        elif isinstance(data, list):
            for item in data:
                try:
                    card = CharacterCard.model_validate(item)
                    characters[card.id] = card
                except Exception as err:
                    log.warning("Skipping invalid character entry: %s", err)

        # Validate that active_id still points to an existing character
        if active_id and active_id not in characters:
            active_id = None

        return characters, active_id

    def _save(self, characters: dict[str, CharacterCard], active_character_id: str | None) -> None:
        """Atomically persist characters and active lock state to JSON file."""
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "active_character_id": active_character_id,
            "characters": [c.model_dump() for c in characters.values()],
        }
        tmp_file = self.file_path.with_suffix(".tmp")
        tmp_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp_file.replace(self.file_path)

    def get_all(self) -> list[CharacterCard]:
        """Return all characters ordered by creation date."""
        with self._file_lock():
            characters, _ = self._load()
            return list(characters.values())

    def get(self, character_id: str) -> CharacterCard | None:
        """Retrieve a specific character by ID."""
        with self._file_lock():
            characters, _ = self._load()
            return characters.get(character_id)

    get_character = get

    def create(self, card_or_data: CharacterCard | dict[str, Any]) -> CharacterCard:
        """Create a new character card and persist it."""
        if isinstance(card_or_data, dict):
            card = CharacterCard.model_validate(card_or_data)
        else:
            card = card_or_data

        with self._file_lock():
            characters, active_id = self._load()
            characters[card.id] = card
            self._save(characters, active_id)
            return card

    def update(self, character_id: str, updates: dict[str, Any] | CharacterCard) -> CharacterCard:
        """Update fields of an existing character card."""
        with self._file_lock():
            characters, active_id = self._load()
            if character_id not in characters:
                raise KeyError(f"Character '{character_id}' not found")

            existing = characters[character_id]
            if isinstance(updates, CharacterCard):
                update_dict = updates.model_dump(exclude={"id", "created_at"})
            else:
                update_dict = {k: v for k, v in updates.items() if k not in ("id", "created_at")}

            update_dict["updated_at"] = time.time()
            data = existing.model_dump()
            data.update(update_dict)
            updated_card = CharacterCard.model_validate(data)

            characters[character_id] = updated_card
            self._save(characters, active_id)
            return updated_card

    def delete(self, character_id: str) -> bool:
        """Delete a character by ID. Unsets active lock if active."""
        with self._file_lock():
            characters, active_id = self._load()
            if character_id not in characters:
                return False

            del characters[character_id]
            if active_id == character_id:
                active_id = None

            self._save(characters, active_id)
            return True

    def get_active_character_id(self) -> str | None:
        """Return active locked character ID, or None."""
        with self._file_lock():
            _, active_id = self._load()
            return active_id

    def get_active_character(self) -> CharacterCard | None:
        """Return the active CharacterCard, or None if none locked."""
        with self._file_lock():
            characters, active_id = self._load()
            if active_id:
                return characters.get(active_id)
            return None

    def set_active_character(self, character_id: str | None) -> str | None:
        """Set or unset the active character. If character_id is not None, validates existence."""
        with self._file_lock():
            characters, _ = self._load()
            if character_id is not None and character_id not in characters:
                raise ValueError(f"Character '{character_id}' not found")

            self._save(characters, character_id)
            return character_id

    def lock_character(self, character_id: str | None = None, toggle: bool = False) -> str | None:
        """Lock character into session.

        If toggle is True and character_id is already active, unlocks it (sets to None).
        If character_id is None, unlocks.
        """
        with self._file_lock():
            characters, active_id = self._load()
            if character_id is None:
                self._save(characters, None)
                return None

            if character_id not in characters:
                raise ValueError(f"Character '{character_id}' not found")

            if toggle and active_id == character_id:
                new_active = None
            else:
                new_active = character_id

            self._save(characters, new_active)
            return new_active

    def add_wardrobe(self, character_id: str, item_or_data: WardrobeItem | dict[str, Any]) -> WardrobeItem:
        """Add a wardrobe item to an existing character."""
        if isinstance(item_or_data, dict):
            item = WardrobeItem.model_validate(item_or_data)
        else:
            item = item_or_data

        with self._file_lock():
            characters, active_id = self._load()
            if character_id not in characters:
                raise KeyError(f"Character '{character_id}' not found")

            card = characters[character_id]
            card.wardrobes.append(item)
            card.updated_at = time.time()
            self._save(characters, active_id)
            return item

    def remove_wardrobe(self, character_id: str, wardrobe_id: str) -> bool:
        """Remove a wardrobe item from a character."""
        with self._file_lock():
            characters, active_id = self._load()
            if character_id not in characters:
                raise KeyError(f"Character '{character_id}' not found")

            card = characters[character_id]
            initial_count = len(card.wardrobes)
            card.wardrobes = [w for w in card.wardrobes if w.id != wardrobe_id]
            if len(card.wardrobes) == initial_count:
                return False

            if card.active_wardrobe_id == wardrobe_id:
                card.active_wardrobe_id = None

            card.updated_at = time.time()
            self._save(characters, active_id)
            return True

    def set_active_wardrobe(self, character_id: str, wardrobe_id: str | None) -> CharacterCard:
        """Set the active wardrobe outfit on a character."""
        with self._file_lock():
            characters, active_id = self._load()
            if character_id not in characters:
                raise KeyError(f"Character '{character_id}' not found")

            card = characters[character_id]
            if wardrobe_id is not None:
                exists = any(w.id == wardrobe_id for w in card.wardrobes)
                if not exists:
                    raise ValueError(f"Wardrobe '{wardrobe_id}' not found on character '{character_id}'")

            card.active_wardrobe_id = wardrobe_id
            card.updated_at = time.time()
            self._save(characters, active_id)
            return card

    def get_reference_card_paths(self, character_id: str, images_dir: Path | str | None = None) -> list[Path]:
        """Resolve and return the existing reference card file paths for a character."""
        card = self.get(character_id)
        if not card:
            return []
        return card.get_reference_card_paths(images_dir=images_dir)
