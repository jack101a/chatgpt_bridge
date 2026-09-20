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

    with pytest.raises(RuntimeError) as exc_info:
        await engine.plan_storyboard(
            intent="Walking through mystical forest",
            character=char,
            shot_count=3
        )
    assert "Provider unreachable" in str(exc_info.value)



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


def test_detect_aesthetic():
    from chatgpt_bridge.director import detect_aesthetic

    assert detect_aesthetic("taking a mirror selfie with my iphone") == "iphone_selfie"
    assert detect_aesthetic("photos taken with flash in the dark room") == "flash_in_the_dark"
    assert detect_aesthetic("y2k digicam point and shoot snapshot") == "flash_in_the_dark"
    assert detect_aesthetic("teasing intimate photo lounging in bed") == "candid_intimate"
    assert detect_aesthetic("vintage polaroid picture") == "vintage_polaroid"
    assert detect_aesthetic("epic cinematic blockbuster movie scene") == "cinematic"


@pytest.mark.anyio
async def test_director_plan_iphone_selfie_aesthetic():
    from chatgpt_bridge.director import DirectorEngine
    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.return_value = """
    {
      "shots": [
        {
          "shot_number": 1,
          "camera_pov": "24mm front-facing smartphone selfie camera",
          "description": "Candid selfie in bedroom",
          "prompt": "A candid front-facing smartphone selfie of the subject in bedroom with natural ambient lighting."
        },
        {
          "shot_number": 2,
          "camera_pov": "Mirror reflection selfie",
          "description": "Posing casually in mirror",
          "prompt": "A candid mirror selfie framing the subject in soft room light."
        }
      ]
    }
    """

    engine = DirectorEngine(mock_llm)
    plan = await engine.plan_storyboard(
        intent="Taking cute iphone selfies in bedroom at night",
        shot_count=2,
    )

    assert len(plan.shots) == 2
    assert any("selfie" in s.camera_pov.lower() or "camera" in s.camera_pov.lower() for s in plan.shots)


@pytest.mark.anyio
async def test_director_plan_flash_in_the_dark_aesthetic():
    from chatgpt_bridge.director import DirectorEngine
    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.return_value = """
    {
      "shots": [
        {
          "shot_number": 1,
          "camera_pov": "Harsh direct on-camera flash",
          "description": "Flash snapshot in dark room",
          "prompt": "A direct on-camera flash photo framing the subject in complete darkness with sharp wall drop-shadow."
        },
        {
          "shot_number": 2,
          "camera_pov": "Point-and-shoot direct flash",
          "description": "Spontaneous late night snapshot",
          "prompt": "A spontaneous late night direct flash photo with high contrast and deep black background falloff."
        }
      ]
    }
    """

    engine = DirectorEngine(mock_llm)
    plan = await engine.plan_storyboard(
        intent="taking flash in the dark photos with old disposable camera",
        shot_count=2,
    )

    assert len(plan.shots) == 2
    assert any("flash" in s.camera_pov.lower() for s in plan.shots)



@pytest.mark.anyio
async def test_director_multi_call_hierarchical_expansion():
    """Verify Call 1 produces macro plan and Calls 2..N expand each shot in parallel."""
    from chatgpt_bridge.director import DirectorEngine, MASTER_BENCHMARK_PROMPT

    mock_llm = AsyncMock(spec=OpenAICompatibleClient)

    # Call 1 returns macro plan JSON; Calls 2 and 3 return expanded master prompts
    macro_json = """
    {
      "screenplay_handshake": "Screenplay Briefing: Alina 2-shot sequence",
      "shots": [
        {
          "shot_number": 1,
          "camera_pov": "24mm front-facing selfie camera",
          "action_mood": "playful half-smile with head tilt",
          "lighting": "ambient bedroom vanity light",
          "wardrobe_notes": "fitted dark mocha t-shirt"
        },
        {
          "shot_number": 2,
          "camera_pov": "mirror reflection holding phone",
          "action_mood": "mischievous glance over shoulder",
          "lighting": "warm bedside lamp glow",
          "wardrobe_notes": "delicate gold padlock necklace"
        }
      ]
    }
    """

    expanded_shot_1 = MASTER_BENCHMARK_PROMPT.replace("clear light blue eyes", "mesmerizing emerald green eyes")
    expanded_shot_2 = MASTER_BENCHMARK_PROMPT.replace("intimate eye-level 35mm optical portrait", "candid bedroom mirror selfie")

    mock_llm.chat_completion.side_effect = [macro_json, expanded_shot_1, expanded_shot_2]

    engine = DirectorEngine(mock_llm)
    plan = await engine.plan_storyboard(
        intent="Alina taking late night bedroom photos",
        character=None,
        shot_count=2,
    )

    assert len(plan.shots) == 2
    # Verify mock was called 3 times: 1 macro plan + 2 expansions
    assert mock_llm.chat_completion.call_count == 3
    assert plan.screenplay_handshake == "Screenplay Briefing: Alina 2-shot sequence"
    assert "emerald green eyes" in plan.shots[0].prompt
    assert "candid bedroom mirror selfie" in plan.shots[1].prompt
    assert 120 <= len(plan.shots[0].prompt.split()) <= 260
    assert 120 <= len(plan.shots[1].prompt.split()) <= 260


@pytest.mark.anyio
async def test_director_no_offline_fallback_on_502():
    """Verify that when the LLM returns 502 Bad Gateway, an explicit error is raised."""
    from chatgpt_bridge.director import DirectorEngine

    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.side_effect = RuntimeError("Endpoint 502 Bad Gateway")

    engine = DirectorEngine(mock_llm)
    with pytest.raises(RuntimeError) as exc_info:
        await engine.plan_storyboard(
            intent="taking candid iphone selfies in bedroom at night",
            shot_count=2,
        )
    assert "502 Bad Gateway" in str(exc_info.value)


@pytest.mark.anyio
async def test_director_multi_turn_stability_and_delta():
    """Verify that recurring character shots (shots > 1) preserve multi-turn character consistency."""
    from chatgpt_bridge.director import DirectorEngine

    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.return_value = """
    {
      "screenplay_handshake": "Continuity contract for Maeve",
      "shots": [
        {
          "shot_number": 1,
          "camera_pov": "Wide-angle 35mm establishing shot",
          "description": "Maeve waking up",
          "prompt": "A wide-angle 35mm establishing shot framing Maeve waking up with soft morning daylight."
        },
        {
          "shot_number": 2,
          "camera_pov": "Medium 50mm shot",
          "description": "Maeve tending fireplace",
          "prompt": "Keep Maeve's established facial features, likeness, and visual identity consistent with previous frames in this thread. Change camera framing and action: Maeve is tending fireplace."
        },
        {
          "shot_number": 3,
          "camera_pov": "Intimate 85mm portrait",
          "description": "Maeve resting",
          "prompt": "Keep Maeve's established facial features, likeness, and visual identity consistent with previous frames in this thread. Change camera framing and action: Maeve is resting quietly."
        }
      ]
    }
    """

    engine = DirectorEngine(mock_llm)
    char = CharacterCard(
        name="Maeve",
        visual_dna="emerald eyes, strawberry blonde hair",
        style_anchor="Cinematic film",
        wardrobes=[WardrobeItem(name="Peasant", description="linen blouse")],
        active_wardrobe_id=None
    )
    char.active_wardrobe_id = char.wardrobes[0].id

    plan = await engine.plan_storyboard(
        intent="Maeve morning chores in cottage",
        character=char,
        shot_count=3,
    )

    assert len(plan.shots) == 3
    assert "Maeve" in plan.shots[0].prompt
    assert "Keep Maeve's established facial features, likeness, and visual identity consistent" in plan.shots[1].prompt
    assert "Change camera framing and action:" in plan.shots[1].prompt
    assert "Keep Maeve's established facial features, likeness, and visual identity consistent" in plan.shots[2].prompt


@pytest.mark.anyio
async def test_director_single_call_unified_generation():
    """Verify that when Call 1 includes full 7-layer prompts, Director executes in exactly 1 API call."""
    from chatgpt_bridge.director import DirectorEngine

    mock_llm = AsyncMock(spec=OpenAICompatibleClient)

    single_call_json = """
    {
      "screenplay_handshake": "Unified 1-Call Screenplay: Alina 2-shot arc",
      "shots": [
        {
          "shot_number": 1,
          "camera_pov": "Wide-angle 24mm establishing shot",
          "description": "Alina waking up in bedroom",
          "prompt": "A wide-angle 24mm establishing shot of Alina, a striking 21-year-old young woman with luminous clear blue eyes and long sleek dark brown hair, waking peacefully on soft linen sheets as golden morning light streams through the curtains, creating gentle highlight rolloff and authentic optical depth without plastic smoothing."
        },
        {
          "shot_number": 2,
          "camera_pov": "Low-angle 35mm floor-level perspective",
          "description": "Alina stepping onto wooden floor",
          "prompt": "A low-angle 35mm floor-level perspective capturing Alina stepping onto warm pine floorboards with relaxed candid grace, soft ambient daylight illuminating her form, displaying realistic 35mm optical grain and healthy radiant skin without synthetic airbrushing."
        }
      ]
    }
    """
    mock_llm.chat_completion.return_value = single_call_json

    engine = DirectorEngine(mock_llm)
    plan = await engine.plan_storyboard(
        intent="Alina morning routine",
        character=None,
        shot_count=2,
    )

    assert len(plan.shots) == 2
    assert mock_llm.chat_completion.call_count == 1
    assert "wide-angle 24mm" in plan.shots[0].prompt.lower()
    assert "low-angle 35mm" in plan.shots[1].prompt.lower()


@pytest.mark.anyio
async def test_director_fails_loudly_without_fallback_data():
    """Verify that when LLM fails, Director raises RuntimeError rather than substituting any hardcoded character or storyline."""
    mock_llm = AsyncMock(spec=OpenAICompatibleClient)
    mock_llm.chat_completion.side_effect = RuntimeError("Provider unreachable")

    engine = DirectorEngine(mock_llm)
    user_prompt = "A very poor but unflawed beauty and gorgeous indian girl in her 20s, natural milky white skin, full round bust, hourglass curve, close-up shot, POV"

    with pytest.raises(RuntimeError) as exc_info:
        await engine.plan_storyboard(
            intent=user_prompt,
            character=None,
            shot_count=3,
        )

    assert "Provider unreachable" in str(exc_info.value)
