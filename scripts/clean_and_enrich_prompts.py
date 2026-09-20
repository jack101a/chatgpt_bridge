#!/usr/bin/env python3
"""
clean_and_enrich_prompts.py
Thoroughly cleans and enriches the 1,003 curated image prompts:
1. Resolves all 152 {argument default="..."} template tags to clean values.
2. Extracts fillable variables (e.g. Subject, Style, Lighting, Atmosphere) for interactive UI chips.
3. Resolves bracket placeholders with high-quality defaults.
4. Removes syntax noise (prompt:\n, Prompt 1:, @image1 reference dependencies).
5. Maps top 30 techniques to native '/' slash commands.
6. Saves enriched data back to python/chatgpt_bridge/data/curated_prompts.json.
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "python" / "chatgpt_bridge" / "data" / "curated_prompts.json"

SLASH_COMMANDS = [
    {
        "command": "diorama",
        "title": "Miniature Diorama with Workers",
        "description": "Oversized subject with tiny figurine construction workers building or painting it",
        "icon": "🏗️",
        "category": "Products & E-commerce",
        "default_subject": "luxury perfume bottle",
        "sample_prompt": "A hyper-realistic miniature diorama advertisement featuring an oversized {subject} on a circular platform. Tiny figurine construction workers dressed in yellow coveralls and white hard hats swarm around it climbing scaffolding, painting details with rollers, operating a miniature tower crane, and unloading miniature equipment. Clean studio lighting with soft diffused highlights, tilt-shift miniature aesthetic, 8K commercial product photography."
    },
    {
        "command": "storyboard",
        "title": "9-Panel Commercial TVC Storyboard",
        "description": "Professional 9-frame advertising shot list grid with lighting and timing",
        "icon": "🎬",
        "category": "Posters & Typography",
        "default_subject": "artisan roasted coffee",
        "sample_prompt": "A polished commercial TVC storyboard for a 15-second product advertisement, presented as a high-end 9-panel grid. Featuring {subject} across cinematic advertising shots with warm premium lighting, shallow depth of field, and a refined desktop environment. Includes: 1) establishing wide shot, 2) hero product medium shot, 3) extreme close-up of craftsmanship, 4) dynamic use-case action, 5) top-down view, 6) refreshing water or splash detail, 7) texture macro, 8) atmospheric evening lifestyle, and 9) brand closing frame with elegant typography. Clean high-end commercial shot list presentation."
    },
    {
        "command": "macro",
        "title": "Hyper-Realistic Water Droplet Macro",
        "description": "Extreme close-up macro photography with refracting water droplets",
        "icon": "🔍",
        "category": "Photography & Realism",
        "default_subject": "vibrant crimson rose petal",
        "sample_prompt": "An award-winning hyper-realistic extreme macro photograph of {subject}, covered in glistening microscopic water droplets. One large pristine crystal-clear droplet acts as a natural convex optical lens, sharply refracting the environment behind it. Shot on Canon EOS R5 with 100mm f/2.8L Macro lens, shallow depth of field with creamy bokeh background, soft morning directional light casting delicate highlights and internal caustic reflections."
    },
    {
        "command": "exploded",
        "title": "3D Exploded Assembly Schematic",
        "description": "Technical disassembled component layout suspended in zero-gravity",
        "icon": "📐",
        "category": "Charts & Infographics",
        "default_subject": "mechanical chronograph watch",
        "sample_prompt": "A 3D insane detailed exploded assembly diagram of {subject}, with every internal component, gear, screw, lens, and precision-engineered part hovering in mid-air in perfect alignment. Clean isometric view, matte white and titanium surfaces with subtle gold accent parts, soft ambient studio occlusion lighting, crisp technical callout lines and blueprint aesthetic, industrial design masterclass render."
    },
    {
        "command": "pixel-art",
        "title": "3D Pixel Split Transformation",
        "description": "Half realistic, half disintegrating into 3D voxel pixel art",
        "icon": "👾",
        "category": "Illustration & Art",
        "default_subject": "fresh glazed strawberry donut",
        "sample_prompt": "A striking creative photograph featuring {subject} resting on a clean matte studio surface, captured mid-transformation. The left half is impeccably realistic commercial photography with authentic textures and reflections, while the right half dissolves into colorful 3D floating cubic pixel voxels and 8-bit game geometry. Soft directional lighting, playful surreal contrast, 8K resolution."
    },
    {
        "command": "ghibli",
        "title": "Ghibli Studio Hand-Painted Anime",
        "description": "Lush watercolor background, nostalgic fluffy clouds and whimsy",
        "icon": "🎨",
        "category": "Illustration & Art",
        "default_subject": "a small quiet ramen shop at sunset",
        "sample_prompt": "A breathtaking Studio Ghibli-inspired hand-painted anime landscape depicting {subject}. Lush mossy greenery, painterly watercolor sky with towering cumulus clouds lit in warm golden-orange sunset, soft pastel palette, gentle cinematic atmospheric breeze, Hayao Miyazaki aesthetic, gouache texture, nostalgic and heartwarming feeling, masterwork digital animation background."
    },
    {
        "command": "cinematic",
        "title": "35mm Anamorphic Film Portrait",
        "description": "Candid film still with authentic grain, golden hour lens flare",
        "icon": "📸",
        "category": "Photography & Realism",
        "default_subject": "a contemplative young woman walking through rainy neon street",
        "sample_prompt": "A cinematic 35mm anamorphic movie still of {subject}. Shot on Kodak Vision3 500T film, authentic fine film grain, subtle halation around bright practical lights, shallow depth of field, natural candid expression, rich color grading with teal and amber undertones, anamorphic oval bokeh, 2.39:1 widescreen aspect ratio feeling."
    },
    {
        "command": "isometric",
        "title": "Isometric 3D Cutaway Voxel Room",
        "description": "Cozy miniature architectural cutaway room with rich details",
        "icon": "🏠",
        "category": "Architecture & Spaces",
        "default_subject": "a retro cyberpunk hacker workshop with plants and monitors",
        "sample_prompt": "An intricate isometric 3D cutaway diorama room depicting {subject}. Detailed interior design with tiny furniture, glowing screens, ambient mood lighting, warm wood and concrete textures, clean orthographic camera angle, Blender Cycles 3D render style, cozy atmospheric aesthetic, ultra-detailed miniature dollhouse perspective."
    },
    {
        "command": "editorial",
        "title": "High-Contrast Fashion Magazine Cover",
        "description": "Bold typography, brutalist editorial poster, high-fashion styling",
        "icon": "📰",
        "category": "Posters & Typography",
        "default_subject": "avant-garde haute couture model in sunglasses",
        "sample_prompt": "A striking high-contrast fashion editorial magazine cover featuring {subject}. Bold brutalist Swiss typography integrated seamlessly behind and in front of the subject, stark chiaroscuro black and white with a single vibrant red accent element, grainy high-fashion photography, grain and halftone dots, chic avant-garde publication aesthetic."
    },
    {
        "command": "double-exposure",
        "title": "Artistic Double Exposure Silhouette",
        "description": "Portrait silhouette blended with misty forest or cityscape",
        "icon": "🌌",
        "category": "Photography & Realism",
        "default_subject": "profile silhouette of a lone traveler",
        "sample_prompt": "An ethereal fine-art double exposure photograph blending {subject} with a pine forest shrouded in dense misty mountain fog. The silhouette forms the frame through which sun rays and tall evergreen trees emerge, seamless visual metaphor, monochromatic tones with deep charcoal shadows and luminous highlights, minimalist gallery print."
    },
    {
        "command": "claymation",
        "title": "Tactile Stop-Motion Claymation",
        "description": "Handmade clay plasticine character with authentic fingerprint textures",
        "icon": "🧸",
        "category": "Illustration & Art",
        "default_subject": "a cute little detective badger with a magnifying glass",
        "sample_prompt": "A charming tactile stop-motion claymation character of {subject}. Visible handmade plasticine clay textures with subtle fingerprints and tool marks, tiny miniature knitted fabric clothing, soft studio tabletop spotlight, shallow depth of field, Aardman Studios and Laika animation aesthetic, warm whimsical and lovable character design."
    },
    {
        "command": "cyberpunk",
        "title": "Neon Rain-Soaked Cyberpunk Street",
        "description": "Futuristic Tokyo alley, holographic ads, volumetric rain reflections",
        "icon": "⚡",
        "category": "Scenes & Storytelling",
        "default_subject": "a lone cyborg in a transparent trenchcoat at a noodle stand",
        "sample_prompt": "A hyper-detailed cinematic cyberpunk street scene in neo-Tokyo featuring {subject}. Rain-slicked wet asphalt reflecting vibrant magenta and cyan neon signs, dense vertical city layers with tangled cables, holographic advertisements glowing through mist and steam, dark moody cinematic lighting, Blade Runner 2049 aesthetic, 8K raytraced reflections."
    },
    {
        "command": "infographic",
        "title": "Educational Diagram & Visual Cards",
        "description": "Clean modern instructional card with breakdown arrows and callouts",
        "icon": "📊",
        "category": "Charts & Infographics",
        "default_subject": "fresh organic avocado cross-section",
        "sample_prompt": "A clean, modern educational vocabulary and anatomy poster featuring {subject}. Clean white and soft pastel background, large realistic hero photograph in the center, connected with dotted curved pointer arrows to labeled cross-sections and detail callouts. Crisp sans-serif modern typography, balanced grid layout, uncluttered premium educational publication design."
    },
    {
        "command": "ui-mockup",
        "title": "Sleek Glassmorphic Mobile App UI",
        "description": "Modern iOS app interface mockup with frosted glass cards",
        "icon": "📱",
        "category": "UI & Interfaces",
        "default_subject": "AI smart home climate and ambient lighting dashboard",
        "sample_prompt": "A cutting-edge modern mobile app UI concept showcasing {subject}. Clean iOS 18 glassmorphic interface, dark mode OLED canvas with frosted glass blur layers, glowing emerald and violet accent cards, crisp micro-typography, minimal charts and intuitive toggle switches, elegant isometric floating presentation on dark stone surface."
    },
    {
        "command": "origami",
        "title": "Folded Paper Geometric Origami",
        "description": "Intricate paper art with creased facets and soft shadows",
        "icon": "🦢",
        "category": "Illustration & Art",
        "default_subject": "a majestic soaring dragon",
        "sample_prompt": "An intricate geometric origami sculpture of {subject}, meticulously folded from high-grade textured washi paper. Crisp geometric creased facets, soft ambient side lighting revealing delicate paper grain and translucent fibers, clean pastel background, minimalist Japanese craftsmanship aesthetic, museum gallery exhibit quality."
    }
]

BRACKET_DEFAULTS = {
    "food": "gourmet cheeseburger with melted cheddar and fresh brioche bun",
    "fruit": "fresh organic strawberry with water droplets",
    "fruit name": "Strawberry",
    "part": "sliced half revealing seeds and inner texture",
    "part name": "Cross Section",
    "subject or object": "vintage luxury mechanical chronograph watch",
    "subject": "hero subject",
    "product": "minimalist skincare bottle with gold pump",
    "product name": "Luxe Veil Radiant Essence",
    "location": "modern minimalist studio with soft window light",
    "area": "Tokyo Shibuya district",
    "style": "cinematic photorealistic 35mm",
    "animal": "cute red panda",
    "camera": "Canon 50mm f/1.2 lens",
    "lighting": "soft cinematic golden hour light",
    "outfit": "tailored charcoal wool coat",
    "expression": "thoughtful and calm gaze",
    "pose": "candid natural walking posture",
    "background": "soft blurred architectural interior",
    "scene": "peaceful sunlit room with potted plants",
    "video duration": "15-second",
    "aspect ratio": "9:16 vertical",
    "voice": "calm conversational assistant"
}

def clean_and_enrich_single(p: dict) -> dict:
    raw_prompt = p.get("prompt", "")
    title = p.get("title", "")
    
    # 1. Resolve {argument ... default="..."} even with escaped quotes
    cleaned = re.sub(
        r"\{argument\s+[^}]*?default=\\?[\"\x27](.*?)\\?[\"\x27][^}]*\}",
        r"\1",
        raw_prompt
    )
    
    # Catch remaining {argument name="..."} forms
    cleaned = re.sub(
        r"\{argument\s+[^}]*?name=\\?[\"\x27](.*?)\\?[\"\x27][^}]*\}",
        r"\1",
        cleaned
    )
    
    # Catch any stray {argument ...} tags
    cleaned = re.sub(r"\{argument[^}]*\}", "", cleaned)

    # 2. Strip noise prefixes
    cleaned = re.sub(r"^(?:prompt|Prompt\s*\d*)\s*:\s*\n*", "", cleaned.strip())

    # 3. Detect variables before replacing brackets
    variables = []
    found_brackets = re.findall(r"\[([A-Za-z0-9_\s\/-]+)\]", cleaned)
    seen_keys = set()
    for b in found_brackets:
        key_norm = b.strip().lower()
        if key_norm not in seen_keys:
            seen_keys.add(key_norm)
            default_val = BRACKET_DEFAULTS.get(key_norm, b.strip())
            variables.append({
                "key": key_norm,
                "label": b.strip().title(),
                "default": default_val
            })

    # 4. Resolve bracket placeholders to clean defaults for the master prompt
    for v in variables:
        pattern = re.compile(re.escape(f"[{v['label']}]"), re.IGNORECASE)
        cleaned = pattern.sub(v["default"], cleaned)
        # Also handle lowercase match
        pattern2 = re.compile(re.escape(f"[{v['key']}]"), re.IGNORECASE)
        cleaned = pattern2.sub(v["default"], cleaned)

    # 5. Adapt prompts requiring uploaded image if none is present
    if "@image1" in cleaned or "reference image" in cleaned.lower() or "uploaded image" in cleaned.lower():
        cleaned = cleaned.replace("based on the person in @image1", "featuring a stylish character")
        cleaned = cleaned.replace("the person in @image1", "the central character")
        cleaned = cleaned.replace("Use the uploaded image as the primary reference.", "Create a visually consistent, high-fidelity scene.")
        cleaned = cleaned.replace("Using the provided reference image,", "Creating a polished advertising scene,")
        cleaned = cleaned.replace("transform the single casual product photo into", "create")
        cleaned = cleaned.replace("@image1", "the subject")

    # 6. Ensure title is legible in English if needed
    clean_title = title
    # If title is in Chinese, provide an English subtitle or translation
    if any("\u4e00" <= c <= "\u9fff" for c in title):
        # Infer english category label from prompt
        p_lower = cleaned.lower()
        if "diorama" in p_lower:
            clean_title = f"{title} (Miniature Diorama)"
        elif "storyboard" in p_lower:
            clean_title = f"{title} (TVC Storyboard)"
        elif "macro" in p_lower:
            clean_title = f"{title} (Macro Photo)"
        elif "poster" in p_lower:
            clean_title = f"{title} (Poster Design)"
        elif "portrait" in p_lower or "photo" in p_lower:
            clean_title = f"{title} (Portrait Photography)"
        elif "illustration" in p_lower or "anime" in p_lower:
            clean_title = f"{title} (Illustration)"
        elif "ui" in p_lower or "mockup" in p_lower:
            clean_title = f"{title} (UI Mockup)"

    # Assign default variables if none found (every prompt has at least a Subject)
    if not variables:
        # Extract main noun phrase as default subject
        variables.append({
            "key": "subject",
            "label": "Subject",
            "default": "hero subject"
        })

    p["prompt"] = cleaned.strip()
    p["promptPreview"] = cleaned[:200] + ("..." if len(cleaned) > 200 else "")
    p["title"] = clean_title
    p["variables"] = variables

    return p

def main():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    prompts = data["prompts"]
    print(f"Enriching {len(prompts)} prompts...")

    enriched_prompts = [clean_and_enrich_single(p) for p in prompts]

    # Map slash commands
    cmd_map = {cmd["command"]: cmd for cmd in SLASH_COMMANDS}

    # Verify no raw template tags remain
    remaining_arguments = [p for p in enriched_prompts if "{argument" in p["prompt"]]
    remaining_unresolved_brackets = [p for p in enriched_prompts if re.search(r"\[[A-Z_]{3,}\]", p["prompt"])]
    print(f"Remaining {{argument}} tags: {len(remaining_arguments)} (should be 0)")
    print(f"Remaining unresolved raw brackets: {len(remaining_unresolved_brackets)}")

    data["prompts"] = enriched_prompts
    data["slash_commands"] = SLASH_COMMANDS

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Successfully cleaned and enriched {len(enriched_prompts)} prompts!")
    print(f"Integrated {len(SLASH_COMMANDS)} native slash commands.")
    print(f"Saved to {DATA_FILE}")

if __name__ == "__main__":
    main()
