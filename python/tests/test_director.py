import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from chatgpt_bridge.characters import CharacterCard, WardrobeItem
from chatgpt_bridge.llm_client import OpenAICompatibleClient
from chatgpt_bridge.director import DirectorEngine, StoryboardPlan, StoryboardShot

@pytest.mark.anyio
async def test_director_plan_storyboard():
    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    
    mock_llm.chat_completion.return_value = """
    ```json
    {
      "shots": [
        {
          "description": "Character standing in a dark alley.",
          "camera_pov": "Low angle, wide shot"
        },
        {
          "description": "Character running away, neon lights.",
          "camera_pov": "Tracking shot from behind"
        }
      ]
    }
    ```
    """

    engine = DirectorEngine(mock_llm)
    
    char = CharacterCard(
        name="TestChar",
        visual_dna="Test Visual DNA",
        style_anchor="Test Style",
        wardrobes=[WardrobeItem(name="Default", description="Default Wardrobe")],
        active_wardrobe_id=None
    )
    char.active_wardrobe_id = char.wardrobes[0].id

    plan = await engine.plan_storyboard(
        intent="A thrilling chase sequence",
        character=char,
        shot_count=2
    )

    assert isinstance(plan, StoryboardPlan)
    assert len(plan.shots) == 2
    
    shot1 = plan.shots[0]
    assert "Test Style" in shot1.prompt
    assert "Test Visual DNA" in shot1.prompt
    assert "Default Wardrobe" in shot1.prompt
    assert "Low angle, wide shot" in shot1.prompt
    assert "Character standing in a dark alley" in shot1.prompt
