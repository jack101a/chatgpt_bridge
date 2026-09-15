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
                "default": "mid-20s",
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
                "default": ["Indian"],
                "options": [
                    "Indian",
                    "South Asian",
                    "North Indian",
                    "South Indian",
                    "East Indian",
                    "West Indian",
                    "Indian + East Asian",
                    "Indian + European",
                    "Indian + Middle Eastern",
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
                "label": "Height Impression / Presence",
                "type": "single_select",
                "default": "tall-looking",
                "options": [
                    "tall-looking",
                    "petite",
                    "short",
                    "average",
                    "tall",
                    "very tall",
                    "statuesque",
                    "custom",
                ],
            },
            "overall_body_type": {
                "label": "Overall Body Silhouette",
                "type": "single_select",
                "default": "dramatic curvy hourglass",
                "options": [
                    "dramatic curvy hourglass",
                    "hourglass",
                    "soft curvy",
                    "pear",
                    "athletic",
                    "lean",
                    "slim",
                    "rectangle",
                    "inverted triangle",
                    "plus-size",
                    "custom",
                ],
            },
            "body_presence": {
                "label": "Presence Impression",
                "type": "single_select",
                "default": "feminine presence",
                "options": [
                    "feminine presence",
                    "soft feminine",
                    "curvy feminine",
                    "natural presence",
                    "athletic presence",
                    "statuesque presence",
                    "strong presence",
                    "custom",
                ],
            },
            "posture": {
                "label": "Standing Posture",
                "type": "single_select",
                "default": "Neutral relaxed standing posture",
                "options": [
                    "Neutral relaxed standing posture",
                    "relaxed natural",
                    "upright confident",
                    "poised elegant",
                    "casual everyday",
                    "athletic ready",
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
                "default": "soft balanced shoulders",
                "options": [
                    "soft balanced shoulders",
                    "narrow soft shoulders",
                    "average natural shoulders",
                    "broad shoulders",
                    "strong athletic shoulders",
                    "delicate sloping shoulders",
                    "custom",
                ],
            },
            "chest_bust": {
                "label": "Chest / Bust",
                "type": "single_select",
                "default": "a very prominent natural bust",
                "options": [
                    "a very prominent natural bust",
                    "a full natural bust",
                    "a moderate natural bust",
                    "a small delicate bust",
                    "prominent rounded bust",
                    "toned athletic pectorals",
                    "broad muscular chest",
                    "custom",
                ],
            },
            "arms": {
                "label": "Arms",
                "type": "single_select",
                "default": "soft naturally full arms",
                "options": [
                    "soft naturally full arms",
                    "slender feminine arms",
                    "soft natural arms",
                    "average toned arms",
                    "lean defined athletic arms",
                    "muscular arms",
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
                "default": "clearly narrow defined waist",
                "options": [
                    "clearly narrow defined waist",
                    "narrow defined waist",
                    "softly defined waist",
                    "straight waist",
                    "very narrow cinched waist",
                    "tapered athletic waist",
                    "custom",
                ],
            },
            "abdomen": {
                "label": "Abdomen Softness / Definition",
                "type": "single_select",
                "default": "natural gentle lower-belly softness",
                "options": [
                    "natural gentle lower-belly softness",
                    "flat natural stomach",
                    "gentle lower-belly fullness",
                    "soft rounded abdomen",
                    "moderately full natural abdomen",
                    "defined athletic core",
                    "custom",
                ],
            },
            "abdomen_exclusions": {
                "label": "Abdomen Muscularity Rule",
                "type": "single_select",
                "default": "without visible abdominal definition or athletic muscularity",
                "options": [
                    "without visible abdominal definition or athletic muscularity",
                    "without muscular definition",
                    "with subtle vertical core line (linea alba)",
                    "with defined six-pack abdominals",
                    "custom",
                ],
            },
        },
    },
    "lower_body": {
        "title": "5. Hips, Thighs & Legs",
        "fields": {
            "hips_pelvis": {
                "label": "Hips & Pelvis",
                "type": "single_select",
                "default": "wide rounded hips",
                "options": [
                    "wide rounded hips",
                    "rounded feminine hips",
                    "moderate natural hips",
                    "narrow compact hips",
                    "very wide voluptuous hips",
                    "high-shelf feminine curve",
                    "custom",
                ],
            },
            "thighs": {
                "label": "Thighs",
                "type": "single_select",
                "default": "full soft thighs",
                "options": [
                    "full soft thighs",
                    "soft natural thighs",
                    "slender thighs",
                    "moderate balanced thighs",
                    "strong muscular thighs",
                    "athletic quad sweep",
                    "custom",
                ],
            },
            "legs": {
                "label": "Legs & Proportions",
                "type": "single_select",
                "default": "long-looking feminine legs",
                "options": [
                    "long-looking feminine legs",
                    "balanced natural legs",
                    "long slender legs",
                    "very long statuesque legs",
                    "compact grounded legs",
                    "athletic shapely legs",
                    "custom",
                ],
            },
            "lower_body": {
                "label": "Glute Profile",
                "type": "single_select",
                "default": "rounded",
                "options": [
                    "rounded",
                    "subtle",
                    "full prominent",
                    "athletic lifted",
                    "generous natural fullness",
                    "custom",
                ],
            },
        },
    },
    "overall_physique": {
        "title": "6. Overall Physique & Build",
        "fields": {
            "physique_descriptors": {
                "label": "Physique Character",
                "type": "single_select",
                "default": "soft, plush, curvy, feminine, and naturally proportioned",
                "options": [
                    "soft, plush, curvy, feminine, and naturally proportioned",
                    "toned, athletic, lean, and balanced",
                    "slender, delicate, fine-boned, and graceful",
                    "voluptuous, full-figured, and generous",
                    "muscular, athletic, and powerful",
                    "custom",
                ],
            },
            "physique_exclusions": {
                "label": "Physique Negative Exclusions",
                "type": "single_select",
                "default": "not muscular or bodybuilder-like",
                "options": [
                    "not muscular or bodybuilder-like",
                    "without excessive leanness or visible veins",
                    "without artificial bodybuilder hypertrophy",
                    "without exaggerated proportions",
                    "custom",
                ],
            },
        },
    },
    "skin": {
        "title": "7. Skin & Complexion",
        "fields": {
            "tone": {
                "label": "Skin Tone",
                "type": "single_select",
                "default": "bright natural milky-white",
                "options": [
                    "bright natural milky-white",
                    "fair",
                    "porcelain",
                    "light ivory",
                    "light-medium",
                    "medium warm honey",
                    "golden olive",
                    "tan",
                    "caramel",
                    "deep espresso",
                    "custom",
                ],
            },
            "undertone": {
                "label": "Undertone",
                "type": "single_select",
                "default": "subtle peach-pink warmth",
                "options": [
                    "subtle peach-pink warmth",
                    "warm golden",
                    "cool pink",
                    "neutral",
                    "peach",
                    "olive",
                    "golden bronze",
                    "custom",
                ],
            },
            "texture": {
                "label": "Skin Texture",
                "type": "single_select",
                "default": "realistic human skin texture",
                "options": [
                    "realistic human skin texture",
                    "realistic visible pores and soft skin grain",
                    "smooth natural skin",
                    "subtly luminous natural hydration",
                    "slightly textured",
                    "custom",
                ],
            },
            "distinctive_features": {
                "label": "Distinctive Skin Characteristics",
                "type": "single_select",
                "default": "none",
                "options": [
                    "none",
                    "beauty marks",
                    "freckles across shoulders",
                    "small natural moles",
                    "birthmark",
                    "faint stretch marks on hips",
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
                "default": "skim or NO clothing",
                "options": [
                    "skim or NO clothing",
                    "minimal neutral fitted reference clothing",
                    "simple fitted tank and shorts",
                    "simple fitted top and leggings",
                    "neutral fitted bodysuit",
                    "matte neutral athletic sports top and bike shorts",
                    "custom",
                ],
            },
            "clothing_rule": {
                "label": "Attire Visibility Protocol",
                "type": "text_readonly",
                "default": "clearly shows her natural proportions without being revealing. Neutral relaxed standing posture, feet visible, arms naturally positioned.",
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
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["Indian"],
        "height_impression": "tall-looking",
        "overall_body_type": "dramatic curvy hourglass",
        "body_presence": "feminine presence",
        "posture": "Neutral relaxed standing posture",
        "shoulders": "soft balanced shoulders",
        "chest_bust": "a very prominent natural bust",
        "arms": "soft naturally full arms",
        "waist": "clearly narrow defined waist",
        "abdomen": "natural gentle lower-belly softness",
        "abdomen_exclusions": "without visible abdominal definition or athletic muscularity",
        "hips_pelvis": "wide rounded hips",
        "thighs": "full soft thighs",
        "legs": "long-looking feminine legs",
        "lower_body": "rounded",
        "physique_descriptors": "soft, plush, curvy, feminine, and naturally proportioned",
        "physique_exclusions": "not muscular or bodybuilder-like",
        "tone": "bright natural milky-white",
        "undertone": "subtle peach-pink warmth",
        "texture": "realistic human skin texture",
        "distinctive_features": "none",
        "style": "skim or NO clothing",
    },
    "freya_athletic_fit": {
        "character_name": "Freya",
        "gender_presentation": "woman",
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["Scandinavian / Nordic"],
        "height_impression": "tall",
        "overall_body_type": "athletic",
        "body_presence": "athletic presence",
        "posture": "Neutral relaxed standing posture",
        "shoulders": "strong athletic shoulders",
        "chest_bust": "a moderate natural bust",
        "arms": "lean defined athletic arms",
        "waist": "tapered athletic waist",
        "abdomen": "defined athletic core",
        "abdomen_exclusions": "with subtle vertical core line (linea alba)",
        "hips_pelvis": "moderate natural hips",
        "thighs": "strong muscular thighs",
        "legs": "athletic shapely legs",
        "lower_body": "athletic lifted",
        "physique_descriptors": "toned, athletic, lean, and balanced",
        "physique_exclusions": "not overly bulky or bodybuilder-like",
        "tone": "fair",
        "undertone": "cool pink",
        "texture": "realistic visible pores and soft skin grain",
        "distinctive_features": "freckles across shoulders",
        "style": "matte neutral athletic sports top and bike shorts",
    },
    "meiling_petite_curve": {
        "character_name": "Meiling",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["East Asian"],
        "height_impression": "petite",
        "overall_body_type": "slim",
        "body_presence": "soft feminine",
        "posture": "poised elegant",
        "shoulders": "delicate sloping shoulders",
        "chest_bust": "a small delicate bust",
        "arms": "slender feminine arms",
        "waist": "narrow defined waist",
        "abdomen": "flat natural stomach",
        "abdomen_exclusions": "without visible abdominal definition or athletic muscularity",
        "hips_pelvis": "moderate natural hips",
        "thighs": "slender thighs",
        "legs": "long slender legs",
        "lower_body": "subtle",
        "physique_descriptors": "slender, delicate, fine-boned, and graceful",
        "physique_exclusions": "not muscular or bodybuilder-like",
        "tone": "light ivory",
        "undertone": "peach",
        "texture": "smooth natural skin",
        "distinctive_features": "none",
        "style": "minimal neutral fitted reference clothing",
    },
    "amina_statuesque_elegance": {
        "character_name": "Amina",
        "gender_presentation": "woman",
        "age_appearance": "late 20s",
        "ethnicity_ancestry": ["West African"],
        "height_impression": "very tall",
        "overall_body_type": "dramatic curvy hourglass",
        "body_presence": "statuesque presence",
        "posture": "upright confident",
        "shoulders": "broad shoulders",
        "chest_bust": "a full natural bust",
        "arms": "average toned arms",
        "waist": "narrow defined waist",
        "abdomen": "flat natural stomach",
        "abdomen_exclusions": "without visible abdominal definition or athletic muscularity",
        "hips_pelvis": "wide rounded hips",
        "thighs": "full soft thighs",
        "legs": "very long statuesque legs",
        "lower_body": "full prominent",
        "physique_descriptors": "voluptuous, full-figured, and generous",
        "physique_exclusions": "not muscular or bodybuilder-like",
        "tone": "deep espresso",
        "undertone": "warm golden",
        "texture": "subtly luminous natural hydration",
        "distinctive_features": "none",
        "style": "neutral fitted bodysuit",
    },
    "camila_curvy_radiance": {
        "character_name": "Camila",
        "gender_presentation": "woman",
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["Latin American"],
        "height_impression": "average",
        "overall_body_type": "soft curvy",
        "body_presence": "curvy feminine",
        "posture": "Neutral relaxed standing posture",
        "shoulders": "soft balanced shoulders",
        "chest_bust": "a very prominent natural bust",
        "arms": "soft naturally full arms",
        "waist": "clearly narrow defined waist",
        "abdomen": "natural gentle lower-belly softness",
        "abdomen_exclusions": "without visible abdominal definition or athletic muscularity",
        "hips_pelvis": "wide rounded hips",
        "thighs": "full soft thighs",
        "legs": "long-looking feminine legs",
        "lower_body": "rounded",
        "physique_descriptors": "soft, plush, curvy, feminine, and naturally proportioned",
        "physique_exclusions": "not muscular or bodybuilder-like",
        "tone": "tan",
        "undertone": "golden bronze",
        "texture": "realistic human skin texture",
        "distinctive_features": "beauty marks",
        "style": "simple fitted tank and shorts",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# PROMPT COMPILER FOR BODY IDENTITY REFERENCE CARDS
# ─────────────────────────────────────────────────────────────────────────────

def _val(data: dict[str, Any], key: str, fallback: str = "") -> str:
    """Safely extract and format a single or multi-select string value."""
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
    age = _val(data, "age_appearance", "mid-20s")
    ethnicity = _val(data, "ethnicity_ancestry", "Indian")

    # Pronoun resolution
    gender_lower = gender.lower()
    if "woman" in gender_lower or "female" in gender_lower or "feminine" in gender_lower:
        pronoun_poss = "her"
        pronoun_poss_cap = "Her"
        same_person_term = "same woman"
    elif "man" in gender_lower or "male" in gender_lower or "masculine" in gender_lower:
        pronoun_poss = "his"
        pronoun_poss_cap = "His"
        same_person_term = "same man"
    else:
        pronoun_poss = "their"
        pronoun_poss_cap = "Their"
        same_person_term = "same person"

    # Silhouette & Proportions
    height_imp = _val(data, "height_impression", "tall-looking")
    body_pres = _val(data, "body_presence", "feminine presence")
    silhouette = _val(data, "overall_body_type", "dramatic curvy hourglass")

    pres_parts = []
    if height_imp:
        pres_parts.append(height_imp)
    if body_pres and body_pres not in height_imp:
        pres_parts.append(body_pres)
    pres_str = " ".join(pres_parts)

    sil_str = silhouette if "silhouette" in silhouette.lower() else f"{silhouette} silhouette"
    presence_silhouette = f"{pres_str} and {sil_str}".strip()

    shoulders = _val(data, "shoulders", "soft balanced shoulders")
    chest_bust = _val(data, "chest_bust", "a very prominent natural bust")
    waist = _val(data, "waist", "clearly narrow defined waist")
    hips = _val(data, "hips_pelvis", "wide rounded hips")
    thighs = _val(data, "thighs", "full soft thighs")
    legs = _val(data, "legs", "long-looking feminine legs")
    arms = _val(data, "arms", "soft naturally full arms")

    # Abdomen & Core
    abdomen = _val(data, "abdomen", "natural gentle lower-belly softness")
    abdomen_excl = _val(data, "abdomen_exclusions", "without visible abdominal definition or athletic muscularity")

    # Overall physique
    physique = _val(data, "physique_descriptors", "soft, plush, curvy, feminine, and naturally proportioned")
    physique_excl = _val(data, "physique_exclusions", "not muscular or bodybuilder-like")

    # Attire & Posture
    attire = _val(data, "style", "skim or NO clothing")
    posture = _val(data, "posture", "Neutral relaxed standing posture")

    # Skin
    skin_tone = _val(data, "tone", "bright natural milky-white")
    if "skin" not in skin_tone.lower():
        skin_tone = f"{skin_tone} skin"
    skin_undertone = _val(data, "undertone", "subtle peach-pink warmth")
    skin_texture = _val(data, "texture", "realistic human skin texture")

    distinctive_features = _val(data, "distinctive_features", "")
    skin_distinctive_line = ""
    if distinctive_features and distinctive_features.lower() not in ("none", "clean"):
        skin_distinctive_line = f" Distinctive skin characteristics: {distinctive_features}."

    prompt = f"""Create a 4:3 high-resolution photorealistic **BODY IDENTITY REFERENCE CARD** for {name}, the same fictional adult {ethnicity} {gender} in {pronoun_poss} {age}.
Show the **{same_person_term}** in three consistent full-body views on one clean reference sheet:

1. front view
2. left side view
3. Right side view
4. back view

{name} has a **{presence_silhouette}** with {shoulders}, {chest_bust}, {waist}, {hips}, {thighs}, {legs}, and {arms}.
{pronoun_poss_cap} abdomen has **{abdomen}**, {abdomen_excl}.
{pronoun_poss_cap} overall physique is **{physique}**, {physique_excl}.
Use {attire} that clearly shows {pronoun_poss} natural proportions without being revealing. {posture}, feet visible, arms naturally positioned.
Preserve {pronoun_poss} {skin_tone} with {skin_undertone} and {skin_texture}.{skin_distinctive_line}
Plain neutral background, consistent soft natural lighting, realistic anatomy and proportions.
No slimming, body reshaping, exaggerated curves, muscular enhancement, artificial proportions, beauty filter, or stylization.
All three views must depict **exactly the same {gender} with identical body proportions**.
No text except label of side and title
Purpose: **BODY LOCK — this image is the primary reference for {name}'s body proportions, silhouette, and physical structure.**"""

    return prompt.strip()


def compile_body_visual_dna(data: dict[str, Any]) -> str:
    """Compile a concise summary of body traits for CharacterCard visual_dna."""
    name = _val(data, "character_name", "Character")
    gender = _val(data, "gender_presentation", "woman")
    age = _val(data, "age_appearance", "mid-20s")
    ethnicity = _val(data, "ethnicity_ancestry", "Indian")

    height = _val(data, "height_impression", "tall-looking")
    body_type = _val(data, "overall_body_type", "dramatic curvy hourglass")
    bust = _val(data, "chest_bust", "prominent natural bust")
    waist = _val(data, "waist", "clearly narrow defined waist")
    hips = _val(data, "hips_pelvis", "wide rounded hips")
    skin = f"{_val(data, 'tone', 'bright natural milky-white')} {_val(data, 'undertone', 'subtle peach-pink warmth')}"

    return (
        f"{name}: Adult {ethnicity} {gender}, {age}. {height} presence with {body_type} silhouette. "
        f"{bust}, {waist}, {hips}. {skin} skin."
    )


def randomize_body(archetype_key: str | None = None) -> dict[str, Any]:
    """Generate a coherent randomized body card data payload."""
    if archetype_key and archetype_key in BODY_ARCHETYPES:
        base = dict(BODY_ARCHETYPES[archetype_key])
        return base

    chosen_archetype = random.choice(list(BODY_ARCHETYPES.keys()))
    data = dict(BODY_ARCHETYPES[chosen_archetype])

    # Allow slight stochastic variation
    variation_keys = ["posture", "style", "distinctive_features"]
    for k in variation_keys:
        for cat in BODY_DICTIONARY.values():
            if k in cat.get("fields", {}):
                opts = [o for o in cat["fields"][k].get("options", []) if o != "custom"]
                if opts:
                    data[k] = random.choice(opts)

    return data
