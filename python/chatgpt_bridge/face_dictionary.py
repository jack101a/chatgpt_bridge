"""Dynamic Data Dictionary, Harmonized Archetypes, and Prompt Compiler for Face Identity Reference Cards."""

from __future__ import annotations

import random
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC DATA DICTIONARY DEFINITION
# ─────────────────────────────────────────────────────────────────────────────

FACE_DICTIONARY: dict[str, Any] = {
    "basics": {
        "title": "1. Character Basics",
        "fields": {
            "character_name": {
                "label": "Character Name",
                "type": "text",
                "default": "Kaya",
                "placeholder": "e.g., Kaya, Maya, Elena, Alex",
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
                "default": ["South Asian"],
                "options": [
                    "South Asian",
                    "North Indian",
                    "South Indian",
                    "Bengali",
                    "Punjabi",
                    "Nepali",
                    "Sri Lankan",
                    "East Asian",
                    "Southeast Asian",
                    "Central Asian",
                    "West Asian",
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
                    "Afro-Caribbean",
                    "Latin American",
                    "Indigenous American",
                    "Pacific Islander",
                    "Mixed / multi-ethnic",
                    "fictional / fantasy",
                    "custom",
                ],
            },
        },
    },
    "structure": {
        "title": "2. Face Structure",
        "fields": {
            "face_shape": {
                "label": "Face Shape",
                "type": "single_select",
                "default": "oval",
                "options": [
                    "oval",
                    "round",
                    "heart",
                    "square",
                    "oblong",
                    "diamond",
                    "rectangular",
                    "triangular",
                    "soft-full",
                    "angular",
                    "tapered",
                    "custom",
                ],
            },
            "face_fullness": {
                "label": "Face Fullness",
                "type": "single_select",
                "default": "lean",
                "options": [
                    "slender",
                    "lean",
                    "balanced",
                    "softly full",
                    "full",
                    "sculpted / chiseled",
                    "very full",
                    "custom",
                ],
            },
            "forehead": {
                "label": "Forehead",
                "type": "single_select",
                "default": "medium straight",
                "options": [
                    "small",
                    "medium",
                    "medium straight",
                    "broad",
                    "tall",
                    "rounded",
                    "straight",
                    "slightly sloping",
                    "custom",
                ],
            },
            "jaw": {
                "label": "Jawline",
                "type": "single_select",
                "default": "defined",
                "options": [
                    "soft",
                    "rounded",
                    "tapered",
                    "defined",
                    "chiseled angular",
                    "broad square",
                    "narrow",
                    "V-line",
                    "custom",
                ],
            },
            "chin": {
                "label": "Chin",
                "type": "single_select",
                "default": "softly rounded",
                "options": [
                    "small",
                    "rounded",
                    "soft",
                    "softly rounded",
                    "pointed",
                    "defined",
                    "broad",
                    "cleft chin",
                    "narrow",
                    "custom",
                ],
            },
            "cheeks": {
                "label": "Cheeks & Cheekbones",
                "type": "single_select",
                "default": "high cheekbones",
                "options": [
                    "subtle",
                    "soft",
                    "full",
                    "plush",
                    "defined cheekbones",
                    "high cheekbones",
                    "prominent sculpted cheeks",
                    "softly contoured",
                    "hollowed cheeks",
                    "custom",
                ],
            },
        },
    },
    "eyes": {
        "title": "3. Eyes & Gaze",
        "fields": {
            "eye_shape": {
                "label": "Eye Shape",
                "type": "single_select",
                "default": "almond",
                "options": [
                    "almond",
                    "round",
                    "large round",
                    "narrow",
                    "hooded",
                    "deep-set",
                    "monolid",
                    "prominent double-eyelid",
                    "upturned",
                    "downturned",
                    "wide-set",
                    "close-set",
                    "custom",
                ],
            },
            "eye_size": {
                "label": "Eye Size",
                "type": "single_select",
                "default": "large",
                "options": ["small", "medium", "large", "very large", "custom"],
            },
            "eye_spacing": {
                "label": "Eye Spacing",
                "type": "single_select",
                "default": "balanced",
                "options": [
                    "close-set",
                    "balanced",
                    "slightly wide-set",
                    "wide-set",
                    "custom",
                ],
            },
            "eye_color": {
                "label": "Eye Color",
                "type": "single_select",
                "default": "dark brown",
                "options": [
                    "jet black",
                    "very dark brown",
                    "dark brown",
                    "warm chestnut brown",
                    "light brown",
                    "hazel",
                    "amber",
                    "moss green",
                    "emerald green",
                    "deep blue",
                    "ice blue",
                    "gray",
                    "gray-green",
                    "custom",
                ],
            },
            "eye_character": {
                "label": "Eye Character / Gaze",
                "type": "single_select",
                "default": "warm and expressive",
                "options": [
                    "soft",
                    "warm",
                    "warm and expressive",
                    "bright",
                    "gentle",
                    "intense",
                    "deep",
                    "dreamy",
                    "expressive",
                    "playful",
                    "sharp",
                    "piercing",
                    "calm",
                    "mysterious",
                    "custom",
                ],
            },
            "eye_details": {
                "label": "Eye Details",
                "type": "multi_select",
                "default": ["long lashes", "visible lower-lid", "strong catchlights"],
                "options": [
                    "strong catchlights",
                    "visible lower-lid",
                    "long lashes",
                    "naturally defined lashes",
                    "subtle eyelid crease",
                    "subtle epicanthic fold",
                    "deep eye sockets",
                    "soft eye area",
                    "custom",
                ],
            },
        },
    },
    "eyebrows": {
        "title": "4. Eyebrows",
        "fields": {
            "brow_shape": {
                "label": "Eyebrow Shape",
                "type": "single_select",
                "default": "softly arched",
                "options": [
                    "straight",
                    "softly arched",
                    "rounded",
                    "high arch",
                    "angled",
                    "feathered",
                    "custom",
                ],
            },
            "brow_density": {
                "label": "Eyebrow Density",
                "type": "single_select",
                "default": "medium",
                "options": [
                    "fine",
                    "light",
                    "medium",
                    "moderately full",
                    "thick",
                    "bushy / textured",
                    "very thick",
                    "custom",
                ],
            },
            "brow_character": {
                "label": "Eyebrow Character",
                "type": "single_select",
                "default": "natural defined",
                "options": [
                    "soft",
                    "natural",
                    "natural defined",
                    "defined",
                    "bold",
                    "expressive",
                    "clean groomed",
                    "custom",
                ],
            },
        },
    },
    "nose": {
        "title": "5. Nose",
        "fields": {
            "nose_size": {
                "label": "Nose Size",
                "type": "single_select",
                "default": "small",
                "options": [
                    "very small",
                    "small",
                    "medium",
                    "prominent",
                    "large",
                    "custom",
                ],
            },
            "nose_bridge": {
                "label": "Nose Bridge",
                "type": "single_select",
                "default": "straight narrow",
                "options": [
                    "narrow",
                    "straight",
                    "straight narrow",
                    "broad",
                    "softly curved",
                    "defined",
                    "high bridge",
                    "low bridge",
                    "aquiline",
                    "button / snub",
                    "custom",
                ],
            },
            "nose_tip": {
                "label": "Nose Tip",
                "type": "single_select",
                "default": "refined softly defined",
                "options": [
                    "rounded",
                    "refined",
                    "refined softly defined",
                    "softly defined",
                    "slightly lifted",
                    "button tip",
                    "defined",
                    "broad",
                    "narrow",
                    "custom",
                ],
            },
            "nose_overall": {
                "label": "Nose Overall",
                "type": "single_select",
                "default": "delicate refined",
                "options": [
                    "delicate",
                    "delicate refined",
                    "refined",
                    "soft",
                    "natural",
                    "distinctive",
                    "strong",
                    "custom",
                ],
            },
        },
    },
    "lips": {
        "title": "6. Lips & Mouth",
        "fields": {
            "lip_fullness": {
                "label": "Lip Fullness",
                "type": "single_select",
                "default": "moderately full",
                "options": [
                    "thin",
                    "delicate",
                    "medium",
                    "moderately full",
                    "full",
                    "pillowy plush",
                    "very full",
                    "custom",
                ],
            },
            "lip_shape": {
                "label": "Lip Shape",
                "type": "single_select",
                "default": "defined cupid's bow",
                "options": [
                    "soft",
                    "rounded",
                    "defined cupid's bow",
                    "heart-shaped",
                    "wide",
                    "narrow",
                    "balanced",
                    "custom",
                ],
            },
            "lip_ratio": {
                "label": "Lip Ratio",
                "type": "single_select",
                "default": "slightly fuller lower",
                "options": [
                    "balanced",
                    "slightly fuller upper",
                    "slightly fuller lower",
                    "clearly fuller lower",
                    "clearly fuller upper",
                    "custom",
                ],
            },
            "natural_lip_color": {
                "label": "Natural Lip Color",
                "type": "single_select",
                "default": "rosy pink",
                "options": [
                    "pale pink",
                    "rosy pink",
                    "peach-pink",
                    "mauve",
                    "pink-brown",
                    "warm nude",
                    "brown",
                    "deep berry",
                    "natural neutral",
                    "custom",
                ],
            },
        },
    },
    "skin": {
        "title": "7. Skin & Complexion",
        "fields": {
            "skin_depth": {
                "label": "Skin Depth",
                "type": "single_select",
                "default": "medium",
                "options": [
                    "porcelain",
                    "very fair",
                    "fair",
                    "light",
                    "light-medium",
                    "medium",
                    "tan",
                    "olive-tan",
                    "deep tan",
                    "deep",
                    "very deep",
                    "custom",
                ],
            },
            "skin_undertone": {
                "label": "Skin Undertone",
                "type": "single_select",
                "default": "warm golden",
                "options": [
                    "cool",
                    "cool pink",
                    "neutral",
                    "warm",
                    "warm golden",
                    "golden",
                    "peach",
                    "rosy",
                    "olive",
                    "red/warm",
                    "custom",
                ],
            },
            "skin_texture": {
                "label": "Skin Texture",
                "type": "single_select",
                "default": "soft realistic with visible pores",
                "options": [
                    "very smooth",
                    "naturally smooth",
                    "soft realistic",
                    "soft realistic with visible pores",
                    "detailed realistic",
                    "visible pores",
                    "textured",
                    "custom",
                ],
            },
            "skin_finish": {
                "label": "Skin Finish",
                "type": "single_select",
                "default": "natural satin",
                "options": [
                    "natural matte",
                    "natural satin",
                    "soft luminous",
                    "dewy healthy glow",
                    "softly glowing",
                    "glass skin",
                    "custom",
                ],
            },
            "skin_variation": {
                "label": "Skin Variation",
                "type": "multi_select",
                "default": ["subtle tonal variation"],
                "options": [
                    "none",
                    "subtle tonal variation",
                    "natural redness",
                    "natural warmth",
                    "natural pigmentation",
                    "under-eye variation",
                    "faint sun-kissed tone",
                    "custom",
                ],
            },
            "distinctive_skin_features": {
                "label": "Distinctive Skin Features",
                "type": "multi_select",
                "default": ["none"],
                "options": [
                    "none",
                    "delicate freckles",
                    "freckles across bridge of nose",
                    "beauty mark below eye",
                    "beauty mark above lip",
                    "beauty mark on cheek",
                    "small mole",
                    "cheek dimples",
                    "chin dimple",
                    "faint smile lines",
                    "birthmark",
                    "subtle scar",
                    "custom",
                ],
            },
        },
    },
    "hair": {
        "title": "8. Hair & Hairstyle",
        "fields": {
            "hair_length": {
                "label": "Hair Length",
                "type": "single_select",
                "default": "long",
                "options": [
                    "buzz/very short",
                    "pixie",
                    "short cropped",
                    "chin-length bob",
                    "shoulder-length",
                    "medium",
                    "long",
                    "very long",
                    "waist-length",
                    "custom",
                ],
            },
            "hair_density": {
                "label": "Hair Density",
                "type": "single_select",
                "default": "thick",
                "options": [
                    "fine",
                    "medium",
                    "thick",
                    "voluminous",
                    "very thick",
                    "custom",
                ],
            },
            "hair_texture": {
                "label": "Hair Texture",
                "type": "single_select",
                "default": "softly wavy",
                "options": [
                    "pin straight",
                    "silky straight",
                    "straight",
                    "slightly wavy",
                    "softly wavy",
                    "wavy",
                    "loose curls",
                    "curly",
                    "coily",
                    "tightly coiled 4C",
                    "custom",
                ],
            },
            "hair_color": {
                "label": "Hair Color",
                "type": "single_select",
                "default": "jet black",
                "options": [
                    "jet black",
                    "soft black",
                    "dark brown",
                    "espresso brown",
                    "medium brown",
                    "chestnut brown",
                    "light brown",
                    "auburn",
                    "copper",
                    "red",
                    "dark blonde",
                    "honey blonde",
                    "platinum blonde",
                    "silver gray",
                    "salt and pepper",
                    "white",
                    "fantasy color",
                    "custom",
                ],
            },
            "hair_details": {
                "label": "Hair Details & Styling",
                "type": "multi_select",
                "default": ["curtain bangs", "face-framing strands"],
                "options": [
                    "clean middle part",
                    "side part",
                    "curtain bangs",
                    "wispy fringe",
                    "blunt bangs",
                    "soft layers",
                    "face-framing strands",
                    "tucked behind ears",
                    "highlights",
                    "balayage",
                    "sun-bleached tips",
                    "distinctive strand",
                    "custom",
                ],
            },
        },
    },
    "makeup": {
        "title": "9. Makeup",
        "fields": {
            "makeup_level": {
                "label": "Makeup Level",
                "type": "single_select",
                "default": "natural",
                "options": [
                    "none",
                    "minimal no-makeup look",
                    "natural",
                    "soft glam",
                    "polished glam",
                    "full glam",
                    "editorial",
                    "custom",
                ],
            },
            "makeup_style": {
                "label": "Makeup Style Elements",
                "type": "multi_select",
                "default": ["natural skin", "subtle blush", "lip tint"],
                "options": [
                    "bare skin",
                    "natural skin",
                    "subtle blush",
                    "soft contour",
                    "kajal",
                    "tightline eyeliner",
                    "winged eyeliner",
                    "mascara",
                    "brushed up brows",
                    "eyeshadow",
                    "glossy lips",
                    "lip tint",
                    "nude lips",
                    "pink lips",
                    "bold lips",
                    "festive makeup",
                    "custom",
                ],
            },
        },
    },
    "distinctive": {
        "title": "10. Distinctive Identity Features",
        "fields": {
            "distinctive_features": {
                "label": "Distinctive Accessories & Features",
                "type": "multi_select",
                "default": ["none"],
                "options": [
                    "none",
                    "glasses",
                    "thin wire-frame glasses",
                    "distinctive eyebrows",
                    "beauty mark",
                    "freckles",
                    "dimples",
                    "small gold nose stud",
                    "small silver nose ring",
                    "multiple ear piercings",
                    "cartilage hoop",
                    "distinctive hair streak",
                    "scar",
                    "birthmark",
                    "custom",
                ],
            },
            "identity_notes": {
                "label": "Identity Notes / Extra Details",
                "type": "text",
                "default": "",
                "placeholder": "e.g., Slightly asymmetrical charming smile, expressive dark irises",
            },
        },
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# HARMONIZED ARCHETYPE PRESETS (for one-click coherent face generation)
# ─────────────────────────────────────────────────────────────────────────────

ARCHETYPE_PRESETS: dict[str, dict[str, Any]] = {
    "south_asian_classic": {
        "label": "South Asian Grace (e.g. Kaya)",
        "character_name": "Kaya",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["South Asian", "North Indian"],
        "face_shape": "oval",
        "face_fullness": "lean",
        "forehead": "medium straight",
        "jaw": "defined",
        "chin": "softly rounded",
        "cheeks": "high cheekbones",
        "eye_shape": "almond",
        "eye_size": "large",
        "eye_spacing": "balanced",
        "eye_color": "dark brown",
        "eye_character": "warm and expressive",
        "eye_details": ["long lashes", "visible lower-lid", "strong catchlights"],
        "brow_shape": "softly arched",
        "brow_density": "moderately full",
        "brow_character": "natural defined",
        "nose_size": "small",
        "nose_bridge": "straight narrow",
        "nose_tip": "refined softly defined",
        "nose_overall": "delicate refined",
        "lip_fullness": "moderately full",
        "lip_shape": "defined cupid's bow",
        "lip_ratio": "slightly fuller lower",
        "natural_lip_color": "rosy pink",
        "skin_depth": "medium",
        "skin_undertone": "warm golden",
        "skin_texture": "soft realistic with visible pores",
        "skin_finish": "natural satin",
        "skin_variation": ["subtle tonal variation"],
        "distinctive_skin_features": ["none"],
        "hair_length": "long",
        "hair_density": "thick",
        "hair_texture": "softly wavy",
        "hair_color": "jet black",
        "hair_details": ["curtain bangs", "face-framing strands"],
        "makeup_level": "natural",
        "makeup_style": ["natural skin", "subtle blush", "lip tint"],
        "distinctive_features": ["none"],
        "identity_notes": "",
    },
    "east_asian_modern": {
        "label": "East Asian Minimalist (e.g. Mei / Hana)",
        "character_name": "Hana",
        "gender_presentation": "woman",
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["East Asian"],
        "face_shape": "tapered",
        "face_fullness": "slender",
        "forehead": "rounded",
        "jaw": "V-line",
        "chin": "pointed",
        "cheeks": "defined cheekbones",
        "eye_shape": "almond",
        "eye_size": "medium",
        "eye_spacing": "balanced",
        "eye_color": "jet black",
        "eye_character": "calm and deep",
        "eye_details": ["subtle eyelid crease", "naturally defined lashes", "strong catchlights"],
        "brow_shape": "straight",
        "brow_density": "medium",
        "brow_character": "soft natural",
        "nose_size": "small",
        "nose_bridge": "narrow",
        "nose_tip": "button tip",
        "nose_overall": "delicate",
        "lip_fullness": "medium",
        "lip_shape": "heart-shaped",
        "lip_ratio": "balanced",
        "natural_lip_color": "peach-pink",
        "skin_depth": "fair",
        "skin_undertone": "neutral",
        "skin_texture": "naturally smooth",
        "skin_finish": "dewy healthy glow",
        "skin_variation": ["subtle tonal variation"],
        "distinctive_skin_features": ["beauty mark on cheek"],
        "hair_length": "chin-length bob",
        "hair_density": "fine",
        "hair_texture": "silky straight",
        "hair_color": "soft black",
        "hair_details": ["wispy fringe", "tucked behind ears"],
        "makeup_level": "minimal no-makeup look",
        "makeup_style": ["natural skin", "lip tint"],
        "distinctive_features": ["none"],
        "identity_notes": "Subtle, poised demeanor with striking dark eyes",
    },
    "mediterranean_warmth": {
        "label": "Mediterranean Warmth (e.g. Sofia / Matteo)",
        "character_name": "Sofia",
        "gender_presentation": "woman",
        "age_appearance": "late 20s",
        "ethnicity_ancestry": ["Mediterranean", "Southern European"],
        "face_shape": "heart",
        "face_fullness": "balanced",
        "forehead": "medium straight",
        "jaw": "defined",
        "chin": "soft",
        "cheeks": "prominent sculpted cheeks",
        "eye_shape": "large round",
        "eye_size": "large",
        "eye_spacing": "balanced",
        "eye_color": "amber",
        "eye_character": "intense and playful",
        "eye_details": ["long lashes", "visible lower-lid", "strong catchlights"],
        "brow_shape": "high arch",
        "brow_density": "thick",
        "brow_character": "bold",
        "nose_size": "medium",
        "nose_bridge": "straight",
        "nose_tip": "refined",
        "nose_overall": "distinctive",
        "lip_fullness": "full",
        "lip_shape": "defined cupid's bow",
        "lip_ratio": "clearly fuller lower",
        "natural_lip_color": "mauve",
        "skin_depth": "olive-tan",
        "skin_undertone": "olive",
        "skin_texture": "soft realistic",
        "skin_finish": "natural satin",
        "skin_variation": ["natural warmth", "faint sun-kissed tone"],
        "distinctive_skin_features": ["none"],
        "hair_length": "long",
        "hair_density": "voluminous",
        "hair_texture": "loose curls",
        "hair_color": "espresso brown",
        "hair_details": ["side part", "soft layers"],
        "makeup_level": "natural",
        "makeup_style": ["natural skin", "subtle blush", "mascara"],
        "distinctive_features": ["small gold nose stud"],
        "identity_notes": "Radiant olive complexion with expressive, lively eyes",
    },
    "west_african_radiance": {
        "label": "West African Elegance (e.g. Amina / Kofi)",
        "character_name": "Amina",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["African", "West African"],
        "face_shape": "oval",
        "face_fullness": "balanced",
        "forehead": "tall rounded",
        "jaw": "defined",
        "chin": "rounded",
        "cheeks": "high cheekbones",
        "eye_shape": "almond",
        "eye_size": "large",
        "eye_spacing": "balanced",
        "eye_color": "very dark brown",
        "eye_character": "warm and bright",
        "eye_details": ["long lashes", "strong catchlights"],
        "brow_shape": "softly arched",
        "brow_density": "medium",
        "brow_character": "clean groomed",
        "nose_size": "medium",
        "nose_bridge": "broad",
        "nose_tip": "softly defined",
        "nose_overall": "natural",
        "lip_fullness": "pillowy plush",
        "lip_shape": "rounded",
        "lip_ratio": "balanced",
        "natural_lip_color": "deep berry",
        "skin_depth": "deep",
        "skin_undertone": "red/warm",
        "skin_texture": "soft realistic with visible pores",
        "skin_finish": "soft luminous",
        "skin_variation": ["subtle tonal variation"],
        "distinctive_skin_features": ["cheek dimples"],
        "hair_length": "shoulder-length",
        "hair_density": "very thick",
        "hair_texture": "tightly coiled 4C",
        "hair_color": "jet black",
        "hair_details": ["soft layers"],
        "makeup_level": "natural",
        "makeup_style": ["glossy lips", "natural skin", "subtle blush"],
        "distinctive_features": ["dimples"],
        "identity_notes": "Sculpted features, radiant deep mahogany skin, and bright infectious gaze",
    },
    "nordic_crisp": {
        "label": "Nordic Crisp (e.g. Astrid / Soren)",
        "character_name": "Astrid",
        "gender_presentation": "woman",
        "age_appearance": "early 20s",
        "ethnicity_ancestry": ["Scandinavian / Nordic"],
        "face_shape": "diamond",
        "face_fullness": "slender",
        "forehead": "straight",
        "jaw": "chiseled angular",
        "chin": "pointed",
        "cheeks": "high cheekbones",
        "eye_shape": "almond",
        "eye_size": "medium",
        "eye_spacing": "balanced",
        "eye_color": "ice blue",
        "eye_character": "sharp and piercing",
        "eye_details": ["naturally defined lashes", "subtle eyelid crease", "strong catchlights"],
        "brow_shape": "straight",
        "brow_density": "light",
        "brow_character": "natural",
        "nose_size": "small",
        "nose_bridge": "straight narrow",
        "nose_tip": "refined",
        "nose_overall": "delicate refined",
        "lip_fullness": "medium",
        "lip_shape": "soft",
        "lip_ratio": "slightly fuller lower",
        "natural_lip_color": "pale pink",
        "skin_depth": "porcelain",
        "skin_undertone": "cool pink",
        "skin_texture": "soft realistic",
        "skin_finish": "natural satin",
        "skin_variation": ["natural redness"],
        "distinctive_skin_features": ["delicate freckles"],
        "hair_length": "long",
        "hair_density": "fine",
        "hair_texture": "pin straight",
        "hair_color": "platinum blonde",
        "hair_details": ["center part"],
        "makeup_level": "none",
        "makeup_style": ["bare skin"],
        "distinctive_features": ["freckles"],
        "identity_notes": "Stark, ethereal Scandinavian features with striking ice-blue irises",
    },
    "latin_american_radiance": {
        "label": "Latin American Radiance (e.g. Camila / Lucas)",
        "character_name": "Camila",
        "gender_presentation": "woman",
        "age_appearance": "mid-20s",
        "ethnicity_ancestry": ["Latin American", "Mixed / multi-ethnic"],
        "face_shape": "oval",
        "face_fullness": "balanced",
        "forehead": "medium",
        "jaw": "defined",
        "chin": "softly rounded",
        "cheeks": "defined cheekbones",
        "eye_shape": "almond",
        "eye_size": "large",
        "eye_spacing": "balanced",
        "eye_color": "warm chestnut brown",
        "eye_character": "expressive and dreamy",
        "eye_details": ["long lashes", "visible lower-lid", "strong catchlights"],
        "brow_shape": "softly arched",
        "brow_density": "moderately full",
        "brow_character": "clean groomed",
        "nose_size": "small",
        "nose_bridge": "straight",
        "nose_tip": "softly defined",
        "nose_overall": "natural",
        "lip_fullness": "full",
        "lip_shape": "heart-shaped",
        "lip_ratio": "slightly fuller lower",
        "natural_lip_color": "rosy pink",
        "skin_depth": "tan",
        "skin_undertone": "warm golden",
        "skin_texture": "soft realistic",
        "skin_finish": "dewy healthy glow",
        "skin_variation": ["natural warmth"],
        "distinctive_skin_features": ["beauty mark below eye"],
        "hair_length": "long",
        "hair_density": "voluminous",
        "hair_texture": "wavy",
        "hair_color": "chocolate brown",
        "hair_details": ["soft layers", "face-framing strands", "highlights"],
        "makeup_level": "natural",
        "makeup_style": ["natural skin", "subtle blush", "glossy lips"],
        "distinctive_features": ["beauty mark"],
        "identity_notes": "Warm golden complexion with luminous brown eyes and textured wavy hair",
    },
}

RANDOM_NAMES = {
    "woman": [
        "Kaya", "Maya", "Aarohi", "Priya", "Ananya", "Rhea", "Mei", "Hana", "Yuna", "Jia",
        "Sofia", "Camila", "Elena", "Valeria", "Amina", "Zainab", "Fatima", "Astrid",
        "Freja", "Chloe", "Emma", "Sienna", "Tara", "Kiara", "Nadia", "Soraya"
    ],
    "man": [
        "Rohan", "Kabir", "Arjun", "Dev", "Neil", "Ren", "Kenji", "Minho", "Chen",
        "Matteo", "Lucas", "Mateo", "Diego", "Kofi", "Tariq", "Malik", "Lars",
        "Erik", "Liam", "Leo", "Samir", "Zayn", "Julian"
    ],
    "feminine person": [
        "Kaya", "Maya", "Rhea", "Mei", "Hana", "Sofia", "Elena", "Amina", "Astrid", "Sienna"
    ],
    "masculine person": [
        "Kabir", "Arjun", "Kenji", "Matteo", "Lucas", "Kofi", "Tariq", "Erik", "Liam"
    ],
    "androgynous person": [
        "Alex", "Robin", "Sam", "Jordan", "Kai", "Rowan", "Rory", "Shiloh", "Morgan", "Eden"
    ],
}


def randomize_face(archetype_key: str | None = None) -> dict[str, Any]:
    """Generate a coherent face dictionary payload based on archetype or balanced random roll."""
    if archetype_key and archetype_key in ARCHETYPE_PRESETS:
        base = dict(ARCHETYPE_PRESETS[archetype_key])
        # Add slight variation to avoid exact duplicates
        gender = base.get("gender_presentation", "woman")
        names = RANDOM_NAMES.get(gender, ["Kaya", "Elena", "Sofia", "Amina"])
        base["character_name"] = random.choice(names)
        return base

    # Randomly select an archetype as seed for high phenotypic realism
    selected_preset_key = random.choice(list(ARCHETYPE_PRESETS.keys()))
    result = dict(ARCHETYPE_PRESETS[selected_preset_key])

    gender = result.get("gender_presentation", "woman")
    names = RANDOM_NAMES.get(gender, ["Kaya", "Maya", "Sofia"])
    result["character_name"] = random.choice(names)

    # Randomize a few non-conflicting traits
    ages = ["18–20", "early 20s", "mid-20s", "late 20s"]
    result["age_appearance"] = random.choice(ages)

    hair_lengths = ["shoulder-length", "medium", "long", "very long"]
    result["hair_length"] = random.choice(hair_lengths)

    eye_characters = ["warm and expressive", "calm and deep", "bright", "dreamy", "expressive"]
    result["eye_character"] = random.choice(eye_characters)

    return result


def _resolve_val(data: dict[str, Any], key: str, default: str = "") -> str:
    """Resolve value, supporting custom overrides."""
    custom_key = f"{key}_custom"
    if custom_key in data and str(data[custom_key]).strip():
        return str(data[custom_key]).strip()
    val = data.get(key)
    if val is None:
        return default
    if isinstance(val, list):
        # Clean out "none" or empty
        cleaned = [str(x).strip() for x in val if str(x).strip().lower() not in ("none", "")]
        return ", ".join(cleaned) if cleaned else ""
    s = str(val).strip()
    if s.lower() in ("custom", ""):
        return str(data.get(custom_key, "")).strip() or default
    return s


def compile_face_card_prompt(data: dict[str, Any]) -> str:
    """Compile dictionary selections into the user's exact fixed FACE IDENTITY REFERENCE CARD prompt."""
    name = _resolve_val(data, "character_name", "Kaya") or "Kaya"
    gender = _resolve_val(data, "gender_presentation", "woman")
    age = _resolve_val(data, "age_appearance", "early 20s")
    ethnicity = _resolve_val(data, "ethnicity_ancestry", "South Asian")
    if not ethnicity:
        ethnicity = "diverse ancestry"

    # Structure
    face_shape = _resolve_val(data, "face_shape", "oval")
    face_fullness = _resolve_val(data, "face_fullness", "lean")
    forehead = _resolve_val(data, "forehead", "medium straight")
    structure_sentence = f"Balanced {face_shape} face shape with {face_fullness} facial fullness and a {forehead} forehead"

    cheeks = _resolve_val(data, "cheeks", "high cheekbones")
    jaw = _resolve_val(data, "jaw", "defined")
    chin = _resolve_val(data, "chin", "softly rounded")
    cheek_jaw_chin_sentence = f"{cheeks.capitalize()}, paired with a {jaw} jawline and a {chin} chin"

    # Eyes
    eye_shape = _resolve_val(data, "eye_shape", "almond")
    eye_size = _resolve_val(data, "eye_size", "large")
    eye_spacing = _resolve_val(data, "eye_spacing", "balanced")
    eye_color = _resolve_val(data, "eye_color", "dark brown")
    eye_character = _resolve_val(data, "eye_character", "warm and expressive")
    eye_details = _resolve_val(data, "eye_details", "long lashes, visible lower-lid, strong catchlights")
    eye_sentence = (
        f"{eye_size.capitalize()} {eye_shape} {eye_color} eyes with {eye_spacing} spacing, "
        f"a {eye_character} gaze"
    )
    if eye_details:
        eye_sentence += f", featuring {eye_details}"

    # Brows
    brow_shape = _resolve_val(data, "brow_shape", "softly arched")
    brow_density = _resolve_val(data, "brow_density", "medium")
    brow_character = _resolve_val(data, "brow_character", "natural defined")
    brow_sentence = f"{brow_density.capitalize()} {brow_shape} eyebrows with a {brow_character} finish"

    # Nose
    nose_size = _resolve_val(data, "nose_size", "small")
    nose_bridge = _resolve_val(data, "nose_bridge", "straight narrow")
    nose_tip = _resolve_val(data, "nose_tip", "refined softly defined")
    nose_overall = _resolve_val(data, "nose_overall", "delicate refined")
    nose_sentence = (
        f"{nose_overall.capitalize()} {nose_size} nose with a {nose_bridge} bridge "
        f"and {nose_tip} tip"
    )

    # Lips
    lip_fullness = _resolve_val(data, "lip_fullness", "moderately full")
    lip_shape = _resolve_val(data, "lip_shape", "defined cupid's bow")
    lip_ratio = _resolve_val(data, "lip_ratio", "slightly fuller lower")
    natural_lip_color = _resolve_val(data, "natural_lip_color", "rosy pink")
    lip_sentence = (
        f"{lip_fullness.capitalize()} lips with a {lip_shape}, {lip_ratio} fullness, "
        f"and natural {natural_lip_color} color"
    )

    # Skin
    skin_depth = _resolve_val(data, "skin_depth", "medium")
    skin_undertone = _resolve_val(data, "skin_undertone", "warm golden")
    skin_texture = _resolve_val(data, "skin_texture", "soft realistic with visible pores")
    skin_finish = _resolve_val(data, "skin_finish", "natural satin")
    skin_variation = _resolve_val(data, "skin_variation", "")
    skin_distinctive = _resolve_val(data, "distinctive_skin_features", "")

    texture_desc = f"{skin_texture}, finished with a {skin_finish} sheen"
    if skin_variation and skin_variation.lower() != "none":
        texture_desc += f" and {skin_variation}"

    skin_features_line = ""
    if skin_distinctive and skin_distinctive.lower() != "none":
        skin_features_line = f"Distinctive skin characteristics: {skin_distinctive}."
    else:
        skin_features_line = "Clean, healthy complexion with authentic natural skin micro-texture."

    # Hair
    hair_length = _resolve_val(data, "hair_length", "long")
    hair_density = _resolve_val(data, "hair_density", "thick")
    hair_texture = _resolve_val(data, "hair_texture", "softly wavy")
    hair_color = _resolve_val(data, "hair_color", "jet black")
    hair_details = _resolve_val(data, "hair_details", "curtain bangs, face-framing strands")
    if not hair_details:
        hair_details = "natural part and clean styling"

    # Makeup
    makeup_level = _resolve_val(data, "makeup_level", "natural")
    makeup_style = _resolve_val(data, "makeup_style", "natural skin, subtle blush, lip tint")
    makeup_desc = f"{makeup_level} makeup ({makeup_style})" if makeup_style else f"{makeup_level} makeup"

    # Distinctive & Notes
    distinctive_features = _resolve_val(data, "distinctive_features", "")
    identity_notes = _resolve_val(data, "identity_notes", "")
    extra_details = []
    if distinctive_features and distinctive_features.lower() != "none":
        extra_details.append(f"Distinctive accessories/features: {distinctive_features}")
    if identity_notes:
        extra_details.append(f"Visual identity note: {identity_notes}")
    extra_block = f"\n{'. '.join(extra_details)}." if extra_details else ""

    # Exact Prompt Template
    prompt = f"""Create a high-resolution photorealistic **FACE IDENTITY REFERENCE CARD** for
{name}, a fictional adult {ethnicity} {gender}
in their {age}.

Use a **16:9 landscape image composition** designed specifically as a facial reference sheet.

At the top center of the image, place the title:

**FACE IDENTITY REFERENCE CARD**

Show the SAME person in three consistent facial views on one clean reference sheet, arranged horizontally:

1. left 3/4 view — label below: **"Left side"**
2. straight-on front view — label below: **"Front side"**
3. right 3/4 view — label below: **"Right side"**

The **front view should be centered**, with the left and right 3/4 views evenly positioned on either side.

Make all three facial views large enough to clearly evaluate the character's features while fitting comfortably within the landscape frame. Keep a **natural, clearly visible border and gap between each view** so the faces are visually separated without looking cramped, overlapping, boxed, or artificially divided.

Keep all three views at a consistent head size, scale, camera distance, vertical alignment, lighting, and rendering quality.

Both ears should be naturally visible whenever possible, especially in the 3/4 views, while maintaining realistic anatomy and the character's exact facial identity.

{structure_sentence}.
{cheek_jaw_chin_sentence}.
{eye_sentence}.
{brow_sentence}.
{nose_sentence}.
{lip_sentence}.

Their skin is {skin_depth} with {skin_undertone} undertones, {texture_desc}.
{skin_features_line}

Their hair is {hair_length}, {hair_density} density, {hair_texture}, {hair_color}, with {hair_details}.

Use {makeup_desc} so the underlying facial identity remains clearly visible.{extra_block}

Use a plain white background and consistent soft natural lighting across all three views. Maintain realistic human anatomy, realistic skin texture, natural facial detail, and photorealistic rendering.

No beauty filter, no facial reshaping, no excessive retouching, no plastic or artificial skin, and no stylization.

No text anywhere on the image except:

* the top title **"FACE IDENTITY REFERENCE CARD"**
* the three view labels **"Left side"**, **"Front side"**, and **"Right side"**

Place each view label naturally below its corresponding face.

All three views must depict **EXACTLY THE SAME PERSON** with identical facial structure, proportions, skin characteristics, hair identity, and recognizable features.

The 3/4 views should naturally reveal facial depth and profile characteristics while remaining clearly consistent with the front view."""

    return prompt.strip()


def compile_visual_dna(data: dict[str, Any]) -> str:
    """Compile a concise, rich Visual DNA description for CharacterCard storage."""
    name = _resolve_val(data, "character_name", "Character")
    gender = _resolve_val(data, "gender_presentation", "person")
    age = _resolve_val(data, "age_appearance", "20s")
    ethnicity = _resolve_val(data, "ethnicity_ancestry", "diverse ancestry")

    face_shape = _resolve_val(data, "face_shape", "oval")
    eyes = f"{_resolve_val(data, 'eye_size', 'large')} {_resolve_val(data, 'eye_shape', 'almond')} {_resolve_val(data, 'eye_color', 'dark brown')} eyes"
    skin = f"{_resolve_val(data, 'skin_depth', 'medium')} skin with {_resolve_val(data, 'skin_undertone', 'warm golden')} undertones"
    hair = f"{_resolve_val(data, 'hair_length', 'long')} {_resolve_val(data, 'hair_texture', 'wavy')} {_resolve_val(data, 'hair_color', 'black')} hair"

    features = []
    skin_feat = _resolve_val(data, "distinctive_skin_features", "")
    if skin_feat and skin_feat.lower() != "none":
        features.append(skin_feat)
    dist = _resolve_val(data, "distinctive_features", "")
    if dist and dist.lower() != "none":
        features.append(dist)
    notes = _resolve_val(data, "identity_notes", "")
    if notes:
        features.append(notes)

    feat_str = f" Distinctive features: {', '.join(features)}." if features else ""

    return (
        f"{name}: Adult {ethnicity} {gender}, {age}. {face_shape} face shape with defined features. "
        f"{eyes}, {skin}, and {hair}.{feat_str}"
    )
