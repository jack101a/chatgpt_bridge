"""Character Studio storage engine, Pydantic models, and session lock manager."""

from __future__ import annotations

from contextlib import contextmanager
import json
import logging
import os
from pathlib import Path
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

    def get_active_wardrobe(self) -> WardrobeItem | None:
        """Return the WardrobeItem matching active_wardrobe_id, or None."""
        if not self.active_wardrobe_id:
            return None
        for item in self.wardrobes:
            if item.id == self.active_wardrobe_id:
                return item
        return None


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
