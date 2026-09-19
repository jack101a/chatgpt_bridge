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
    def __init__(self, llm_client: OpenAICompatibleClient, base_url: str = "", api_key: str = "", model: str = "gpt-4o"):
        self.llm = llm_client
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    def _synthesize_master_prompt_fallback(
        self,
        shot_seed: dict,
        character: Optional[CharacterCard],
        preset: dict,
        aesthetic_key: str,
        intent: str,
        style: str,
        shot_idx: int = 1,
        creative_guidance: Optional[str] = None,
    ) -> str:
        """Deterministic generator assembling a focused, high-signal directorial prompt (~160-240 words)."""
        has_char = character is not None
        if has_char and character.name:
            char_name = character.name
        elif any(k in intent.lower() for k in ["norvic", "novic", "irish", "maeve"]):
            char_name = "Maeve"
        else:
            char_name = "Alina"

        cam_pov = shot_seed.get("camera_pov", "").strip() or "cinematic medium shot"
        desc = shot_seed.get("description", "").strip() or shot_seed.get("action_mood", "").strip() or intent
        action_desc = shot_seed.get("action_mood", "").strip() or desc
        lighting_desc = shot_seed.get("lighting", "").strip() or preset.get("lighting_directive", "Soft directional natural lighting")
        wardrobe_notes = shot_seed.get("wardrobe_notes", "").strip()

        # Clean camera lead
        clean_cam = cam_pov.strip().rstrip(".,")
        if clean_cam.lower().startswith(("a ", "an ", "the ")):
            cam_lead = clean_cam
        else:
            art = "An" if clean_cam[0].lower() in "aeiou" else "A"
            cam_lead = f"{art} {clean_cam}"

        # Detect if this is a scene without a person
        is_person_scene = has_char or any(k in f"{intent} {desc} {creative_guidance or ''}".lower() for k in [
            "woman", "girl", "man", "boy", "person", "character", "protagonist", "maeve", "alina", "peasant", "hero", "model", "face", "portrait"
        ])

        if not is_person_scene:
            scene_text = desc.rstrip(".")
            if intent.lower() not in scene_text.lower():
                scene_text = f"{scene_text}, capturing {intent.rstrip('.')} with vivid atmospheric depth"

            lighting_sentence = f"{lighting_desc.rstrip('.')}, creating rich illumination and balanced shadow contrast across the scene."
            env_sentence = "Volumetric atmospheric depth and tactile environmental textures rendered with authentic clarity."
            optical_sentence = "Crisp optical rendering with realistic depth of field, high visual fidelity, and authentic material surfaces."

            full_prose = f"{cam_lead}. {scene_text}. {lighting_sentence} {env_sentence} {optical_sentence}"
            return clean_and_enhance_prompt(full_prose, add_anti_plastic=False)

        # Extract character data from character_lock JSON if present
        char_data = character.character_lock.get("charData", {}) if (character and character.character_lock) else {}

        # Iris color
        vdna_lower = (character.visual_dna or "").lower() if character else ""
        if char_data.get("eyes"):
            iris_color = char_data.get("eyes").rstrip(".,")
        elif "green" in vdna_lower or "emerald" in vdna_lower:
            iris_color = "clear emerald green"
        elif "hazel" in vdna_lower:
            iris_color = "luminous clear hazel"
        elif "brown" in vdna_lower:
            iris_color = "warm deep amber-brown"
        elif "blue" in vdna_lower:
            iris_color = "clear icy blue-gray"
        elif not has_char and any(k in intent.lower() for k in ["norvic", "novic", "irish", "maeve"]):
            iris_color = "clear luminous emerald-blue"
        else:
            iris_color = "clear light blue"

        # Hair description
        if char_data.get("hair_description"):
            hair_desc = char_data.get("hair_description").rstrip(".,")
            if char_data.get("hair_details"):
                hair_desc += f", with {char_data.get('hair_details').rstrip('.,')}"
        elif "ash-blonde" in vdna_lower or "ash blonde" in vdna_lower:
            hair_desc = "long straight-to-softly-wavy natural ash-blonde hair falling to mid-back"
        elif "blonde" in vdna_lower:
            hair_desc = "long tousled honey-blonde hair falling casually over her shoulders with soft natural waves"
        elif "red" in vdna_lower or "auburn" in vdna_lower:
            hair_desc = "long vibrant auburn hair with subtle copper undertones cascading past her shoulders"
        elif "dark brown" in vdna_lower or "brunette" in vdna_lower:
            hair_desc = "long, sleek, straight dark brown hair with a natural center part, falling past her shoulders"
        elif not has_char and any(k in intent.lower() for k in ["norvic", "novic", "irish", "maeve"]):
            hair_desc = "long thick wavy strawberry-blonde hair with soft natural flyaways cascading over her shoulders"
        else:
            hair_desc = "long hair with natural texture and subtle sheen falling past her shoulders"

        # Wardrobe
        wardrobe = ""
        if character:
            if character.active_wardrobe_id:
                for w in character.wardrobes:
                    if w.id == character.active_wardrobe_id:
                        wardrobe = w.description
                        break
            elif character.wardrobes:
                wardrobe = character.wardrobes[0].description
        if not wardrobe and wardrobe_notes:
            wardrobe = wardrobe_notes
        elif not wardrobe and not has_char and any(k in intent.lower() for k in ["poor", "chores", "cottage", "peasant"]):
            wardrobe = "weathered coarse unbleached linen peasant blouse with frayed edges and a faded rustic skirt"
        elif not wardrobe:
            wardrobe = "simple, elegant casual attire"

        is_poor_norvic = not has_char and any(k in intent.lower() for k in ["norvic", "novic", "irish", "maeve", "cottage", "poor", "peasant", "chores"])
        bust_phrase = "an ultra full round bust and a defined narrow hourglass waist" if any(k in intent.lower() for k in ["bust", "hourglass", "curve", "figure"]) else "graceful feminine proportions"
        heritage_phrase = "Norvic-Irish " if any(k in intent.lower() for k in ["norvic", "novic", "irish", "nordic", "celtic"]) else ""

        if is_poor_norvic:
            subject_desc = (
                f"{char_name}, a breathtakingly beautiful 21-year-old {heritage_phrase}young woman of divine ethereal beauty, "
                f"with sculpted cheekbones, naturally full lips, captivating {iris_color} eyes, {hair_desc}, "
                f"radiant glowing porcelain-pale alabaster skin with delicate faint freckles across her nose and cheeks, and {bust_phrase}"
            )
        elif has_char:
            subject_desc = (
                f"{char_name}, a striking young woman in her early 20s with rare distinctive beauty, "
                f"mesmerizing {iris_color} eyes, {hair_desc}, and radiant, glowing porcelain skin"
            )
        else:
            subject_desc = (
                f"{char_name}, a strikingly beautiful young woman in her early 20s with refined feminine facial proportions, "
                f"captivating {iris_color} eyes, {hair_desc}, sculpted cheekbones, naturally full lips, and radiant, glowing skin"
            )

        # Action description clean-up
        clean_act = action_desc.strip().rstrip(".")
        if clean_act.lower().startswith(char_name.lower() + " "):
            clean_act = clean_act[len(char_name):].strip()
        if clean_act.lower().startswith("is "):
            clean_act = clean_act[3:].strip()

        # Multi-Turn Stability & Delta Protocol (ChatGPT Images 2.5)
        if has_char and shot_idx > 1:
            framing_sentence = (
                f"{cam_lead}. Keep {char_name}'s established facial features, likeness, and visual identity "
                f"consistent with previous frames in this thread. Change camera framing and action: "
                f"{char_name} is {clean_act}."
            )
        else:
            framing_sentence = f"{cam_lead}. {subject_desc} is {clean_act}."

        # 2. Wardrobe & Styling (Dynamically varied phrasing starting with Wearing)
        clean_wardrobe = wardrobe.rstrip(".,")
        if clean_wardrobe.lower().startswith("wearing "):
            clean_wardrobe = clean_wardrobe[8:].strip()
        wardrobe_variants = [
            f"Wearing {clean_wardrobe}, the fabric draping naturally with realistic textile texture and organic movement.",
            f"Wearing {clean_wardrobe}, showing authentic tactile weave and natural folds following physical posture.",
            f"Wearing {clean_wardrobe}, catching the ambient light with crisp fiber detail and clean styling.",
        ]
        wardrobe_sentence = wardrobe_variants[(shot_idx - 1) % len(wardrobe_variants)]

        # 3. Lighting & Environment (Shot-specific, NO storyline dumping)
        shot_is_flash = any(k in f"{cam_pov} {desc}".lower() for k in ["flash", "dark room", "in the dark", "direct flash"])
        if shot_is_flash:
            lighting_sentence = "A harsh direct on-camera xenon flash illuminates her face and form with intense frontal brightness, while the background drops into deep underexposed shadows with a crisp cast shadow."
            env_sentence = "Spontaneous late-night snapshot atmosphere with high contrast and vivid immediacy."
        elif is_poor_norvic or any(k in f"{desc}".lower() for k in ["cottage", "chores", "hearth", "poor", "rustic"]):
            lighting_sentence = f"{lighting_desc.rstrip('.,')}, softly illuminating her facial contours and highlighting the smooth, luminous clarity of her radiant skin."
            env_sentence = "The surrounding space has authentic rustic warmth with tactile domestic textures softly rendered in the background."
        else:
            lighting_sentence = f"{lighting_desc.rstrip('.,')}, casting natural soft shadows and delicate highlight rolloff across her features."
            env_sentence = "The immediate environment is rendered with natural atmospheric depth and authentic physical space."

        # 4. Optics & Anti-Plastic Realism (Aesthetic-adaptive & varied)
        if aesthetic_key == "iphone_selfie":
            optical_variants = [
                "Captured on a front-facing smartphone camera with subtle natural wide-angle perspective and lifelike skin texture showing authentic pores and fine flyaways.",
                "Smartphone camera optics with natural indoor ambient lighting, unretouched skin microtexture, and spontaneous social-media realism.",
            ]
        elif aesthetic_key == "flash_in_the_dark":
            optical_variants = [
                "Punchy point-and-shoot digital flash look with sharp specular highlights along cheekbones, authentic skin pores, and raw unposed spontaneity.",
                "Direct flash snapshot with coarse digital sensor grain, vivid contrast, and natural unretouched skin realism without studio smoothing.",
            ]
        elif aesthetic_key == "vintage_polaroid":
            optical_variants = [
                "Nostalgic instant film rendition with creamy highlight roll-off, delicate vignette at edges, and warm organic emulsion texture.",
                "Vintage square-format instant film snapshot with soft flash, gentle pastel color science, and tactile analog depth.",
            ]
        else:
            optical_variants = [
                "Authentic optical depth of field with restrained contrast, fine film grain, and healthy glowing skin with natural microtexture and dewy warmth.",
                "Natural lens rendering with gentle highlight falloff, realistic eye catchlights, and authentic skin pores completely free of waxy plastic smoothing.",
                "Clean optical clarity and realistic focal depth, rendering soft facial details and lifelike textures without artificial CGI sheen.",
            ]
        optical_sentence = optical_variants[(shot_idx - 1) % len(optical_variants)]

        full_prose = f"{framing_sentence} {wardrobe_sentence} {lighting_sentence} {env_sentence} {optical_sentence}"
        return clean_and_enhance_prompt(full_prose, add_anti_plastic=False)

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
        char_name = character.name if has_char and character.name else "Alina"
        vdna = character.visual_dna if has_char and character.visual_dna else ""

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
            f"- Wardrobe Interaction in this Shot: {wardrobe_notes or 'Appropriate character styling'}\n"
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
                timeout=90.0
            )
            resp_clean = resp.strip()
            # If the response returned JSON or is too short (< 100 words):
            if not resp_clean or resp_clean.startswith("{") or resp_clean.startswith("```json") or len(resp_clean.split()) < 100:
                logger.info(f"Shot {shot_idx} expansion response unsuitable; falling back to deterministic synthesis")
                return self._synthesize_master_prompt_fallback(
                    shot_seed=shot_seed,
                    character=character,
                    preset=preset,
                    aesthetic_key=aesthetic_key,
                    intent=intent,
                    style=style,
                    shot_idx=shot_idx,
                    creative_guidance=creative_guidance,
                )
            return clean_and_enhance_prompt(resp_clean, add_anti_plastic=True)
        except Exception as e:
            logger.warning(f"Shot {shot_idx} expansion LLM call failed ({e}); generating deterministic fallback")
            return self._synthesize_master_prompt_fallback(
                shot_seed=shot_seed,
                character=character,
                preset=preset,
                aesthetic_key=aesthetic_key,
                intent=intent,
                style=style,
                shot_idx=shot_idx,
                creative_guidance=creative_guidance,
            )

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
                timeout=60.0
            )
            json_str = extract_json(resp)
            data = json.loads(json_str)
            shots_data = data.get("shots", [])
            screenplay_handshake = data.get("screenplay_handshake")
        except Exception as e:
            logger.warning("Call 1 (Macro Plan) LLM call failed (%s); generating deterministic macro shot seeds", e)
            shots_data = []

        # ── Deterministic Macro Seed Fallback if Call 1 Failed ────────────────────────
        if not shots_data:
            if not has_char and any(k in intent.lower() for k in ["norvic", "novic", "irish", "maeve"]):
                sname = "Maeve"
                subj = "Maeve, a breathtakingly beautiful 21-year-old Norvic-Irish young woman of divine ethereal beauty, with thick wavy strawberry-blonde hair, luminous clear emerald-blue eyes, radiant glowing porcelain-pale alabaster skin with delicate faint freckles, sculpted cheekbones, and an ultra full round bust with a defined narrow hourglass waist, living in humble rustic poverty"
            else:
                sname = char_name if has_char else "Alina"
                subj = char_name if has_char else "Alina, a striking 23-year-old woman with tousled honey-blonde hair, warm hazel eyes, sculpted cheekbones, and an ample bust with a statuesque hourglass silhouette"

            if any(k in f"{intent} {creative_guidance or ''}".lower() for k in ["chores", "cottage", "poor", "rustic", "house chores"]):
                perspectives = [
                    (f"wide-angle atmospheric 35mm shot framing {sname}", f"{sname} waking gently on a simple straw pallet in a weathered timber cottage, off-white worn linen shift softly draping her hourglass silhouette, delicate collarbone, pale morning window daylight"),
                    (f"waist-up 50mm portrait of {sname} at stone wash basin", f"{sname} cupping cool well water at a rustic granite basin, clear water droplets suspended in morning air and glistening on dewy skin, modest ecru shift dress with frayed linen apron"),
                    (f"full-length 35mm candid perspective framing {sname}", f"{sname} sweeping the worn pine floorboards with a handcrafted straw broom, golden sunbeams catching floating dust motes, focused contemplative half-smile"),
                    (f"low-angle 35mm perspective at fieldstone hearth facing {sname}", f"{sname} placing seasoned oak wood onto glowing embers in the cottage fireplace, warm amber firelight dancing across her collarbones and radiant complexion, sparks drifting upward"),
                    (f"wide-angle atmospheric 24mm framing {sname} in cottage doorway", f"{sname} hanging washed coarse linens on a rustic clothesline, gentle morning breeze catching damp fabric and her strawberry-blonde hair, soft daylight"),
                    (f"candid medium shot of {sname} at rustic pine table", f"{sname} kneading bread dough with flour-dusted hands, genuine contented smile, natural window daylight revealing healthy luminous skin"),
                    (f"intimate eye-level 85mm portrait of {sname}", f"{sname} paused mid-chore, wiping a stray hair from her forehead with the back of her wrist, radiant natural emerald-blue eyes and serene authentic expression"),
                    (f"atmospheric golden-hour portrait of {sname} on cottage doorstep", f"{sname} resting on the weathered timber doorstep holding a simple clay water jug, warm golden hour sunbeams casting rich glow over her silhouette"),
                    (f"candid side-profile 50mm snapshot of {sname}", f"{sname} tending a small herb garden outside the cottage, soft evening twilight, delicate natural freckles and authentic hair flyaways caught in breeze"),
                    (f"cozy candlelit hearthside finale framing {sname}", f"{sname} relaxing peacefully by the warm cottage firelight at the end of the day, authentic gentle smile, soft shadows and serene rustic contentment"),
                ]
            elif aesthetic_key == "iphone_selfie":
                if any(k in f"{intent} {creative_guidance or ''}".lower() for k in ["dark", "flash"]):
                    perspectives = [
                        (f"candid front-facing smartphone camera selfie of {sname}", f"{sname} holding her phone with one arm extended, capturing a playful expression under warm ambient bedroom light"),
                        (f"harsh direct on-camera flash snapshot of {sname} in dark room", f"direct frontal flash illuminating {sname} with intense clarity, deep black background falloff and sharp wall drop-shadow"),
                        (f"candid mirror selfie framing {sname} in reflection", f"{sname} posing casually in front of a mirror holding her smartphone, natural room illumination and lived-in room background"),
                        (f"spontaneous late-night direct flash photo of {sname} in the dark", f"{sname} smiling into the lens, harsh direct flash illuminating her face with deep darkness behind"),
                        (f"high-angle smartphone selfie looking down at {sname}", f"{sname} lounging casually, soft screen glow gently illuminating her natural skin texture and facial features"),
                        (f"low-angle candid phone selfie resting against headboard", f"{sname} relaxing with a playful half-smile, phone screen glow casting soft highlights on cheekbones and neckline"),
                        (f"intimate 24mm wide front camera close-up of {sname}", f"{sname} offering a captivating direct gaze, subtle head tilt, soft bedside lamp bokeh"),
                        (f"wide candid smartphone snapshot of {sname} sitting up on bed", f"{sname} laughing naturally at her phone screen, tousled hair and authentic casual posture"),
                        (f"side-profile smartphone selfie of {sname}", f"{sname} captured candidly from an angle, soft amber rim lighting tracing facial contours and shoulder"),
                        (f"cozy bedtime smartphone selfie finale of {sname}", f"{sname} winding down for the night, holding phone close, authentic sleepy warm smile and dim bedside glow"),
                    ]
                else:
                    perspectives = [
                        (f"candid front-facing smartphone camera selfie of {sname}", f"{sname} holding her phone with one arm extended, capturing a playful teasing expression under warm ambient bedroom light"),
                        (f"candid mirror selfie framing {sname} in reflection", f"{sname} posing casually in front of a mirror holding her smartphone, natural room illumination and lived-in room background"),
                        (f"high-angle smartphone selfie looking down at {sname}", f"{sname} lounging casually on bed, soft screen glow gently illuminating her natural skin texture and facial features"),
                        (f"spontaneous wide 24mm front camera POV of {sname}", f"{sname} laughing candidly at the camera, relaxed posture, visible flyaway hair and authentic smartphone sensor realism"),
                        (f"cozy bedtime smartphone selfie of {sname}", f"{sname} winding down for the night, warm bedside lamp glow casting soft amber tones across her relaxed silhouette"),
                        (f"intimate front camera portrait of {sname}", f"{sname} leaning close to the lens with an amused curious expression, natural window or room light"),
                        (f"candid low-angle phone selfie of {sname}", f"{sname} resting head on folded arm, expressive eyes and authentic skin micro-texture"),
                        (f"dynamic 3/4 front camera snapshot of {sname}", f"{sname} caught mid-reaction, playful asymmetric smile, natural smartphone sensor noise"),
                        (f"candid reflection snapshot of {sname}", f"{sname} adjusting her hair in a mirror reflection, holding phone with casual ease"),
                        (f"warm golden-hour smartphone selfie finale of {sname}", f"{sname} smiling into the phone camera, soft ambient room wrap-around glow and relaxed posture"),
                    ]
            elif aesthetic_key == "flash_in_the_dark":
                perspectives = [
                    (f"harsh direct on-camera xenon flash snapshot of {sname} in dark room", f"direct frontal flash illuminating {sname} with intense clarity, deep black background falloff and sharp wall drop-shadow"),
                    (f"candid Y2K point-and-shoot digicam framing {sname}", f"{sname} smiling playfully under direct burst of flash, glossy highlights on cheekbones and collarbones, vivid saturated contrast"),
                    (f"eye-level disposable camera flash snapshot of {sname}", f"{sname} in spontaneous posture against dark wall, intense direct flash, visible pores and authentic sensor grain"),
                    (f"dynamic low-angle direct flash portrait of {sname}", f"{sname} leaning forward playfully into the flash burst, sharp drop-shadow on the wall behind her, party snapshot energy"),
                    (f"spontaneous late-night direct flash photo of {sname}", f"{sname} caught mid-laugh against pitch-black room backdrop, authentic unposed flash photography with natural skin texture"),
                    (f"candid point-and-shoot close-up of {sname}", f"{sname} looking into lens with direct intense flash, specular corneal catchlights and sharp skin micro-detail"),
                    (f"side-angle direct flash portrait of {sname}", f"{sname} turning head suddenly toward camera flash, stark silhouette contrast against shadows"),
                    (f"high-angle direct flash snapshot of {sname}", f"{sname} seated on floor in dark room, intense flash casting hard shadow on floorboards"),
                    (f"atmospheric wide flash framing {sname} in dim corridor", f"{sname} paused mid-step, direct flash illuminating subject while corridor recedes into black"),
                    (f"spontaneous late-night direct flash finale of {sname}", f"{sname} sharing a parting amused glance under direct flash, raw unretouched party snapshot aesthetic"),
                ]
            elif aesthetic_key == "candid_intimate":
                perspectives = [
                    (f"handheld first-person POV bedroom snapshot of {sname}", f"{sname} lounging lazily on rumpled unmade bedsheets, teasing over-the-shoulder smile, warm amber bedside lamp glow"),
                    (f"intimate eye-level bedside POV of {sname}", f"{sname} leaning close with a soft captivating gaze, gentle wrap-around lamp shadows and natural unretouched skin texture"),
                    (f"candid spontaneous domestic snapshot of {sname}", f"{sname} relaxing casually, natural room low-light, visible microscopic pores, peach fuzz, and lived-in warmth"),
                    (f"first-person cozy morning POV facing {sname}", f"{sname} stretching playfully in bed, soft window daylight mixing with warm domestic indoor ambiance"),
                    (f"close-up intimate bedroom portrait of {sname}", f"{sname} resting chin on hand with a playful teasing glance, shallow natural depth of field and authentic physical presence"),
                    (f"soft morning window-light portrait of {sname}", f"{sname} sipping from a ceramic mug, soft directional daylight illuminating skin texture and flyaway hair"),
                    (f"relaxed sofa lounging POV of {sname}", f"{sname} curled up comfortably, reading or smiling toward viewer, warm domestic atmosphere"),
                    (f"candid kitchen counter snapshot of {sname}", f"{sname} leaning against counter with casual grace, gentle environmental depth of field"),
                    (f"low-angle intimate bedside framing {sname}", f"{sname} resting on elbows looking up, gentle amber rim light on shoulders"),
                    (f"peaceful twilight portrait finale of {sname}", f"{sname} winding down peacefully, soft muted domestic light, authentic calm expression"),
                ]
            elif aesthetic_key == "vintage_polaroid":
                perspectives = [
                    (f"square-format vintage Polaroid instant film of {sname}", f"soft on-camera flash gently illuminating {sname}, creamy pastel tones and mild corner vignette"),
                    (f"candid instant film snapshot of {sname}", f"{sname} in unposed spontaneous moment, authentic chemical emulsion depth and soft focus roll-off"),
                    (f"eye-level instant print framing {sname}", f"{sname} offering a relaxed warm smile, nostalgic analog color science and gentle flash shadows"),
                    (f"intimate square-format instant portrait of {sname}", f"{sname} close to lens, soft organic film grain and tactile retro emulsion texture"),
                    (f"atmospheric vintage instant photo of {sname}", f"{sname} taking in the surroundings, dreamy highlight bloom and authentic analog tones"),
                    (f"sun-drenched vintage instant snapshot of {sname}", f"{sname} outdoors, warm sun flare kissing hair, faded nostalgic hues"),
                    (f"candid retro instant portrait of {sname}", f"{sname} laughing with head tilted, soft analog blur on motion"),
                    (f"moody indoor vintage Polaroid of {sname}", f"{sname} in subdued ambient room light, deep warm shadows and muted contrast"),
                    (f"wide square-format instant framing {sname}", f"{sname} standing casually against weathered wall, nostalgic grain structure"),
                    (f"poetic instant film finale of {sname}", f"{sname} soft contemplative expression, creamy borders and timeless vintage patina"),
                ]
            else:
                perspectives = [
                    (f"wide establishing 35mm shot framing {sname} full-length", f"{sname} arriving into the scene, natural environmental lighting and rich depth"),
                    (f"medium waist-up 50mm shot of {sname}", f"{sname} engaged in the narrative action, candid authentic posture with soft directional light"),
                    (f"intimate 85mm portrait close-up of {sname}", f"sharp focus on {sname}'s facial expression, emotive gaze, and natural skin realism with visible micro-texture"),
                    (f"dynamic 3/4 low-angle framing {sname}", f"{sname} in movement through the scene, cinematic perspective with rim lighting"),
                    (f"atmospheric wide shot of {sname} during golden hour", f"{sname} taking in the surroundings, cinematic warm backlight"),
                    (f"cinematic high-angle medium shot of {sname}", f"{sname} paused in thought, dramatic overhead directional light and rich shadow contrast"),
                    (f"tight macro 100mm portrait of {sname}", f"extreme close-up on {sname}'s eyes and facial micro-texture, tack-sharp focus with buttery depth of field"),
                    (f"cinematic over-the-shoulder POV framing {sname}", f"{sname} reacting to an off-camera element with genuine curiosity, shallow depth"),
                    (f"low-key cinematic chiaroscuro portrait of {sname}", f"{sname} enveloped in dramatic side lighting, deep sculpted facial contours"),
                    (f"cinematic narrative finale framing {sname}", f"{sname} in striking final posture, powerful emotional resonance, cinematic widescreen scope"),
                ]

            if has_char:
                screenplay_handshake = (
                    f"DIRECTOR'S PRODUCTION CONTRACT: {char_name.upper()}\n"
                    f"Narrative Arc: {intent}\n"
                    f"Photographic Aesthetic: {preset['name']} ({style})\n"
                    f"Wardrobe: {wardrobe or 'Signature Attire'}\n\n"
                    f"DIRECTING DIRECTIVE: You are directing a {shot_count}-shot story sequence featuring {char_name} in {preset['name']} aesthetic. "
                    f"Maintain {char_name}'s locked physical likeness and authentic human skin realism across all shots."
                )
            else:
                screenplay_handshake = (
                    f"DIRECTOR'S SCREENPLAY & PRODUCTION CONTRACT (FREEFORM)\n"
                    f"Protagonist Identity: {subj}\n"
                    f"Narrative Arc: {intent}\n"
                    f"Photographic Aesthetic: {preset['name']} ({style})\n"
                    f"Skin Realism Mandate: Radiant, healthy porcelain-pale skin with delicate facial realism, zero synthetic airbrushing or plastic sheen\n"
                    f"Composition Hierarchy: Varied cinematography across all shots (wide establishing, waist-up, low-angle, candid profile, intimate portraits)\n\n"
                    f"CONTINUITY CONTRACT: ChatGPT, acknowledge this screenplay. Lock {sname}'s physical features, "
                    f"hair, and facial identity across all forthcoming shot generation turns in this thread."
                )

            for idx in range(shot_count):
                cam_label, desc_mood = perspectives[idx % len(perspectives)]
                shots_data.append({
                    "shot_number": idx + 1,
                    "camera_pov": cam_label,
                    "description": desc_mood,
                    "action_mood": desc_mood,
                    "lighting": preset.get("lighting_directive", ""),
                    "wardrobe_notes": wardrobe,
                })

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
            if existing_prompt and len(existing_prompt.split()) >= 30 and "{" not in existing_prompt and "[" not in existing_prompt:
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
