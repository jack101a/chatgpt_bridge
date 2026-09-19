#!/usr/bin/env python3
"""
build_prompt_dataset.py
Extracts and compiles 1,003 curated GPT image prompts from:
1. freestylefly/awesome-gpt-image-2 (541 cases)
2. EvoLinkAI/awesome-gpt-image-2-API-and-Prompts (462 cases)

Outputs:
- python/chatgpt_bridge/data/curated_prompts.json
- python/chatgpt_bridge/data/style_taxonomy.json
"""

import json
import re
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "python" / "chatgpt_bridge" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

def fetch_url(url: str) -> str:
    print(f"Fetching: {url}")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8")

def build_dataset():
    # ── 1. Fetch freestylefly data ──
    cases_url = "https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data/cases.json"
    styles_url = "https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data/style-library.json"
    
    cases_json = json.loads(fetch_url(cases_url))
    styles_json = json.loads(fetch_url(styles_url))
    
    freestyle_cases = cases_json.get("cases", [])
    print(f"Loaded {len(freestyle_cases)} cases from freestylefly")
    
    all_prompts = []
    
    # Standardize freestylefly cases
    for c in freestyle_cases:
        cid = c["id"]
        img_path = f"https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data/images/case{cid}.jpg"
        
        all_prompts.append({
            "id": cid,
            "title": c.get("title", f"Case #{cid}"),
            "imageAlt": c.get("imageAlt", ""),
            "prompt": c["prompt"],  # EXACT VERBATIM PROMPT
            "promptPreview": c.get("promptPreview", c["prompt"][:200] + "..."),
            "category": c.get("category", "Other Use Cases"),
            "styles": c.get("styles", []),
            "scenes": c.get("scenes", []),
            "source": "freestylefly",
            "sourceLabel": c.get("sourceLabel", ""),
            "sourceUrl": c.get("sourceUrl", ""),
            "thumbnail": img_path,
            "featured": c.get("featured", False)
        })

    # ── 2. Fetch and parse EvoLinkAI data ──
    evolink_url = "https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/README.md"
    evolink_content = fetch_url(evolink_url)
    
    # Detect category headers
    section_map = [
        ("## 🛒 E-commerce Cases", "Products & E-commerce"),
        ("## 📣 Ad Creative Cases", "Posters & Typography"),
        ("## 🍌 Portrait & Photography Cases", "Photography & Realism"),
        ("## 🎨 Poster & Illustration Cases", "Illustration & Art"),
        ("## 🧍 Character Design Cases", "Characters & People"),
        ("## 📱 UI & Social Media Mockup Cases", "UI & Interfaces"),
        ("## 🧪 Comparison & Community Examples", "Other Use Cases"),
    ]
    
    # Split content by sections to assign accurate categories
    section_positions = []
    for header, cat_name in section_map:
        pos = evolink_content.find(header)
        if pos != -1:
            section_positions.append((pos, cat_name))
    section_positions.sort(key=lambda x: x[0])
    
    def get_category_for_pos(pos):
        current_cat = "Products & E-commerce"
        for s_pos, s_cat in section_positions:
            if pos >= s_pos:
                current_cat = s_cat
            else:
                break
        return current_cat

    case_pattern = re.compile(
        r"### Case\s+(\d+):\s*\[(.*?)\]\((.*?)\)(?:\s*\(by\s*\[(.*?)\]\((.*?)\)\))?",
        re.MULTILINE
    )
    
    matches = list(case_pattern.finditer(evolink_content))
    print(f"Parsing {len(matches)} cases from EvoLinkAI...")
    
    for i, m in enumerate(matches):
        c_num = int(m.group(1))
        c_title = m.group(2).strip()
        c_source_url = m.group(3).strip()
        c_author = m.group(4) or ""
        c_author_url = m.group(5) or ""
        
        start_pos = m.end()
        end_pos = matches[i+1].start() if i + 1 < len(matches) else len(evolink_content)
        block = evolink_content[start_pos:end_pos]
        
        img_match = re.search(r"<img\s+src=[\"\x27](.*?)[\"\x27]", block)
        thumbnail = img_match.group(1) if img_match else ""
        
        prompt_match = re.search(r"\*\*Prompt:\*\*\s*\n+```(?:[a-zA-Z0-9_-]*)\n(.*?)```", block, re.DOTALL)
        if not prompt_match:
            prompt_match = re.search(r"```(?:[a-zA-Z0-9_-]*)\n(.*?)```", block, re.DOTALL)
        prompt_text = prompt_match.group(1).strip() if prompt_match else ""
        
        category = get_category_for_pos(m.start())
        
        # Determine styles and scenes from title and prompt content
        styles = []
        scenes = []
        
        p_lower = (c_title + " " + prompt_text).lower()
        
        # Style heuristics
        if any(w in p_lower for w in ["photo", "dslr", "realistic", "macro", "candid", "portrait", "8k"]):
            styles.append("Realistic")
        if any(w in p_lower for w in ["3d", "render", "cgi", "blender", "octane", "miniature"]):
            styles.append("3D")
        if any(w in p_lower for w in ["poster", "typography", "layout", "banner", "cover"]):
            styles.append("Poster")
        if any(w in p_lower for w in ["illustrat", "drawing", "painting", "ghibli", "anime", "watercolor"]):
            styles.append("Illustration")
        if any(w in p_lower for w in ["ui", "interface", "dashboard", "screen", "mockup", "app"]):
            styles.append("UI")
        if any(w in p_lower for w in ["product", "packaging", "bottle", "sneaker", "perfume", "commerce"]):
            styles.append("Product")
        if any(w in p_lower for w in ["infographic", "chart", "diagram", "storyboard"]):
            styles.append("Infographic")
        if any(w in p_lower for w in ["brand", "logo", "identity"]):
            styles.append("Brand")
        if not styles:
            styles.append("Realistic")
            
        # Scene heuristics
        if any(w in p_lower for w in ["product", "commerce", "store", "e-commerce", "ad", "commercial"]):
            scenes.append("Commerce")
        if any(w in p_lower for w in ["tech", "ai", "data", "cyber", "system", "app", "dashboard"]):
            scenes.append("Tech")
        if any(w in p_lower for w in ["fashion", "clothing", "model", "outfit", "lookbook", "wear"]):
            scenes.append("Fashion")
        if any(w in p_lower for w in ["food", "beverage", "burger", "drink", "coffee", "restaurant"]):
            scenes.append("Food")
        if any(w in p_lower for w in ["social", "instagram", "tiktok", "weibo", "xiaohongshu"]):
            scenes.append("Social")
        if any(w in p_lower for w in ["story", "narrative", "cinematic", "film", "movie"]):
            scenes.append("Story")
        if any(w in p_lower for w in ["education", "guide", "diagram", "science", "learning"]):
            scenes.append("Education")
        if not scenes:
            scenes.append("Creative")
            
        all_prompts.append({
            "id": 1000 + c_num,
            "title": c_title,
            "imageAlt": c_title,
            "prompt": prompt_text,  # EXACT VERBATIM PROMPT
            "promptPreview": prompt_text[:200] + ("..." if len(prompt_text) > 200 else ""),
            "category": category,
            "styles": list(dict.fromkeys(styles)),
            "scenes": list(dict.fromkeys(scenes)),
            "source": "evolinkai",
            "sourceLabel": c_author or "EvoLink Community",
            "sourceUrl": c_source_url or c_author_url,
            "thumbnail": thumbnail,
            "featured": False
        })

    print(f"Total unified prompts compiled: {len(all_prompts)}")
    
    # ── 3. Build Style Taxonomy ──
    # Categories with counts
    category_counts = {}
    for p in all_prompts:
        cat = p["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
    style_counts = {}
    for p in all_prompts:
        for s in p.get("styles", []):
            style_counts[s] = style_counts.get(s, 0) + 1

    scene_counts = {}
    for p in all_prompts:
        for sc in p.get("scenes", []):
            scene_counts[sc] = scene_counts.get(sc, 0) + 1

    # Format taxonomy categories
    category_icons = {
        "UI & Interfaces": "💻",
        "Charts & Infographics": "📊",
        "Posters & Typography": "🎨",
        "Products & E-commerce": "🛍️",
        "Brand & Logos": "✏️",
        "Architecture & Spaces": "🏛️",
        "Photography & Realism": "📷",
        "Illustration & Art": "🖼️",
        "Characters & People": "👤",
        "Scenes & Storytelling": "🎬",
        "History & Classical Themes": "📜",
        "Documents & Publishing": "📄",
        "Other Use Cases": "⚡",
    }
    
    categories_list = []
    for cat_raw in styles_json.get("categories", []):
        cat_title = cat_raw["title"]["en"]
        categories_list.append({
            "id": cat_raw["id"],
            "value": cat_raw["value"],
            "title": cat_title,
            "title_zh": cat_raw["title"].get("zh", ""),
            "icon": category_icons.get(cat_title, "✨"),
            "count": category_counts.get(cat_title, 0),
            "description": cat_raw.get("description", {}).get("en", "")
        })

    # Sort categories by count descending
    categories_list.sort(key=lambda x: x["count"], reverse=True)

    # Styles list
    styles_list = []
    for s_raw in styles_json.get("styles", []):
        s_val = s_raw["value"]
        styles_list.append({
            "id": s_raw["id"],
            "value": s_val,
            "title": s_raw["title"]["en"],
            "title_zh": s_raw["title"].get("zh", ""),
            "count": style_counts.get(s_val, 0),
            "keywords": s_raw.get("keywords", [])
        })
    styles_list.sort(key=lambda x: x["count"], reverse=True)

    # Scenes list
    scenes_list = []
    for sc_raw in styles_json.get("scenes", []):
        sc_val = sc_raw["value"]
        scenes_list.append({
            "id": sc_raw["id"],
            "value": sc_val,
            "title": sc_raw["title"]["en"],
            "title_zh": sc_raw["title"].get("zh", ""),
            "count": scene_counts.get(sc_val, 0),
            "keywords": sc_raw.get("keywords", [])
        })
    scenes_list.sort(key=lambda x: x["count"], reverse=True)

    taxonomy = {
        "version": 1,
        "total_prompts": len(all_prompts),
        "sources": [
            {
                "id": "freestylefly",
                "name": "awesome-gpt-image-2",
                "stars": 32803,
                "count": len(freestyle_cases),
                "url": "https://github.com/freestylefly/awesome-gpt-image-2"
            },
            {
                "id": "evolinkai",
                "name": "awesome-gpt-image-2-API-and-Prompts",
                "stars": 17214,
                "count": len(matches),
                "url": "https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts"
            }
        ],
        "categories": categories_list,
        "styles": styles_list,
        "scenes": scenes_list,
        "templates": styles_json.get("templates", [])
    }

    # ── 4. Write output files ──
    curated_prompts_file = DATA_DIR / "curated_prompts.json"
    style_taxonomy_file = DATA_DIR / "style_taxonomy.json"
    
    with open(curated_prompts_file, "w", encoding="utf-8") as f:
        json.dump({
            "version": 1,
            "total": len(all_prompts),
            "prompts": all_prompts
        }, f, indent=2, ensure_ascii=False)
        
    with open(style_taxonomy_file, "w", encoding="utf-8") as f:
        json.dump(taxonomy, f, indent=2, ensure_ascii=False)
        
    print(f"Wrote {curated_prompts_file} ({curated_prompts_file.stat().st_size:,} bytes)")
    print(f"Wrote {style_taxonomy_file} ({style_taxonomy_file.stat().st_size:,} bytes)")
    print("Done building prompt dataset!")

if __name__ == "__main__":
    build_dataset()
