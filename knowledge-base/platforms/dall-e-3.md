# DALL·E 3 — Prompt Engineering

DALL·E 3 is OpenAI's image generator, accessed via ChatGPT or the API. It has excellent natural-language understanding and text rendering, but **strict content filters** that make it unsuitable for NSFW work.

---

## Overview

- **Provider:** OpenAI.
- **Access:** ChatGPT (conversational) or API.
- **Prompt style:** Natural language, conversational. Describe what you want in sentences.
- **Text rendering:** Excellent — best-in-class for text-in-image.
- **Content filter:** Very strict. Pre-generation + post-generation checks.

---

## How It Differs From Other Platforms

| Platform | Prompt style | Parameters | Negatives | Filter |
|----------|--------------|------------|-----------|--------|
| DALL·E 3 | Full sentences | None (text only) | None | Very strict |
| Stable Diffusion | Comma tags | Weights, BREAK, AND | Essential | Depends on model |
| Midjourney | Descriptors + `--` | Many (`--ar`, `--stylize`...) | `--no` | PG-13 |
| Flux | Natural sentences | CFG/sampler (workflow) | Barely needed | Depends on variant |

DALL·E 3 is the only mainstream platform with **zero parameters**. Everything is expressed in text.

---

## Prompt Style

DALL·E 3 is conversational. You describe the image in plain sentences, like talking to a designer.

```
A cozy reading nook with a plush armchair, a warm lamp, and a bookshelf full of colorful books, soft afternoon light streaming through a window
```

It understands context, composition, and relationships well. No comma-tags, no parameters.

---

## Prompt Anatomy

A strong DALL·E 3 prompt has four parts:

1. **Subject** — who or what is in the image.
2. **Setting** — where the scene takes place.
3. **Lighting/mood** — atmosphere, light quality, color palette.
4. **Style** — photorealistic, illustration, cinematic, etc.

```
[Subject] A woman with a vintage camera,
[Setting] standing in a Paris street market,
[Lighting] golden hour light, warm tones,
[Style] photorealistic, shallow depth of field
```

Combine them into flowing sentences. DALL·E 3 rewards coherence over keyword density.

---

## No Parameters

DALL·E 3 has **no `--` parameters**. Instead, you specify everything in plain text:

### Aspect Ratio
```
"wide landscape"  → 16:9
"tall portrait"   → 9:16
"square"          → 1:1
```

### Quality
```
"hd"  → higher quality
```

### Style
```
"vivid"    → more colorful, artistic
"natural"  → more realistic, subdued
```

### Example with in-text parameters
```
A wide landscape of a misty mountain range at sunrise, pine trees in the foreground, hd, natural
```

---

## Conversational Revision

One of DALL·E 3's strengths is **conversational revision**. In ChatGPT, you can ask it to refine the image:

```
"Make the lighting warmer."
"Change the background to a city skyline."
"Add a cat sitting on the armchair."
```

It revises the existing image rather than regenerating from scratch. This is powerful for iterative refinement.

### Revision Workflow
1. Generate an initial image.
2. Ask for one change at a time.
3. Build up the final image incrementally.
4. Request "hd" and a specific aspect ratio in the final pass.

---

## Text Rendering

DALL·E 3 is the **best** at rendering legible text in images. Use it for:
- Logos, signage, posters.
- Book covers, titles.
- Any image where text accuracy matters.

```
A vintage travel poster for "PARIS 1920" with art deco lettering, Eiffel Tower in the background
```

---

## Content Filter

DALL·E 3 has **very strict** content filters:

- **Pre-generation check:** The prompt is screened before generation.
- **Post-generation check:** Output is screened after generation.
- **Result:** Refuses most NSFW content outright.

### Workarounds
- **Very limited.** Artistic framing sometimes works, but the filter is aggressive.
- Explicit anatomical terms are blocked.
- Even implied nudity is often rejected.
- **Not a reliable platform for NSFW.**

---

## Best For

DALL·E 3 excels at:
- **SFW content** — portraits, scenes, illustrations.
- **Text-in-image** — posters, logos, signage.
- **Commercial-safe imagery** — no filter issues, safe for business use.
- **Conversational iteration** — refining images through dialogue.

---

## Common Mistakes

- **Keyword-stuffing** — "photorealistic, ultra detailed, 8k, masterpiece" wastes tokens. Describe instead.
- **Ignoring aspect ratio** — images default to square; say "wide" or "tall" explicitly.
- **Expecting NSFW** — it will refuse. Use a different platform.
- **Not iterating** — the conversational revision is the killer feature; use it.

---

## Example Prompts

### SFW Portrait
```
A warm portrait of a woman with curly hair and a gentle smile, wearing a mustard sweater, sitting by a window with soft golden light, cozy atmosphere, photorealistic
```

### Text-in-Image
```
A minimalist poster with the text "SUMMER SALE" in bold modern typography, a sun and palm tree illustration, clean white background, vibrant colors
```

### Landscape
```
A wide landscape of a misty mountain range at sunrise, pine trees in the foreground, a winding river reflecting the orange sky, cinematic, natural colors
```

### Product Shot
```
A product photo of a ceramic teapot on a wooden table, soft studio lighting, minimalist composition, cream background, high-end commercial photography
```

### Illustration
```
A whimsical children's book illustration of a fox reading a book under a giant mushroom, warm watercolor style, soft edges, gentle colors
```

---

## Quick Reference

- **Provider:** OpenAI, via ChatGPT or API.
- **Prompt:** natural language, conversational sentences.
- **No parameters** — specify aspect ratio ("wide landscape"), quality ("hd"), style ("vivid"/"natural") in text.
- **Conversational revision:** ask ChatGPT to refine.
- **Text rendering:** best-in-class.
- **Filter:** pre + post generation, very strict, refuses most NSFW.
- **Workarounds:** very limited, filter is aggressive.
- **Best for:** SFW, illustrations, text-in-image, commercial-safe imagery.