# Stable Diffusion — Platform Guide

Stable Diffusion is the open-source text-to-image family. Runs locally (A1111, ComfyUI, Forge) or via API. Most flexible, most controllable, and the platform where prompt syntax matters most.

---

## Overview: SD1.5, SDXL, SD3

The Stable Diffusion family spans three major generations. They differ in architecture, token handling, and prompt sensitivity.

### SD1.5
- **Released:** 2022. The classic.
- **Resolution:** 512×512 native.
- **Architecture:** Single CLIP ViT-L/14 text encoder, 75-token context.
- **Prompt style:** Comma-separated tags. Very literal — the model reads tags like a checklist.
- **Negative prompts:** **Essential.** SD1.5 produces artifacts, bad hands, and deformed anatomy without strong negatives.
- **Ecosystem:** Huge. Thousands of fine-tunes (realisticVision, dreamshaper, epicrealism, etc.) and LoRAs.
- **Best for:** Fast local generation, heavy fine-tune ecosystem, NSFW-capable base models.

### SDXL
- **Released:** 2023. Big upgrade.
- **Resolution:** 1024×1024 native.
- **Prompt architecture:** Dual text encoders (OpenCLIP ViT-bigG + CLIP ViT-L), 77-token context each.
- **Prompt style:** Still comma-tags, but more tolerant of natural language. Reads better with a subject + style + quality structure.
- **Negative prompts:** Minimal needed. SDXL is much stronger — heavy negatives can actually hurt. Use short 8-token negative blocks.
- **Best for:** Higher quality, better anatomy, less negative-prompt dependence.

### SD3 / SD3.5
- **Released:** 2024.
- **Architecture:** Three text encoders (CLIP-L, CLIP-G, T5-XXL). T5 gives a **much larger context window** — full sentences, no 75-token chunking.
- **Prompt style:** Natural language sentences. Comma-tags underperform.
- **Negative prompts:** Largely unnecessary. SD3 is strong enough that negatives barely matter.
- **Caveat:** Base SD3 was heavily safety-filtered at release. NSFW requires fine-tunes or LoRAs.

---

## Prompt Syntax

### Comma-Separated Tags
The core of SD1.5/SDXL prompting. Each comma-separated phrase is a concept the model tries to render.

```
masterpiece, best quality, 1girl, long hair, blue eyes, white dress, standing, forest background, soft lighting
```

### Parentheses Weighting
Two forms:

**Implicit multiplier** — each `(word)` adds ~1.1× weight:
```
(masterpiece), (best quality), (detailed face)
```

**Explicit value** — `(word:1.5)` sets exact weight. Range ~0.5–1.5 is sane; beyond that you get artifacts.
```
(1girl:1.3), (detailed eyes:1.2), (white dress:1.1)
```

### Square Brackets — De-emphasis
`[word]` reduces weight (~0.9×). Use to suppress unwanted elements.
```
[watermark], [text], [blurry]
```

### BREAK Keyword
SD1.5 CLIP context is 75 tokens. `BREAK` forces a hard chunk boundary, letting you separate concepts so they don't bleed together.
```
1girl, white dress, forest, BREAK, masterpiece, best quality, detailed face
```

### AND Syntax — Concept Blending
Blends two concepts with independent weights. Syntax: `concept1 AND concept2::weight`.
```
a cat AND a dog::0.5
```
The `::0.5` weights the second concept relative to the first. Useful for mixing styles or subjects.

---

## Platform Differences

The same syntax behaves differently across tools:

| Platform | Weight handling | Notes |
|----------|----------------|-------|
| **A1111 / Forge** | Normalizes weights to a 0.5–1.5 range | `(word:1.5)` becomes ~1.15 internally. Safe, forgiving. |
| **ComfyUI** | Uses literal values | `(word:1.5)` means exactly 1.5. Can oversaturate if you push high. |
| **NovelAI** | Uses `{word}` braces for emphasis | `{word}` = upweight, `[word]` = downweight. Different syntax entirely. |

**Practical rule:** If a prompt works in A1111 but looks overcooked in ComfyUI, reduce explicit weights.

---

## Token Limits

- **SD1.5:** 75 tokens per CLIP chunk. Beyond that, extra tokens are ignored or cause chunk bleed. Use `BREAK` to manage chunks.
- **SDXL:** Dual encoders, 77 tokens each. More headroom, but still finite.
- **SD3:** T5-XXL gives a large context window. Long natural-language prompts work fine.

---

## Negative Prompts

### SD1.5 — Heavy Negatives Required
SD1.5 degrades without strong negatives. Build a solid universal negative block:

```
worst quality:1.4, low quality:1.4, bad anatomy, bad hands, extra fingers, deformed, watermark, signature, text, blurry, jpeg artifacts, EasyNegative
```

`EasyNegative` is a popular embedding that bundles many common failure modes into one token.

### SDXL — Minimal
SDXL is strong enough that heavy negatives hurt. Use a short 8-token block:

```
worst quality, low quality, bad anatomy, watermark
```

Over-negativing SDXL can wash out contrast and detail.

---

## NSFW Capabilities

Stable Diffusion is the most NSFW-capable open platform — **if** you use the right base model.

### Requirements
- **NSFW-capable base model** or LoRA: realisticVision, dreamshaper, epicrealism, or dedicated NSFW fine-tunes.
- Base SD1.5/SDXL/SD3 are **not** inherently NSFW-capable — they need fine-tuning or LoRAs.

### Settings for Cleaner Skin
- **CFG 4–6** (lower than the default 7) reduces plastic/over-processed skin.
- **More steps** (30–50) for smoother detail.
- **Samplers:** DPM++ 2M Karras or Euler a are the community favorites for skin texture.

---

## Common Mistakes

- **Stacking synonyms** — `beautiful, pretty, gorgeous, stunning` dilutes weight instead of adding it. Pick one strong descriptor.
- **Over-weighting** — `(1girl:2.0)` or higher causes artifacts, color bleed, and broken anatomy. Stay ≤1.5.
- **Model-mismatched token styles** — Using SD1.5 comma-tags on SD3, or SD3 sentences on SD1.5. Match the prompt style to the model generation.
- **Ignoring negatives on SD1.5** — leads to deformed hands and faces.
- **Forgetting resolution** — prompting 4K/8K on a 512 model does nothing; the model renders at its native res.

---

## Example Prompts

### SFW Portrait
```
(masterpiece:1.2), (best quality:1.2), 1girl, (detailed face:1.1), long auburn hair, green eyes, soft smile, white blouse, studio portrait, soft window light, shallow depth of field, 8k, photorealistic
Negative: worst quality, low quality, bad anatomy, bad hands, extra fingers, watermark, blurry
```

### NSFW Example (anatomical terms)
```
(masterpiece:1.2), 1girl, nude, (large breasts:1.3), (detailed nipples:1.2), (curvy body:1.1), lying on silk sheets, soft warm lighting, bedroom, photorealistic, (detailed skin texture:1.1)
Negative: worst quality, low quality, bad anatomy, bad hands, deformed, watermark, blurry
```

---

## Quick Reference

- **SD1.5:** 512px, comma-tags, 75-token CLIP, heavy negatives required.
- **SDXL:** 1024px, dual encoders, lighter negatives, more natural language.
- **SD3:** T5-XXL, large context, natural sentences, no negatives needed.
- **Weighting:** `(word)` = 1.1×, `(word:1.5)` = explicit, `[word]` = de-emphasis.
- **BREAK** = 75-token chunk separator (SD1.5).
- **AND** = concept blending, `concept1 AND concept2::weight`.
- **A1111** normalizes weights; **ComfyUI** uses literals; **NovelAI** uses `{}`.
- **NSFW:** needs NSFW base model/LoRA, CFG 4–6, DPM++ 2M Karras or Euler a.
- **Mistakes:** synonym stacking, over-weighting, model-mismatched styles.