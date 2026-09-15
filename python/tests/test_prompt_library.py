import pytest
import os
from chatgpt_bridge.prompt_library import PromptLibrary

def test_get_standard_categories():
    lib = PromptLibrary()
    categories = lib.get_standard_categories()
    assert isinstance(categories, dict)
    assert "camera_angles" in categories
    assert "lighting" in categories
    assert "film_styles" in categories
    
    assert isinstance(categories["camera_angles"], list)
    assert len(categories["camera_angles"]) > 0

def test_custom_chips_crud(tmp_path):
    # Use a temporary file for the database/storage
    db_path = str(tmp_path / "custom_chips.json")
    lib = PromptLibrary(db_path=db_path)
    
    # Should start empty or with existing
    initial_chips = lib.get_custom_chips()
    assert isinstance(initial_chips, list)
    assert len(initial_chips) == 0
    
    # Add a chip
    chip_id = lib.add_custom_chip("Masterpiece, highest quality")
    
    new_chips = lib.get_custom_chips()
    assert len(new_chips) == 1
    
    # Find the chip
    found = next((c for c in new_chips if c["id"] == chip_id), None)
    assert found is not None
    assert found["text"] == "Masterpiece, highest quality"
    
    # Delete the chip
    lib.delete_custom_chip(chip_id)
    
    final_chips = lib.get_custom_chips()
    assert len(final_chips) == 0
