"""Dynamic Data Dictionary, Harmonized Archetypes, and Prompt Compiler for Body Identity Reference Cards."""

from __future__ import annotations

import random
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC BODY DATA DICTIONARY DEFINITION
# ─────────────────────────────────────────────────────────────────────────────

BODY_DICTIONARY: dict[str, Any] = {
    "basics": {
        "title": "1. Character Basics",
        "fields": {
            "character_name": {
                "label": "Character Name",
                "type": "text",
                "default": "Kaya",
                "placeholder": "e.g., Kaya, Freya, Elena, Alex",
            },
            "gender_presentation": {
                "label": "Gender Presentation",
                "type": "single_select",
                "default": "woman",
                "options": [
                    "woman",
                    "man",
                    "feminine person",
                    "masculine person",
                    "androgynous person",
                    "custom",
                ],
            },
            "age_appearance": {
                "label": "Age Appearance",
                "type": "single_select",
                "default": "early 20s",
                "options": [
                    "18–20",
                    "early 20s",
                    "mid-20s",
                    "late 20s",
                    "early 30s",
                    "mid-30s",
                    "40s",
                    "50s+",
                    "custom",
                ],
            },
            "ethnicity_ancestry": {
                "label": "Ethnicity / Ancestry",
                "type": "multi_select",
                "default": ["North Indian / South Asian"],
                "options": [
                    "South Asian",
                    "North Indian",
                    "South Indian",
                    "East Indian",
                    "West Indian",
                    "Indian + East Asian",
                    "Indian + European",
                    "Indian + Middle Eastern",
                    "Indian + Southeast Asian",
                    "East Asian",
                    "Southeast Asian",
                    "Central Asian",
                    "Middle Eastern",
                    "Mediterranean",
                    "Scandinavian / Nordic",
                    "Western European",
                    "Eastern European",
                    "Celtic / Irish",
                    "African",
                    "West African",
                    "East African",
                    "North African",
                    "Latin American",
                    "mixed ancestry",
                    "custom",
                ],
            },
        },
    },
    "height_silhouette": {
        "title": "2. Height & Overall Silhouette",
        "fields": {
            "height_impression": {
                "label": "Height Impression",
                "type": "single_select",
                "default": "average",
                "options": [
                    "petite",
                    "short",
                    "average",
                    "tall",
                    "very tall",
                    "custom",
                ],
            },
            "overall_body_type": {
                "label": "Overall Body Type / Silhouette",
                "type": "single_select",
                "default": "hourglass",
                "options": [
                    "slim",
                    "lean",
                    "soft",
                    "average",
                    "curvy",
                    "hourglass",
                    "pear",
                    "rectangle",
                    "inverted triangle",
                    "athletic",
                    "muscular",
                    "plus-size",
                    "custom",
                ],
            },
            "body_presence": {
                "label": "Body Presence",
                "type": "single_select",
                "default": "soft feminine",
                "options": [
                    "delicate",
                    "soft feminine",
                    "natural",
                    "curvy feminine",
                    "strong",
                    "athletic",
                    "statuesque",
                    "grounded powerful",
                    "custom",
                ],
            },
            "posture": {
                "label": "Posture",
                "type": "single_select",
                "default": "relaxed natural",
                "options": [
                    "relaxed natural",
                    "upright",
                    "confident",
                    "elegant",
                    "casual",
                    "athletic",
                    "custom",
                ],
            },
        },
    },
    "upper_body": {
        "title": "3. Upper Body & Torso",
        "fields": {
            "shoulders": {
                "label": "Shoulders",
                "type": "single_select",
                "default": "soft balanced",
                "options": [
                    "narrow",
                    "soft balanced",
                    "average",
                    "broad",
                    "strong athletic",
                    "delicate sloping",
                    "custom",
                ],
            },
            "chest_bust": {
                "label": "Chest / Bust",
                "type": "single_select",
                "default": "moderate",
                "options": [
                    "small",
                    "moderate",
                    "full",
                    "very full",
                    "prominent",
                    "toned athletic pectorals",
                    "broad muscular chest",
                    "custom",
                ],
            },
            "arms": {
                "label": "Arms",
                "type": "single_select",
                "default": "slender",
                "options": [
                    "slender",
                    "soft",
                    "average",
                    "full",
                    "toned",
                    "muscular",
                    "lean athletic with defined forearm",
                    "custom",
                ],
            },
        },
    },
    "midsection": {
        "title": "4. Waist & Abdomen",
        "fields": {
            "waist": {
                "label": "Waist Definition",
                "type": "single_select",
                "default": "defined",
                "options": [
                    "straight",
                    "softly defined",
                    "defined",
                    "narrow",
                    "very narrow",
                    "tapered athletic",
                    "custom",
                ],
            },
            "abdomen": {
                "label": "Stomach / Abdomen",
                "type": "single_select",
                "default": "gentle lower-belly fullness",
                "options": [
                    "flat natural",
                    "soft",
                    "gentle lower-belly fullness",
                    "moderately full",
                    "rounded",
                    "defined athletic",
                    "subtle vertical midline (linea alba)",
                    "custom",
                ],
            },
        },
    },
    "lower_body": {
        "title": "5. Hips, Lower Body & Legs",
        "fields": {
            "hips_pelvis": {
                "label": "Hips & Pelvis",
                "type": "single_select",
                "default": "rounded",
                "options": [
                    "narrow",
                    "moderate",
                    "rounded",
                    "wide",
                    "very wide",
                    "high-shelf feminine curve",
                    "custom",
                ],
            },
            "lower_body": {
                "label": "Glute / Lower-Body Silhouette",
                "type": "single_select",
                "default": "rounded",
                "options": [
                    "subtle",
                    "rounded",
                    "full",
                    "prominent",
                    "athletic",
                    "generous natural fullness",
                    "custom",
                ],
            },
            "thighs": {
                "label": "Thighs",
                "type": "single_select",
                "default": "soft",
                "options": [
                    "slender",
                    "moderate",
                    "soft",
                    "full",
                    "strong muscular",
                    "athletic quad sweep",
                    "custom",
                ],
            },
            "legs": {
                "label": "Legs & Proportions",
                "type": "single_select",
                "default": "balanced",
                "options": [
                    "short-looking",
                    "balanced",
                    "long-looking",
                    "very long-looking",
                    "slender",
                    "soft",
                    "athletic",
                    "defined calves and neat ankles",
                    "custom",
                ],
            },
        },
    },
    "skin": {
        "title": "6. Skin & Complexion",
        "fields": {
            "tone": {
                "label": "Skin Tone",
                "type": "single_select",
                "default": "medium",
                "options": [
                    "very fair",
                    "fair",
                    "light",
                    "light-medium",
                    "medium",
                    "tan",
                    "deep",
                    "very deep",
                    "custom",
                ],
            },
            "undertone": {
                "label": "Undertone",
                "type": "single_select",
                "default": "golden",
                "options": [
                    "cool",
                    "neutral",
                    "warm",
                    "peach",
                    "pink",
                    "golden",
                    "olive",
                    "red",
                    "custom",
                ],
            },
            "texture": {
                "label": "Skin Texture",
                "type": "single_select",
                "default": "realistic visible pores",
                "options": [
                    "smooth natural",
                    "soft",
                    "realistic visible pores",
                    "slightly textured",
                    "freckled",
                    "weathered",
                    "subtly luminous natural hydration",
                    "custom",
                ],
            },
            "distinctive_features": {
                "label": "Distinctive Skin Features",
                "type": "single_select",
                "default": "subtle beauty marks",
                "options": [
                    "none",
                    "freckles across shoulders",
                    "beauty marks",
                    "moles",
                    "small scars",
                    "birthmark",
                    "subtle pigmentation",
                    "faint stretch marks on hips",
                    "custom",
                ],
            },
        },
    },
    "hair": {
        "title": "7. Hair Styling (Unobstructed Reference)",
        "fields": {
            "length": {
                "label": "Hair Length",
                "type": "single_select",
                "default": "long",
                "options": [
                    "very short",
                    "short",
                    "shoulder length",
                    "long",
                    "very long",
                    "custom",
                ],
            },
            "density": {
                "label": "Hair Density",
                "type": "single_select",
                "default": "thick",
                "options": [
                    "fine",
                    "medium",
                    "thick",
                    "very thick",
                ],
            },
            "texture": {
                "label": "Hair Texture",
                "type": "single_select",
                "default": "wavy",
                "options": [
                    "straight",
                    "slightly wavy",
                    "wavy",
                    "curly",
                    "coily",
                    "custom",
                ],
            },
            "color": {
                "label": "Hair Color",
                "type": "single_select",
                "default": "black",
                "options": [
                    "black",
                    "dark brown",
                    "medium brown",
                    "light brown",
                    "blonde",
                    "red",
                    "auburn",
                    "custom",
                ],
            },
            "distinctive_details": {
                "label": "Hair Arrangement / Details",
                "type": "single_select",
                "default": "pulled back neatly into a low ponytail keeping shoulders and neckline clear",
                "options": [
                    "pulled back neatly into a low ponytail keeping shoulders and neckline clear",
                    "gathered in a high clean bun keeping torso silhouette fully visible",
                    "neatly pinned behind shoulders and back",
                    "short crop fully exposing neck and shoulder contour",
                    "none",
                    "face-framing strands",
                    "highlights",
                    "custom",
                ],
            },
        },
    },
    "reference_clothing": {
        "title": "8. Reference Attire",
        "fields": {
            "style": {
                "label": "Reference Attire Style",
                "type": "single_select",
                "default": "simple fitted tank and shorts",
                "options": [
                    "minimal neutral fitted clothing",
                    "simple fitted tank and shorts",
                    "simple fitted top and leggings",
                    "neutral fitted bodysuit",
                    "matte neutral athletic sports top and bike shorts",
                    "custom",
                ],
            },
            "clothing_rule": {
                "label": "Attire Protocol",
                "type": "text_readonly",
                "default": "Keep clothing minimal, neutral, close-fitting, and non-distracting so the complete body silhouette and proportions remain clearly visible.",
            },
        },
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# HARMONIZED ARCHETYPE PRESETS
# ─────────────────────────────────────────────────────────────────────────────

BODY_ARCHETYPES: dict[str, dict[str, Any]] = {
    "kaya_soft_hourglass": {
        "character_name": "Kaya",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["North Indian / South Asian"],
        "height_impression": "average",
        "overall_body_type": "hourglass",
        "body_presence": "soft feminine",
        "posture": "relaxed natural",
        "shoulders": "soft balanced",
        "chest_bust": "full",
        "arms": "slender",
        "waist": "defined",
        "abdomen": "gentle lower-belly fullness",
        "hips_pelvis": "rounded",
        "lower_body": "rounded",
        "thighs": "soft",
        "legs": "balanced",
        "tone": "medium",
        "undertone": "golden",
        "texture": "realistic visible pores",
        "distinctive_features": "beauty marks",
        "length": "long",
        "density": "thick",
        "texture_hair": "wavy",
        "color": "black",
        "distinctive_details": "pulled back neatly into a low ponytail keeping shoulders and neckline clear",
        "style": "simple fitted tank and shorts",
    },
    "freya_athletic_fit": {
        "character_name": "Freya",
        "gender_presentation": "woman",
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["Scandinavian / Nordic"],
        "height_impression": "tall",
        "overall_body_type": "athletic",
        "body_presence": "athletic",
        "posture": "upright",
        "shoulders": "strong athletic",
        "chest_bust": "moderate",
        "arms": "toned",
        "waist": "tapered athletic",
        "abdomen": "subtle vertical midline (linea alba)",
        "hips_pelvis": "moderate",
        "lower_body": "athletic",
        "thighs": "strong muscular",
        "legs": "long-looking",
        "tone": "fair",
        "undertone": "cool",
        "texture": "realistic visible pores",
        "distinctive_features": "freckles across shoulders",
        "length": "shoulder length",
        "density": "thick",
        "texture_hair": "straight",
        "color": "blonde",
        "distinctive_details": "gathered in a high clean bun keeping torso silhouette fully visible",
        "style": "matte neutral athletic sports top and bike shorts",
    },
    "meiling_petite_curve": {
        "character_name": "Meiling",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["East Asian"],
        "height_impression": "petite",
        "overall_body_type": "slim",
        "body_presence": "delicate",
        "posture": "elegant",
        "shoulders": "delicate sloping",
        "chest_bust": "small",
        "arms": "slender",
        "waist": "narrow",
        "abdomen": "flat natural",
        "hips_pelvis": "moderate",
        "lower_body": "subtle",
        "thighs": "slender",
        "legs": "slender",
        "tone": "light",
        "undertone": "peach",
        "texture": "smooth natural",
        "distinctive_features": "none",
        "length": "long",
        "density": "medium",
        "texture_hair": "straight",
        "color": "black",
        "distinctive_details": "pulled back neatly into a low ponytail keeping shoulders and neckline clear",
        "style": "simple fitted tank and shorts",
    },
    "amina_statuesque_elegance": {
        "character_name": "Amina",
        "gender_presentation": "woman",
        "age_appearance": "late 20s",
        "ethnicity_ancestry": ["West African"],
        "height_impression": "very tall",
        "overall_body_type": "curvy",
        "body_presence": "statuesque",
        "posture": "confident",
        "shoulders": "broad",
        "chest_bust": "moderate",
        "arms": "toned",
        "waist": "narrow",
        "abdomen": "flat natural",
        "hips_pelvis": "wide",
        "lower_body": "full",
        "thighs": "full",
        "legs": "very long-looking",
        "tone": "deep",
        "undertone": "warm",
        "texture": "subtly luminous natural hydration",
        "distinctive_features": "none",
        "length": "short",
        "density": "very thick",
        "texture_hair": "coily",
        "color": "black",
        "distinctive_details": "short crop fully exposing neck and shoulder contour",
        "style": "neutral fitted bodysuit",
    },
    "camila_curvy_radiance": {
        "character_name": "Camila",
        "gender_presentation": "woman",
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["Latin American"],
        "height_impression": "average",
        "overall_body_type": "curvy",
        "body_presence": "curvy feminine",
        "posture": "confident",
        "shoulders": "soft balanced",
        "chest_bust": "full",
        "arms": "soft",
        "waist": "narrow",
        "abdomen": "gentle lower-belly fullness",
        "hips_pelvis": "wide",
        "lower_body": "full",
        "thighs": "full",
        "legs": "balanced",
        "tone": "tan",
        "undertone": "golden",
        "texture": "realistic visible pores",
        "distinctive_features": "beauty marks",
        "length": "long",
        "density": "thick",
        "texture_hair": "wavy",
        "color": "dark brown",
        "distinctive_details": "pulled back neatly into a low ponytail keeping shoulders and neckline clear",
        "style": "simple fitted top and leggings",
    },
    "astrid_slender_minimalist": {
        "character_name": "Astrid",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["Scandinavian / Nordic"],
        "height_impression": "tall",
        "overall_body_type": "lean",
        "body_presence": "natural",
        "posture": "relaxed natural",
        "shoulders": "average",
        "chest_bust": "small",
        "arms": "slender",
        "waist": "softly defined",
        "abdomen": "flat natural",
        "hips_pelvis": "moderate",
        "lower_body": "subtle",
        "thighs": "slender",
        "legs": "long-looking",
        "tone": "fair",
        "undertone": "neutral",
        "texture": "realistic visible pores",
        "distinctive_features": "none",
        "length": "long",
        "density": "fine",
        "texture_hair": "straight",
        "color": "blonde",
        "distinctive_details": "gathered in a high clean bun keeping torso silhouette fully visible",
        "style": "minimal neutral fitted clothing",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# PROMPT COMPILER FOR BODY IDENTITY REFERENCE CARDS
# ─────────────────────────────────────────────────────────────────────────────

def _val(data: dict[str, Any], key: str, fallback: str = "") -> str:
    """Safely extract and format a single or multi-select string value."""
    # Check custom override field first if present
    custom_key = f"{key}_custom"
    if custom_key in data and str(data[custom_key]).strip():
        return str(data[custom_key]).strip()

    val = data.get(key, fallback)
    if val is None:
        return fallback
    if isinstance(val, list):
        filtered = [str(x).strip() for x in val if str(x).strip() and str(x).lower() != "custom"]
        return ", ".join(filtered) if filtered else fallback
    s = str(val).strip()
    if s.lower() == "custom":
        return str(data.get(custom_key, fallback)).strip() or fallback
    return s if s else fallback


def compile_body_card_prompt(data: dict[str, Any]) -> str:
    """Compile dictionary selections into the exact 4:3 BODY IDENTITY REFERENCE CARD prompt."""
    name = _val(data, "character_name", "Kaya")
    gender = _val(data, "gender_presentation", "woman")
    age = _val(data, "age_appearance", "early 20s")
    ethnicity = _val(data, "ethnicity_ancestry", "North Indian / South Asian")

    # Body measurements and silhouette
    height_imp = _val(data, "height_impression", "average")
    body_type = _val(data, "overall_body_type", "hourglass")
    presence = _val(data, "body_presence", "soft feminine")
    posture = _val(data, "posture", "relaxed natural")

    # Upper body
    shoulders = _val(data, "shoulders", "soft balanced")
    chest_bust = _val(data, "chest_bust", "full")
    arms = _val(data, "arms", "slender")

    # Core
    waist = _val(data, "waist", "defined")
    abdomen = _val(data, "abdomen", "gentle lower-belly fullness")

    # Lower body
    hips = _val(data, "hips_pelvis", "rounded")
    lower_body_glute = _val(data, "lower_body", "rounded")
    thighs = _val(data, "thighs", "soft")
    legs = _val(data, "legs", "balanced")

    # Skin
    skin_tone = _val(data, "tone", "medium")
    skin_undertone = _val(data, "undertone", "golden")
    skin_texture = _val(data, "texture", "realistic visible pores")
    distinctive_features = _val(data, "distinctive_features", "")

    # Hair
    hair_length = _val(data, "length", "long")
    hair_density = _val(data, "density", "thick")
    hair_texture = _val(data, "texture_hair", _val(data, "texture", "wavy"))
    hair_color = _val(data, "color", "black")
    hair_details = _val(data, "distinctive_details", "pulled back neatly into a low ponytail keeping shoulders and neckline clear")

    # Clothing
    attire_style = _val(data, "style", "simple fitted tank and shorts")

    # Format descriptors naturally into sentences
    height_desc = f"{height_imp} height impression with balanced skeletal frame"
    body_type_desc = f"{body_type} silhouette with natural human proportions"
    shoulder_desc = f"{shoulders} with clean anatomical definition"
    chest_desc = f"{chest_bust} with natural shape and proportion"
    waist_desc = f"{waist} with a smooth natural indent"
    hips_desc = f"{hips} providing a balanced pelvic contour"
    thighs_desc = f"{thighs} with realistic muscular and soft tissue transition"
    legs_desc = f"{legs} in proportion to the torso, extending down to neutral bare feet or minimal flat soles"
    arms_desc = f"{arms} resting naturally at sides"
    abdomen_desc = f"{abdomen} without unnatural exaggeration"
    glute_desc = f"{lower_body_glute} fullness visible in side and back profiles"
    posture_desc = f"{posture} posture with a {presence} body presence"

    # Distinctive skin line
    skin_distinctive_line = ""
    if distinctive_features and distinctive_features.lower() not in ("none", "clean"):
        skin_distinctive_line = f"Distinctive skin characteristics: {distinctive_features}."

    prompt = f"""Create a high-resolution photorealistic **BODY IDENTITY REFERENCE CARD** for
{name}, a fictional adult {ethnicity} {gender}
in their {age}.

Use a **4:3 landscape image composition** designed specifically as a full-body reference sheet.

At the top center, place only the title:

**BODY IDENTITY REFERENCE CARD**

Below the title, show the SAME person in four consistent full-body views arranged horizontally in four clearly separated panels:

1. front view — label below: **"Front side"**
2. left side profile — label below: **"Left side"**
3. back view — label below: **"Back side"**
4. right side profile — label below: **"Right side"**

Each view must occupy its own **clean rectangular panel with a thin, subtle border**, with equal panel width and consistent spacing. Use a **pure white overall background** and clean white space between the panels.

Keep all four figures at the same body scale, camera distance, vertical alignment, lighting, and rendering quality. Make the complete body clearly visible from head to feet in every view.

Use **minimal, neutral, close-fitting reference attire** ({attire_style}) that keeps the body's natural silhouette and proportions clearly visible. Avoid bulky, oversized, loose, layered, or distracting clothing that obscures the torso, waist, hips, limbs, or overall body shape.

Height impression is {height_desc}.
Overall body type is {body_type_desc}.
Shoulders are {shoulder_desc}.
Chest and bust are {chest_desc}.
Waist is {waist_desc}.
Hips and pelvis are {hips_desc}.
Thighs are {thighs_desc}.
Legs are {legs_desc}.
Arms are {arms_desc}.
Stomach and abdomen have {abdomen_desc}.
Glutes and lower body have {glute_desc}.
Posture and body presence are {posture_desc}.

Their skin is {skin_tone} with {skin_undertone} undertones, {skin_texture}.
{skin_distinctive_line}

Their hair is {hair_length}, {hair_density} density, {hair_texture}, {hair_color}, with {hair_details}.

Keep facial styling minimal and consistent so the reference remains primarily focused on physical identity.

Use consistent soft natural lighting, realistic human anatomy, realistic skin texture, natural body detail, accurate proportions, and photorealistic rendering.

Do not slim, enlarge, or otherwise reshape the body beyond the specified physical description. Do not exaggerate body volume or make the character generally heavier or thinner than intended. Preserve the same natural proportions consistently across all four views.

No artificial symmetry, excessive retouching, plastic skin, stylization, perspective distortion, wide-angle distortion, or unrealistic proportions.

No text anywhere on the image except:

* **"BODY IDENTITY REFERENCE CARD"**
* **"Front side"**
* **"Left side"**
* **"Back side"**
* **"Right side"**

Place each view label neatly below its corresponding panel.

All four views must depict **EXACTLY THE SAME PERSON** with identical body structure, proportions, skin characteristics, height impression, and recognizable physical features.

The side and back views should naturally reveal body depth, shoulder width, torso shape, waist definition, hip structure, limb proportions, and overall silhouette while remaining clearly consistent with the front view."""

    return prompt.strip()


def compile_body_visual_dna(data: dict[str, Any]) -> str:
    """Compile a concise summary of body traits for CharacterCard visual_dna."""
    name = _val(data, "character_name", "Character")
    gender = _val(data, "gender_presentation", "person")
    age = _val(data, "age_appearance", "20s")
    ethnicity = _val(data, "ethnicity_ancestry", "diverse ancestry")

    height = _val(data, "height_impression", "average")
    body_type = _val(data, "overall_body_type", "balanced build")
    bust = _val(data, "chest_bust", "moderate")
    waist = _val(data, "waist", "defined")
    hips = _val(data, "hips_pelvis", "rounded")
    skin = f"{_val(data, 'tone', 'medium')} {_val(data, 'undertone', 'neutral')} skin"

    return (
        f"{name}: Adult {ethnicity} {gender}, {age}. {height} height with {body_type} silhouette. "
        f"{bust} bust/chest, {waist} waist, {hips} hips. {skin}."
    )


def randomize_body(archetype_key: str | None = None) -> dict[str, Any]:
    """Generate a coherent randomized body card data payload."""
    if archetype_key and archetype_key in BODY_ARCHETYPES:
        base = dict(BODY_ARCHETYPES[archetype_key])
        return base

    # Randomly pick an archetype or assemble harmoniously
    chosen_archetype = random.choice(list(BODY_ARCHETYPES.keys()))
    data = dict(BODY_ARCHETYPES[chosen_archetype])

    # Allow slight stochastic variation
    variation_keys = ["posture", "style", "distinctive_details"]
    for k in variation_keys:
        for cat in BODY_DICTIONARY.values():
            if k in cat.get("fields", {}):
                opts = [o for o in cat["fields"][k].get("options", []) if o != "custom"]
                if opts:
                    data[k] = random.choice(opts)

    return data
