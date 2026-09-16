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
    assert "Use locked Image from the original identity reference set as the primary character reference." in shot1.prompt
    assert "Preserve the established identity and physical appearance." in shot1.prompt
    assert "Create a new image:" in shot1.prompt
    assert "Only change what is specified for this new image." in shot1.prompt
    assert "Test Visual DNA" not in shot1.prompt
    assert "Wearing Default Wardrobe" in shot1.prompt
    assert "Low angle, wide shot" in shot1.prompt
    assert "Character standing in a dark alley" in shot1.prompt


@pytest.mark.anyio
async def test_director_plan_storyboard_fallback_on_llm_failure():
    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.side_effect = RuntimeError("Provider unreachable")

    engine = DirectorEngine(mock_llm)
    char = CharacterCard(
        name="FallbackHero",
        visual_dna="emerald eyes, raven hair",
        style_anchor="Cinematic film",
        wardrobes=[WardrobeItem(name="Armor", description="silver plate armor")],
        active_wardrobe_id=None
    )
    char.active_wardrobe_id = char.wardrobes[0].id

    plan = await engine.plan_storyboard(
        intent="Walking through mystical forest",
        character=char,
        shot_count=3
    )

    assert isinstance(plan, StoryboardPlan)
    assert len(plan.shots) == 3
    for shot in plan.shots:
        assert "Use locked Image from the original identity reference set as the primary character reference." in shot.prompt
        assert "Preserve the established identity and physical appearance." in shot.prompt
        assert "Create a new image:" in shot.prompt
        assert "Only change what is specified for this new image." in shot.prompt
        assert "emerald eyes, raven hair" not in shot.prompt
        assert "Wearing silver plate armor" in shot.prompt
        assert len(shot.camera_pov) > 0


@pytest.mark.anyio
async def test_director_plan_no_character_with_creative_guidance():
    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.return_value = """
    {
      "shots": [
        {
          "description": "Dramatic sunset over futuristic metropolis with glowing flying vehicles",
          "camera_pov": "Wide cinematic anamorphic lens, high altitude skyline shot"
        }
      ]
    }
    """
    engine = DirectorEngine(mock_llm)
    plan = await engine.plan_storyboard(
        intent="Sci-fi metropolis at dusk",
        character=None,
        shot_count=1,
        creative_guidance="High altitude, anamorphic lens, cyberpunk aesthetic"
    )

    assert isinstance(plan, StoryboardPlan)
    assert len(plan.shots) == 1
    shot = plan.shots[0]
    assert "Sci-fi metropolis at dusk" in shot.prompt
    assert "Wide cinematic anamorphic lens" in shot.camera_pov

