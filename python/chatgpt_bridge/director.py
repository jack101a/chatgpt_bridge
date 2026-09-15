import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from chatgpt_bridge.characters import CharacterCard
from chatgpt_bridge.llm_client import OpenAICompatibleClient, extract_json

logger = logging.getLogger(__name__)

class StoryboardShot(BaseModel):
    description: str = Field(..., description="Action/Environment + Lighting description")
    camera_pov: str = Field(..., description="Camera POV description")
    prompt: str = Field(..., description="Synthesized prompt using the Deterministic Anchor Formula")

class StoryboardPlan(BaseModel):
    shots: List[StoryboardShot] = Field(default_factory=list)

class DirectorEngine:
    def __init__(self, llm_client: OpenAICompatibleClient, base_url: str = "", api_key: str = "", model: str = "gpt-4o"):
        self.llm = llm_client
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def plan_storyboard(self, intent: str, character: CharacterCard, shot_count: int, style_override: Optional[str] = None) -> StoryboardPlan:
        # Deterministic Anchor Formula: [Style] + [Visual DNA] + [Wardrobe] + [Camera POV] + [Action/Environment] + [Lighting]
        
        system_prompt = f"""You are an AI Director. Plan a storyboard of exactly {shot_count} shots.
Intent: {intent}
Your output must be JSON matching:
{{
  "shots": [
    {{
      "description": "...",
      "camera_pov": "..."
    }}
  ]
}}
"""
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": f"Plan {shot_count} shots for {intent}"}]
        
        resp = await self.llm.chat_completion(
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model,
            messages=messages,
            json_mode=True
        )
        
        json_str = extract_json(resp)
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            data = {"shots": []}
            
        shots = []
        style = style_override if style_override else character.style_anchor
        vdna = character.visual_dna
        wardrobe = ""
        if character.active_wardrobe_id:
            for w in character.wardrobes:
                if w.id == character.active_wardrobe_id:
                    wardrobe = w.description
                    break

        for s in data.get("shots", []):
            desc = s.get("description", "")
            cam = s.get("camera_pov", "")
            
            prompt = f"{style} {vdna} {wardrobe} {cam} {desc}".strip()
            shots.append(StoryboardShot(description=desc, camera_pov=cam, prompt=prompt))
            
        return StoryboardPlan(shots=shots)
