import asyncio
import json
import logging
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from chatgpt_bridge.characters import CharacterCard
from chatgpt_bridge.llm_client import OpenAICompatibleClient, extract_json
from chatgpt_bridge.sanitizer import (
    clean_and_enhance_prompt,
    wrap_verbatim_directive,
)

logger = logging.getLogger(__name__)


# ── Aesthetic & Photographic Medium Presets ────────────────────────────────────
AESTHETIC_PRESETS = {
    "iphone_selfie": {
        "name": "iPhone / Smartphone Selfie",
        "style_anchor": "authentic iPhone front-facing camera photography, 24mm wide-angle lens, candid casual lighting, natural smartphone sensor noise, unposed",
        "framing_directive": "Front-facing smartphone camera POV (24mm wide-angle equivalent, arm visibly extending toward bottom of frame, or mirror reflection holding smartphone). STRICTLY FORBID 85mm movie lenses or cinematic camera rigs.",
        "lighting_directive": "Flat, domestic indoor lighting: ambient bedroom vanity light, soft glow from the phone screen illuminating face, or natural room light. STRICTLY FORBID three-point Hollywood studio lighting, dramatic key lights, artificial rim lights, or theatrical chiaroscuro.",
        "imperfections_directive": "Real smartphone camera sensor characteristics: subtle wide-angle perspective distortion at edges, natural phone sensor noise in dimmer indoor light, slight motion blur on moving fingers, unretouched pores, natural flyaways, lived-in casual room (unmade bed, casual background).",
        "aesthetic_formula": "HIGH-FASHION BEAUTY + CANDID SOCIAL-MEDIA ENERGY + EXTREME MACRO PHOTOGRAPHIC REALISM",
        "sensor_notes": "Subtle wide-angle smartphone perspective distortion at edges, natural phone sensor noise in dimmer indoor light, slight motion blur on moving fingers, unretouched pores, natural flyaways.",
        "benchmark": (
            "A candid front-facing iPhone camera selfie of {name} in her bedroom at night. She holds her smartphone with one arm extended toward the bottom of the frame, capturing a playful, teasing expression with a slight head tilt and an alluring half-smile. Her {hair} falls casually over one shoulder with loose flyaway strands catching the soft screen glow. She wears {wardrobe}, the fabric draping naturally across her {bust_or_figure}. The room behind her is cozy and lived-in, illuminated only by a warm bedside lamp casting soft amber tones across rumpled bedsheets and a wooden nightstand. The 24mm smartphone camera creates a natural wide-angle perspective with subtle sensor grain in the dimmer shadows, crisp skin texture showing natural pores and fine facial peach fuzz without any airbrushed smoothing. Authentic, candid, spontaneous social-media snapshot."
        ),
    },
    "flash_in_the_dark": {
        "name": "Flash in the Dark (Digicam / Disposable)",
        "style_anchor": "early 2000s compact digital camera snapshot with harsh direct on-camera flash in a dark room, deep underexposed black background, hard cast shadows, saturated color science",
        "framing_directive": "Direct point-and-shoot compact digital camera (CCD sensor) or 35mm disposable camera with plastic lens. Eye-level or slightly low candid snapshot framing.",
        "lighting_directive": "HARSH DIRECT ON-CAMERA XENON FLASH firing into a pitch-black or dimly lit room. Flat direct frontal illumination on the subject; background completely falls off into deep underexposed darkness (inverse-square law). Hard-edged, sharp black drop-shadow cast directly on the wall behind her. Glossy specular flash highlights on cheekbones, nose, and skin.",
        "imperfections_directive": "Saturated, punchy color rendition, early digital camera sensor noise or coarse film grain, high-contrast flash look, casual spontaneous late-night snapshot energy, unposed and authentic. Optional retro digital date stamp in bright orange in bottom corner.",
        "aesthetic_formula": "Y2K DIGICAM FLASH SNAPSHOT + HIGH-FASHION ALLURE + EXTREME OPTICAL MACRO REALISM",
        "sensor_notes": "Early digital camera sensor noise or coarse film grain, high-contrast flash look, candid late-night party snapshot realism with hard drop-shadows.",
        "benchmark": (
            "A raw, candid Y2K point-and-shoot digicam photograph of {name} standing against a dark bedroom wall late at night. A harsh direct on-camera xenon flash illuminates her face and form with intense frontal brightness, while the dark room behind her drops off into deep, underexposed blackness, casting a sharp, hard-edged dark shadow directly on the wall behind her. She smiles teasingly at the lens with playful energy, her {hair} slightly disheveled with individual locks glowing under the direct burst of flash. She wears {wardrobe}, the material showing crisp highlights and saturated colors. Her porcelain skin catches glossy specular highlights along her cheekbones, nose bridge, and collarbones, with authentic pores and natural skin micro-texture fully visible under the direct flash. Coarse digital sensor grain, vivid contrast, and spontaneous party snapshot realism, completely free of cinematic studio lighting."
        ),
    },
    "candid_intimate": {
        "name": "Candid Teasing Bedroom Snapshot",
        "style_anchor": "intimate candid POV photography, natural warm domestic low-light, handheld spontaneous snapshot",
        "framing_directive": "Handheld intimate first-person POV shot from bed, couch, or floor level as if taken spontaneously by someone in the room. Natural eye-level or intimate close angle.",
        "lighting_directive": "Cozy, low-key domestic warmth: single amber bedside lamp with fabric shade, soft moonlight slipping through blinds, warm intimate shadows pooling in corners. No artificial stage lighting.",
        "imperfections_directive": "Lived-in cozy room, rumpled duvet, messy unmade bed, tangled hair, playful teasing sidelong gaze, relaxed organic physical weight and gravity, authentic unretouched skin.",
        "aesthetic_formula": "INTIMATE BEDROOM SNAPSHOT + CANDID PLAYFUL ALLURE + EXTREME MACRO PHOTOGRAPHIC REALISM",
        "sensor_notes": "Organic 35mm lens behavior, shallow depth of field, natural optical softness at edges, delicate film-like grain in warm low-light.",
        "benchmark": (
            "An intimate, handheld first-person POV photograph capturing {name} lounging lazily on a rumpled unmade bed. She looks over her bare shoulder directly toward the camera with a playful, teasing smile, her {hair} spilling messily across tangled pillows and soft white cotton sheets. She wears {wardrobe}, the soft fabric gathered and creased around her {bust_or_figure}. The room is bathed in the warm, low-key amber glow of a single ceramic bedside lamp, creating soft, intimate shadows that pool in the folds of the duvet and along the curve of her waist. Natural skin texture reveals microscopic pores, delicate freckles, and fine peach fuzz softly catching the warm lamp glow. The composition feels completely spontaneous, candid, and private—an authentic personal snapshot with natural depth, relaxed body language, and domestic warmth."
        ),
    },
    "vintage_polaroid": {
        "name": "Vintage Polaroid / Instant Film",
        "style_anchor": "vintage square-format instant film snapshot with soft on-camera flash, creamy pastel tones, and authentic chemical film emulsion",
        "framing_directive": "Instant film camera, square aspect ratio, candid eye-level snapshot.",
        "lighting_directive": "Soft vintage instant camera flash with gentle illumination and mild vignetting at the corners.",
        "imperfections_directive": "Muted nostalgic color science, soft focus roll-off, organic chemical emulsion artifacts, candid unposed moment.",
        "aesthetic_formula": "VINTAGE POLAROID INSTANT FILM + RAW HUMAN BEAUTY + ANALOG EMULSION REALISM",
        "sensor_notes": "Creamy highlight roll-off, mild corner vignette darkening, organic chemical emulsion artifacts and tactile retro grain.",
        "benchmark": (
            "A vintage Polaroid instant film snapshot of {name}. Captured with square-format framing and a soft built-in flash that gently illuminates her face and upper body. She offers a relaxed, candid smile, her {hair} framing her face in soft retro waves. The colors feature characteristic instant-film pastel warmth with creamy highlight roll-off and mild vignette darkening around the edges. Natural skin texture and authentic unretouched humanity, with nostalgic analog emulsion depth."
        ),
    },
    "cinematic": {
        "name": "Cinematic 35mm Film Still",
        "style_anchor": "authentic 35mm film photography, soft natural directional lighting, high dynamic range",
        "framing_directive": "Cinematic 35mm / 50mm / 85mm lens with shallow depth of field, 70/30 character framing.",
        "lighting_directive": "Soft directional key light, delicate fill, and subtle rim light separating subject from background.",
        "imperfections_directive": "Authentic 35mm film grain, visible microscopic pores, peach fuzz, matte skin finish without waxy smoothing.",
        "aesthetic_formula": "35MM CINEMATIC STILL + EDITORIAL SUPERMODEL BEAUTY + EXTREME MACRO REALISM",
        "sensor_notes": "35mm cinema sensor, restrained micro-contrast, realistic dynamic range, and authentic fine film grain.",
        "benchmark": (
            "A cinematic medium close-up of {name}, standing at the helm of a weather-beaten wooden galleon in the middle of a violent hurricane. Gripping the ship's worn wooden wheel firmly with both hands, posture strong and commanding against the violent motion of the vessel. Naturally wavy {hair} soaked by rain streams dramatically in the wind, with individual strands clinging to face and neck. Wearing deep burgundy velvet coat over white linen shirt with realistic folds and creases. Face displays realistic human skin detail, natural pores, fine peach fuzz, subtle imperfections, moisture from rain, and delicate highlights along cheekbones. Soft natural rim light separates from dark environment. Shallow depth of field, high dynamic range, deep natural shadows, tactile photorealistic rendering."
        ),
    },
}


def detect_aesthetic(intent: str, creative_guidance: Optional[str] = None, style_override: Optional[str] = None) -> str:
    combined = f"{intent} {creative_guidance or ''} {style_override or ''}".lower()
    
    if any(k in combined for k in ["selfie", "iphone", "phone", "mirror selfie", "front camera", "front-facing", "snapchat", "instagram"]):
        return "iphone_selfie"
    if any(k in combined for k in ["flash in the dark", "flash in dark", "in the dark", "dark room", "on-camera flash", "direct flash", "digicam", "disposable camera", "point and shoot", "y2k", "party photo"]):
        return "flash_in_the_dark"
    if any(k in combined for k in ["teasing", "flirty", "candid bedroom", "in bed", "messy bed", "bedroom snapshot", "pov from bed", "intimate snapshot"]):
        return "candid_intimate"
    if any(k in combined for k in ["polaroid", "instax", "instant film"]):
        return "vintage_polaroid"
    if any(k in combined for k in ["cinematic", "movie", "blockbuster", "film still", "anamorphic"]):
        return "cinematic"
    
    if any(k in combined for k in ["chores", "morning", "daily routine", "casual", "relaxing", "cozy"]):
        return "candid_intimate"
    return "cinematic"


class StoryboardShot(BaseModel):
    description: str = Field(..., description="Action/Environment + Lighting description framing the subject")
    camera_pov: str = Field(..., description="Camera POV description and lens framing")
    prompt: str = Field(..., description="Synthesized prompt ready for generation")


class StoryboardPlan(BaseModel):
    screenplay_handshake: Optional[str] = Field(
        default=None,
        description=(
            "Turn 0 Screenplay Handshake priming ChatGPT with the narrative arc, "
            "visual DNA, and cinematography rules before generation turns"
        ),
    )
    shots: List[StoryboardShot] = Field(default_factory=list)


# ── Benchmark Master Prompt (ChatGPT Images 2.5 Gold Standard Exemplar) ────────
MASTER_BENCHMARK_PROMPT = (
    "An intimate eye-level 35mm optical portrait capturing Alina, a striking 21-year-old young woman "
    "with extraordinary facial harmony, luminous clear light blue eyes, and long sleek dark brown hair "
    "falling naturally past her shoulders. She offers a spontaneous, playful half-smile with a subtle head tilt, "
    "her expressive eyes making direct, charismatic contact with the lens. She wears oversized cat-eye glasses "
    "with translucent yellow-honey frames, a fitted dark mocha t-shirt, and a delicate gold paperclip chain necklace "
    "with a tiny gold padlock pendant. Soft directional window light grazes across her features from the side, "
    "creating gentle highlight rolloff along sculpted cheekbones and soft natural shadows. Her skin displays authentic "
    "human texture with healthy dewy radiance and natural micro-warmth, completely free of waxy plastic smoothing or "
    "artificial airbrushing. The background is a warm, minimalist domestic interior softly softened by a shallow f/1.8 "
    "depth of field, with restrained contrast and delicate 35mm photographic grain."
)


# ── System Prompt for Single Shot Expansion (ChatGPT Images 2.5 Engine) ──────
DIRECTOR_SHOT_SYSTEM_PROMPT = """You are an expert AI Visual Director and Cinematographer specializing in ChatGPT Images 2.5 / GPT-Image-2.5.
Your job is to synthesize a compelling, highly atmospheric, detailed image generation prompt for a single shot in rich, natural language prose (~140–220 words).

DIRECTING PRINCIPLES:
1. SHOT-SPECIFIC FOCUS (NO STORYLINE DUMPING):
   - Focus strictly and exclusively on what is visually framed in this exact slice of time: immediate physical action, spontaneous micro-expression, specific camera framing, and local atmospheric lighting.
   - Do NOT include broader storyline summaries, plot synopses, or other scene descriptions in this shot's prompt.

2. DYNAMIC & ORGANIC NATURAL LANGUAGE:
   - Write evocative, flowing descriptive prose with natural sentence rhythm. Avoid robotic comma-separated keyword lists.
   - NEVER copy-paste generic boilerplate clauses across shots. Each prompt must be uniquely crafted for that specific moment with fresh vocabulary and varied observations.

3. CAMERA & FRAMING LEAD:
   - Open directly with the camera perspective, lens framing, and spatial staging (e.g. wide environmental framing, intimate eye-level portrait, candid low-angle profile, over-the-shoulder).

4. SUBJECT BEAUTY & ORGANIC PHYSICALITY:
   - Highlight lifelike facial harmony, expressive gaze, natural hair movement, and healthy glowing radiant skin. Hardship or rustic settings belong exclusively to environment and wardrobe, never unflattering facial skin.
   - Describe attire reacting naturally to movement and environment with realistic folds and drape.

5. ACCURATE LIGHTING & OPTICAL PHYSICS:
   - Detail real light sources, directional shadow falloff, subtle ambient bounce, and honest optical depth of field matching the intended photographic or artistic medium.

Output ONLY the prompt text as a cohesive, vivid prose description (140–220 words). No meta headers, no layer labels, no conversational filler."""

# Retain alias for backwards compatibility
MASTER_12_LAYER_SYSTEM_PROMPT = DIRECTOR_SHOT_SYSTEM_PROMPT

UNIVERSAL_NEGATIVE_CONSTRAINTS = (
    "static expression, blank expression, emotionless face, mannequin pose, catalog pose, "
    "generic beauty, generic influencer face, generic supermodel face, cookie-cutter facial features, "
    "forced smile, repetitive wink, repetitive pout, exaggerated expression, cartoon expression, "
    "childish expression, vulgar expression, distorted mouth, distorted eyes, unnatural facial asymmetry, "
    "plastic skin, wax skin, porcelain skin, airbrushed skin, beauty filter, artificial skin smoothing, "
    "fake pores, repeated pore patterns, painted skin texture, exaggerated peach fuzz, thick facial hair, "
    "CGI, 3D render, digital human, doll face, uncanny face, synthetic eyes, glassy eyes, fake catchlights, "
    "excessive HDR, crunchy sharpening, oversharpened pores, excessive contrast, oversaturated skin, "
    "unrealistic skin detail, sterile fashion campaign, lifeless pose, generic TikTok influencer aesthetic."
)


class DirectorEngine:
    def __init__(
        self,
        llm_client: OpenAICompatibleClient,
        base_url: str = "",
        api_key: str = "",
        model: str = "gpt-4o",
    ):
        self.llm = llm_client
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def _expand_single_shot(
        self,
        shot_seed: dict,
        character: Optional[CharacterCard],
        preset: dict,
        aesthetic_key: str,
        intent: str,
        style: str,
        shot_idx: int,
        total_shots: int,
        creative_guidance: Optional[str] = None,
    ) -> str:
        """Call LLM to expand a shot seed into a focused, high-signal directorial prompt (~140-220 words)."""
        cam_pov = shot_seed.get("camera_pov", "").strip()
        action_mood = shot_seed.get("action_mood") or shot_seed.get("description", "").strip()
        lighting = shot_seed.get("lighting", "").strip() or preset.get("lighting_directive", "")
        wardrobe_notes = shot_seed.get("wardrobe_notes", "").strip()

        has_char = character is not None
        char_name = character.name if has_char and character.name else "the subject"
        vdna = character.visual_dna if has_char and character.visual_dna else ""

        char_wardrobe = ""
        if character:
            if character.active_wardrobe_id:
                for w in character.wardrobes:
                    if w.id == character.active_wardrobe_id:
                        char_wardrobe = w.description
                        break
            elif character.wardrobes:
                char_wardrobe = character.wardrobes[0].description
        wardrobe = wardrobe_notes or char_wardrobe

        # If the seed already has a fully-formed prompt with >= 120 words and no code block JSON, reuse it
        existing_prompt = shot_seed.get("prompt", "").strip()
        if existing_prompt and len(existing_prompt.split()) >= 120 and "{" not in existing_prompt and "[" not in existing_prompt:
            return clean_and_enhance_prompt(existing_prompt, add_anti_plastic=True)

        continuity_directive = ""
        if has_char and shot_idx > 1:
            continuity_directive = (
                f"- Multi-Turn Continuity & Delta: This is Shot {shot_idx} of {total_shots} in an ongoing sequence. "
                f"Declare stability: 'Keep {char_name}'s established facial likeness, features, and visual identity consistent with previous frames in this thread. "
                f"Change camera framing and action: {char_name} is now {action_mood}.'\n"
            )

        user_content = (
            f"Synthesize an evocative, detailed natural language prompt strictly for Shot {shot_idx} of {total_shots} (target: 140-220 words):\n"
            f"- Protagonist Name: {char_name}\n"
            f"- Physical Appearance & Features: {vdna if not has_char else 'Locked established visual identity'}\n"
            f"{continuity_directive}"
            f"- Immediate Frame Action & Posture: {action_mood}\n"
            f"- Wardrobe Interaction in this Shot: {wardrobe or 'Appropriate character styling'}\n"
            f"- Camera Angle & Optical Framing: {cam_pov}\n"
            f"- Lighting & Environmental Dynamics: {lighting}\n"
            f"- Photographic Aesthetic & Medium: {preset['name']} ({style})\n\n"
            f"Directing Directives:\n"
            f"1. Focus STRICTLY on what is visible within this exact camera frame. Do NOT summarize or dump previous or future plot events.\n"
            f"2. Write rich, fluid natural descriptive prose opening directly with camera framing and subject composition.\n"
            f"3. Adapt the optical texture and lighting physics to the {preset['name']} aesthetic ({style}). Do NOT force 35mm cinema film if the aesthetic is a smartphone selfie, flash digicam, or candid.\n"
            f"4. Avoid formulaic buzzwords or canned boilerplate phrases."
        )

        messages = [
            {"role": "system", "content": DIRECTOR_SHOT_SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ]

        try:
            resp = await self.llm.chat_completion(
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                messages=messages,
                temperature=0.7,
                json_mode=False,
                timeout=300.0,
            )
            resp_clean = resp.strip()
            if resp_clean.startswith("{") or resp_clean.startswith("```json"):
                try:
                    pdata = json.loads(extract_json(resp_clean))
                    if isinstance(pdata, dict):
                        if "prompt" in pdata:
                            resp_clean = str(pdata["prompt"]).strip()
                        elif "shots" in pdata and isinstance(pdata["shots"], list) and pdata["shots"]:
                            resp_clean = str(pdata["shots"][0].get("prompt") or pdata["shots"][0].get("description") or "").strip()
                except Exception:
                    pass
            if not resp_clean or len(resp_clean.split()) < 20:
                cam_lead = cam_pov or "Cinematic medium shot"
                desc_text = action_mood or intent
                if intent and intent.lower() not in desc_text.lower():
                    desc_text = f"{desc_text}, capturing {intent}"
                wardrobe_part = f"Wearing {wardrobe}, " if wardrobe else ""
                lighting_part = f"{lighting}. " if lighting else ""
                if has_char:
                    subj_part = f"framing {char_name}. {char_name} is {desc_text}."
                else:
                    subj_part = f"capturing {desc_text}."
                resp_clean = (
                    f"{cam_lead} {subj_part} "
                    f"{wardrobe_part}{lighting_part}"
                    f"Photographed with authentic {preset['name']} color science ({style}), "
                    f"sharp optical clarity, and realistic depth of field."
                )

            return clean_and_enhance_prompt(resp_clean, add_anti_plastic=True)
        except Exception as e:
            logger.error("Shot %d LLM expansion failed: %s", shot_idx, e)
            raise RuntimeError(f"Shot {shot_idx} LLM expansion failed: {e}")


    async def plan_storyboard(
        self,
        intent: str,
        character: Optional[CharacterCard] = None,
        shot_count: int = 5,
        creative_guidance: Optional[str] = None,
        style_override: Optional[str] = None
    ) -> StoryboardPlan:
        has_char = character is not None
        char_name = character.name if character and character.name else "the protagonist"
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

        # Detect aesthetic archetype
        aesthetic_key = detect_aesthetic(intent, creative_guidance, style_override)
        preset = AESTHETIC_PRESETS.get(aesthetic_key, AESTHETIC_PRESETS["cinematic"])

        if style_override and style_override in AESTHETIC_PRESETS:
            preset = AESTHETIC_PRESETS[style_override]
            style = preset["style_anchor"]
        elif style_override:
            style = style_override
        elif character and character.style_anchor:
            style = character.style_anchor
        else:
            style = preset["style_anchor"]

        guidance_text = f"\n- Specific Camera / POVs / Mood Guidance: {creative_guidance}" if creative_guidance else ""

        # ── Step 1: Unified Directorial Plan (1 Single API Call) ───────────────
        continuity_directive = ""
        if has_char:
            continuity_directive = (
                f"- MULTI-TURN CONTINUITY CONTRACT: Shot 1 establishes locked identity reference set. "
                f"For Shots 2..{shot_count}, open with camera framing, then explicitly declare: "
                f"'Keep {char_name}'s established facial features, likeness, and visual identity consistent with previous frames in this thread. "
                f"Change camera framing and action: {char_name} is now...'\n"
            )

        macro_system_prompt = f"""You are an elite AI Visual Director and Storyboard Architect specializing in ChatGPT Images 2.5 / GPT-Image-2.5.
Plan and synthesize a cohesive multi-image story sequence ({shot_count} shots) for this production:
- Protagonist: {char_name} ({vdna or 'Dynamic protagonist'})
- Wardrobe: {wardrobe or 'Signature styling'}
- Narrative Arc: {intent}{guidance_text}
- Photographic Medium & Style: {style} (Aesthetic: {preset['name']})
{continuity_directive}
DIRECTING DIRECTIVES:
1. SHOT-SPECIFIC FOCUS (NO PLOT DUMPING):
   - Each shot's prompt must describe ONLY what is framed in that single slice of time.
   - Never inject the macro plot summary or previous scene history into individual shot prompts.
2. CAMERA & FRAMING FIRST (Lead Anchor):
   - Open every shot's prompt directly with the camera perspective, lens framing, and distance ({preset['framing_directive']}).
   - Vary framing dynamically across shots (establishing wide, candid eye-level, intimate close-up, dynamic low/high angle) to create visual rhythm without forcing Hollywood clichés.
3. SUBJECT HARMONY & NATURAL PHYSICALITY:
   - Highlight lifelike facial harmony, expressive gaze, natural hair movement, and authentic healthy skin texture.
   - Describe natural posture, weight distribution, and attire draping realistically in the environment.
4. LIGHTING & ENVIRONMENT PHYSICS:
   - Match the specific scene setting and aesthetic: {preset['lighting_directive']}.
   - Detail real light sources, shadows, reflections, and atmospheric depth.
5. DYNAMIC NATURAL LANGUAGE & ZERO REPETITIVE BOILERPLATE:
   - Write rich, evocative natural language prose (140–220 words per shot prompt).
   - STRICTLY FORBID repeating the same boilerplate sentences or identical phrasing across shots in the array. Each prompt must have unique vocabulary, distinct sentence structure, and organic flow.
   - Adapt sensor physics and optical grain to the active medium ({preset['name']}).

Return valid JSON in this exact structure:
{{
  "screenplay_handshake": "Narrative Scene Briefing for ChatGPT summarizing the story arc, photographic medium ({preset['name']}), and character focus",
  "shots": [
    {{
      "shot_number": 1,
      "camera_pov": "Exact camera angle, lens mm, and framing of {char_name}",
      "description": "Brief action and scene summary for this specific shot",
      "prompt": "Vivid, cohesive natural language prompt (140–220 words) focused strictly on this shot's framing, subject action, wardrobe, lighting, and medium-authentic optical realism."
    }}
  ]
}}
CRITICAL REQUIREMENT: The 'shots' array MUST contain EXACTLY {shot_count} items, each with a complete, unique 140–220 word 'prompt' tailored specifically to that shot context.
"""

        user_content = (
            f"Direct and plan a {shot_count}-shot storyboard sequence for this narrative: {intent}.\n"
            f"CRITICAL REQUIREMENTS:\n"
            f"1. Generate EXACTLY {shot_count} sequential shots in the 'shots' array.\n"
            f"2. Each shot must have a unique, highly detailed natural language prompt (140-220 words) focused ONLY on what is visually happening in THAT shot.\n"
            f"3. Do NOT repeat stock phrases across prompts. Ensure varied phrasing, dynamic angles, and medium-accurate lighting matching {preset['name']}."
        )
        if creative_guidance:
            user_content += f"\nAdditional creative guidance: {creative_guidance}"

        messages = [
            {"role": "system", "content": macro_system_prompt},
            {"role": "user", "content": user_content}
        ]

        shots_data = []
        screenplay_handshake = None
        try:
            resp = await self.llm.chat_completion(
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                messages=messages,
                json_mode=True,
                timeout=300.0,
            )
            json_str = extract_json(resp)
            data = json.loads(json_str)
            shots_data = data.get("shots", [])
            screenplay_handshake = data.get("screenplay_handshake")
        except Exception as e:
            logger.error("Director Call 1 (Macro Plan) LLM failed: %s", e)
            raise RuntimeError(f"Director LLM failed to generate storyboard plan: {e}")

        if not shots_data:
            raise RuntimeError(f"Director LLM returned 0 storyboard shots for intent: {intent}")

        if not screenplay_handshake:
            if has_char:
                screenplay_handshake = (
                    f"DIRECTOR'S PRODUCTION CONTRACT: {char_name.upper()}\n"
                    f"Scene Arc: {intent}\n"
                    f"Visual Style: {style}\n"
                    f"Maintain established character likeness and natural skin realism across all shots."
                )
            else:
                screenplay_handshake = (
                    f"DIRECTOR'S SCREENPLAY & PRODUCTION CONTRACT (FREEFORM)\n"
                    f"Scene Arc: {intent}\n"
                    f"Visual Style: {style}\n"
                    f"Maintain consistent protagonist appearance, natural skin realism, and 70/30 framing across all shots."
                )

        # ── Step 2: Assemble or Expand Shot Prompts (1-Call Unified Generation) ─
        expanded_results = []
        expansion_coros = []
        expansion_indices = []

        for idx, s in enumerate(shots_data):
            existing_prompt = s.get("prompt", "").strip()
            # If Call 1 already generated a complete prompt (>= 30 words):
            if existing_prompt and len(existing_prompt.split()) >= 15 and "{" not in existing_prompt and "[" not in existing_prompt:
                expanded_results.append(clean_and_enhance_prompt(existing_prompt, add_anti_plastic=False))
            else:
                # Fallback to single shot expansion only if Call 1 didn't include prompt
                expanded_results.append("")
                expansion_indices.append(idx)
                expansion_coros.append(
                    self._expand_single_shot(
                        shot_seed=s,
                        character=character,
                        preset=preset,
                        aesthetic_key=aesthetic_key,
                        intent=intent,
                        style=style,
                        shot_idx=idx + 1,
                        total_shots=len(shots_data),
                        creative_guidance=creative_guidance,
                    )
                )

        if expansion_coros:
            extra_expanded = await asyncio.gather(*expansion_coros)
            for idx, res in zip(expansion_indices, extra_expanded):
                expanded_results[idx] = res

        # ── Step 3: Wrap and Assemble Final Storyboard Shots ────────────────────
        shots = []
        for s, scene_prose in zip(shots_data, expanded_results):
            desc = s.get("description", "").strip() or s.get("action_mood", "").strip()
            cam = s.get("camera_pov", "").strip()

            if has_char:
                prompt = (
                    "Use locked Image from the original identity reference set as the primary character reference. "
                    "Preserve the established identity and physical appearance.\n\n"
                    "Create a new image:\n\n"
                    f"{scene_prose}\n\n"
                    "Only change what is specified for this new image. "
                    "Keep the person's recognizable face, skin, hair, and body proportions consistent with the established reference."
                )
            else:
                prompt = scene_prose

            prompt = wrap_verbatim_directive(prompt)
            shots.append(StoryboardShot(description=desc, camera_pov=cam, prompt=prompt))

        return StoryboardPlan(screenplay_handshake=screenplay_handshake, shots=shots)
