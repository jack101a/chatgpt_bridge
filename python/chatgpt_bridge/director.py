import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from chatgpt_bridge.characters import CharacterCard
from chatgpt_bridge.llm_client import OpenAICompatibleClient, extract_json

logger = logging.getLogger(__name__)

class StoryboardShot(BaseModel):
    description: str = Field(..., description="Action/Environment + Lighting description framing the subject")
    camera_pov: str = Field(..., description="Camera POV description and lens framing")
    prompt: str = Field(..., description="Synthesized prompt ready for generation")

class StoryboardPlan(BaseModel):
    shots: List[StoryboardShot] = Field(default_factory=list)

class DirectorEngine:
    def __init__(self, llm_client: OpenAICompatibleClient, base_url: str = "", api_key: str = "", model: str = "gpt-4o"):
        self.llm = llm_client
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def plan_storyboard(
        self,
        intent: str,
        character: Optional[CharacterCard] = None,
        shot_count: int = 5,
        creative_guidance: Optional[str] = None,
        style_override: Optional[str] = None
    ) -> StoryboardPlan:
        has_char = character is not None
        char_name = character.name if character and character.name else "the character"
        vdna = character.visual_dna if character else ""
        wardrobe = ""
        if character:
            if character.active_wardrobe_id:
                for w in character.wardrobes:
                    if w.id == character.active_wardrobe_id:
                        wardrobe = w.description
                        break
            elif character.wardrobes:
                wardrobe = character.wardrobes[0].description

        style = style_override if style_override else (
            character.style_anchor if character and character.style_anchor else "cinematic photography, soft natural lighting"
        )

        guidance_text = f"\n- Cinematography / POVs / Mood Guidance: {creative_guidance}" if creative_guidance else ""

        if has_char:
            system_prompt = f"""You are a master AI Director, Cinematographer, and Storyboard Artist.
You are directing a cohesive multi-image story sequence ({shot_count} shots) centered around this character:
- Character Name: {char_name}
- Invariant Physical Appearance: {vdna}
- Wardrobe: {wardrobe}
- Story / Scene Plot: {intent}{guidance_text}

CRITICAL DIRECTING RULES:
1. THE CHARACTER IS THE MAIN SUBJECT: {char_name} must be featured in EVERY SINGLE SHOT.
2. NARRATIVE PROGRESSION: The {shot_count} shots must follow a clear story progression or scene arc matching the user's plot.
3. DYNAMIC CINEMATOGRAPHY: Vary the camera POV, angle, and framing across shots:
   - Establishing shot (environmental wide or full-length)
   - Medium action / interaction shot (waist-up, seated, or moving)
   - Intimate close-up portrait (sharp focus on face, gaze, expression, and lighting)
   - Candid / Over-the-shoulder POV or dynamic low/high angle
   - Atmospheric climax / finale shot
4. In "description": Describe what {char_name} is doing, emotional expression, posture, and lighting mood.
5. In "camera_pov": State the exact lens/angle framing (e.g. "35mm wide environmental shot", "85mm close-up portrait", "low-angle candid tracking").

Return valid JSON in this exact structure:
{{
  "shots": [
    {{
      "camera_pov": "Camera angle, lens, and framing of {char_name}",
      "description": "{char_name}'s action, pose, expression, and lighting in the scene"
    }}
  ]
}}"""
        else:
            system_prompt = f"""You are a master AI Director and Cinematographer.
You are directing a cohesive multi-image story sequence ({shot_count} shots) for the following scene narrative:
- Story / Scene Plot: {intent}{guidance_text}

CRITICAL DIRECTING RULES:
1. NARRATIVE PROGRESSION: The {shot_count} shots must build a coherent visual story matching the scene plot.
2. DYNAMIC CINEMATOGRAPHY: Every shot must use distinct camera angles, lenses, framing, and lighting.
3. In "description": Describe the subject action, environment, and atmosphere.
4. In "camera_pov": State the exact lens and angle framing.

Return valid JSON in this exact structure:
{{
  "shots": [
    {{
      "camera_pov": "Camera angle, lens, and framing",
      "description": "Scene details, subject action, and lighting"
    }}
  ]
}}"""

        user_content = f"Direct and plan exactly {shot_count} sequential storyboard shots for this story: {intent}"
        if creative_guidance:
            user_content += f"\nAdditional directing instructions: {creative_guidance}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
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
            if has_char:
                perspectives = [
                    (f"wide establishing 35mm shot framing {char_name} full-length", f"{char_name} arriving into the scene, natural environmental lighting and rich depth"),
                    (f"medium waist-up 50mm shot of {char_name}", f"{char_name} engaged in the narrative action, candid authentic posture with soft directional light"),
                    (f"intimate 85mm portrait close-up of {char_name}", f"sharp focus on {char_name}'s facial expression, emotive gaze, and natural skin realism"),
                    (f"dynamic 3/4 low-angle angle framing {char_name}", f"{char_name} in movement through the scene, cinematic perspective with rim lighting"),
                    (f"over-the-shoulder POV shot facing {char_name}", f"candid conversational perspective capturing {char_name}'s subtle expression"),
                    (f"atmospheric wide shot of {char_name} during golden hour", f"{char_name} taking in the surroundings, cinematic warm backlight"),
                ]
            else:
                perspectives = [
                    ("wide establishing cinematic shot", f"introductory scene setting for {intent}, rich environmental depth"),
                    ("medium dynamic focal shot", f"central subject action in {intent}, natural lighting and composition"),
                    ("intimate detailed close-up shot", f"textured details, expressive mood, and shallow depth of field"),
                    ("low-angle cinematic perspective", f"dramatic scale and dynamic framing of {intent}"),
                    ("atmospheric wide finale shot", f"climactic visual scene with evocative lighting"),
                ]

            for idx in range(shot_count):
                cam_label, desc_mood = perspectives[idx % len(perspectives)]
                shots_data.append({
                    "camera_pov": cam_label,
                    "description": f"{desc_mood} ({intent})",
                })

        shots = []
        for s in shots_data:
            desc = s.get("description", "").strip()
            cam = s.get("camera_pov", "").strip()

            if has_char:
                # Clean Recurring Generation Prompt Format:
                delta_lines = [
                    "Use Image 1 from the original identity reference set as the primary character reference. Preserve the established identity and physical appearance.",
                    "",
                    "Create a new image:",
                    "",
                    f"[SCENE]: {intent}",
                ]
                if wardrobe:
                    delta_lines.append(f"[OUTFIT]: {wardrobe}")
                if cam:
                    delta_lines.append(f"[CAMERA & FRAMING]: {cam}")
                if desc:
                    delta_lines.append(f"[ACTION & LIGHTING]: {desc}")
                delta_lines.append("")
                delta_lines.append(
                    "Only change what is specified for this new image. Keep the person's recognizable face, skin, hair, and body proportions consistent with the established reference."
                )
            else:
                delta_lines = [
                    f"{style}." if style else "Cinematic photorealistic composition.",
                    f"[SCENE]: {intent}",
                ]
                if cam:
                    delta_lines.append(f"[CAMERA & FRAMING]: {cam}")
                if desc:
                    delta_lines.append(f"[ACTION & LIGHTING]: {desc}")

            prompt = "\n".join(delta_lines)
            shots.append(StoryboardShot(description=desc, camera_pov=cam, prompt=prompt))

        return StoryboardPlan(shots=shots)
