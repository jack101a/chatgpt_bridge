import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from chatgpt_bridge.characters import CharacterCard
from chatgpt_bridge.llm_client import OpenAICompatibleClient, extract_json

logger = logging.getLogger(__name__)

class StoryboardShot(BaseModel):
    description: str = Field(..., description="Action/Environment + Lighting description framing the character")
    camera_pov: str = Field(..., description="Camera POV description framing the character")
    prompt: str = Field(..., description="Synthesized prompt with character as the primary subject")

class StoryboardPlan(BaseModel):
    shots: List[StoryboardShot] = Field(default_factory=list)

class DirectorEngine:
    def __init__(self, llm_client: OpenAICompatibleClient, base_url: str = "", api_key: str = "", model: str = "gpt-4o"):
        self.llm = llm_client
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def plan_storyboard(self, intent: str, character: CharacterCard, shot_count: int, style_override: Optional[str] = None) -> StoryboardPlan:
        char_name = character.name or "the character"
        vdna = character.visual_dna
        wardrobe = ""
        if character.active_wardrobe_id:
            for w in character.wardrobes:
                if w.id == character.active_wardrobe_id:
                    wardrobe = w.description
                    break
        elif character.wardrobes:
            wardrobe = character.wardrobes[0].description
            
        style = style_override if style_override else (character.style_anchor or "cinematic photography, soft natural lighting")

        system_prompt = f"""You are a master AI Director and Cinematographer.
You are directing a multi-shot visual sequence centered around this specific character:
- Character Name: {char_name}
- Invariant Physical Appearance (Visual DNA): {vdna}
- Wardrobe: {wardrobe}
- Scene Intent: {intent}

CRITICAL DIRECTING DIRECTIVES:
1. THE CHARACTER IS THE SOLE MAIN SUBJECT: {char_name} MUST BE IN THE FOREGROUND/MIDGROUND OF EVERY SINGLE SHOT.
2. ABSOLUTELY NO EMPTY SCENERY, NO DRONE LANDSCAPES WITHOUT {char_name}, AND NO OBJECT-ONLY MACRO SHOTS.
3. Every shot must frame {char_name} from a distinct, dynamic camera angle and POV:
   - Shot 1 (Establishing / Environmental): Wide or full-length shot framing {char_name} inside or within the scene.
   - Shot 2 (Medium / Action): Waist-up or seated dynamic shot focusing on {char_name}'s action, hands, or posture.
   - Shot 3 (Close-up / Portrait POV): Tight intimate portrait on {char_name}'s face, piercing eyes, hair, and expression.
   - Additional Shots: Low-angle profile, over-the-shoulder POV, or 3/4 candid angle framing {char_name}.
4. In each shot's "description": Describe what {char_name} is doing, her body pose, facial expression, and how the lighting sculpts her features.
5. In each shot's "camera_pov": Specify the exact camera angle, lens (e.g. 35mm, 50mm, 85mm portrait), and framing of {char_name}.

Your output must be valid JSON matching:
{{
  "shots": [
    {{
      "camera_pov": "Camera angle, lens, and framing of {char_name}",
      "description": "{char_name}'s pose, expression, and lighting in the scene"
    }}
  ]
}}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Plan exactly {shot_count} shots featuring {char_name} for the scene: {intent}"}
        ]
        
        shots_data = []
        try:
            resp = await self.llm.chat_completion(
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                messages=messages,
                json_mode=True
            )
            json_str = extract_json(resp)
            data = json.loads(json_str)
            shots_data = data.get("shots", [])
        except Exception as e:
            logger.warning("LLM storyboard planning failed (%s); generating deterministic fallback shots", e)
            shots_data = []

        if not shots_data:
            perspectives = [
                (f"wide shot framing {char_name} full-length", f"{char_name} standing in the setting, natural lighting and atmosphere"),
                (f"medium waist-up shot of {char_name}", f"{char_name} seated and engaged in the scene, soft dramatic lighting"),
                (f"intimate 85mm close-up portrait of {char_name}", f"sharp focus on {char_name}'s facial expression and eyes, cinematic depth of field"),
                (f"low-angle cinematic profile shot of {char_name}", f"dramatic perspective emphasizing {char_name}'s posture and expression"),
                (f"over-the-shoulder POV shot facing {char_name}", f"candid perspective capturing {char_name}'s subtle gaze and expression"),
            ]
            for idx in range(shot_count):
                cam_label, desc_mood = perspectives[idx % len(perspectives)]
                shots_data.append({
                    "camera_pov": cam_label,
                    "description": f"{char_name} in {intent}, {desc_mood}",
                })

        shots = []
        for s in shots_data:
            desc = s.get("description", "").strip()
            cam = s.get("camera_pov", "").strip()
            
            # Deterministic Character Anchor Formula:
            # Asserts [Style Anchor], [Camera POV of Character], [Character Name + Visual DNA + Wardrobe], followed by [Action/Pose/Lighting]
            actor_def = f"photorealistic portrait of {char_name}, {vdna}"
            if wardrobe:
                actor_def += f", wearing {wardrobe}"
                
            prompt = f"{style}, {cam}, {actor_def}, {desc}".strip()
            shots.append(StoryboardShot(description=desc, camera_pov=cam, prompt=prompt))
            
        return StoryboardPlan(shots=shots)
