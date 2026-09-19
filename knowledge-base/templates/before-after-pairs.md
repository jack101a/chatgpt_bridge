# Before/After Prompt Pairs

Documented prompt transformations showing common improvements. These focus on
craft improvements — quality, platform-appropriate syntax, efficient negatives
— not filter evasion.

## Pair 1: Comma Tags → Natural Language (SD → Flux)

**Before (SD syntax, poor on Flux):**
```
1girl, solo, park bench, sitting, autumn coat, curly hair, smiling, golden
hour, 85mm, shallow dof, photorealistic, 8k
```

**After (Flux natural language):**
```
A photorealistic image of a woman with curly hair sitting on a park bench,
wearing an autumn coat, smiling. In a park with autumn foliage. Soft golden
hour light filtering through trees. Shot with an 85mm lens, shallow depth of
field. Warm, peaceful atmosphere. Highly detailed skin texture, 8k quality.
```

**Why:** Flux responds to natural language sentences, not comma tags. The
after-version reads like a description to a photographer, which Flux's
language model understands better.

## Pair 2: Over-Weighted → Balanced (SD)

**Before (artifacts from over-weighting):**
```
(beautiful:2.5), (detailed eyes:3.0), (perfect skin:2.0), 1girl, portrait
```

**After (clean, balanced):**
```
(beautiful:1.3), (detailed eyes:1.4), detailed skin:1.2, 1girl, portrait,
photorealistic, 8k
```

**Why:** Weights above ~2.0 cause artifacts — distorted features, burned
highlights, unnatural proportions. Keep key terms at 1.2-1.5. Let quality
tags carry the rest.

## Pair 3: Stacked Synonyms → Efficient (SD Negative)

**Before (redundant):**
```
worst quality, low quality, bad quality, terrible quality, bad anatomy, bad
hands, extra fingers, deformed, mutated, ugly, blurry, cropped
```

**After (efficient):**
```
worst quality:1.4, low quality:1.4, bad anatomy, bad hands, extra fingers,
deformed, watermark
```

**Why:** Stacking synonyms ("worst" + "low" + "bad" + "terrible" quality)
wastes tokens without adding signal. One weighted term + specific defects
is more effective.

## Pair 4: SD1.5 Negatives on SDXL → SDXL-Appropriate

**Before (hurts SDXL quality):**
```
worst quality:1.4, low quality:1.4, bad anatomy, bad hands, extra fingers,
deformed, mutated, watermark, signature, text, jpeg artifacts, blurry,
cropped, out of frame, clone face, disfigured, cross-eyed
```

**After (SDXL minimal):**
```
3d, illustration, deformed
```

**Why:** SDXL is strong enough that heavy negatives hurt quality. SDXL
responds best to minimal 8-token negative blocks. Over-negating pushes
the model away from its training distribution.

## Pair 5: Vague → Specific (Any Platform)

**Before (vague):**
```
pretty woman in nice setting
```

**After (specific):**
```
woman with auburn hair in a braid, green eyes, light freckles, wearing a
cream linen blouse, seated at a wooden cafe table by a window, soft morning
light, 50mm lens, shallow depth of field, photorealistic, warm tones
```

**Why:** Vague prompts produce generic results. Specificity in hair, eyes,
clothing, setting, lighting, and lens gives the model concrete anchors.

## Pair 6: Missing Lighting → Atmospheric (Any Platform)

**Before (flat):**
```
portrait of man, suit, office, photorealistic
```

**After (atmospheric):**
```
portrait of man in charcoal suit, standing in corner office at dusk, city
lights bokeh through floor-to-ceiling windows, rim lighting from window,
low-key dramatic lighting, 85mm portrait lens, cinematic, photorealistic
```

**Why:** Lighting is the single biggest quality multiplier. "Dusk", "city
lights bokeh", "rim lighting", "low-key" transform a flat portrait into a
cinematic scene.

## Pair 7: No Composition → Composed (Any Platform)

**Before (unstructured):**
```
woman walking in city
```

**After (composed):**
```
full body shot, woman walking through rain-soaked Tokyo street at night,
low camera angle, 35mm anamorphic lens, neon signs reflecting in puddles,
leading lines of wet pavement drawing eye to subject, shallow depth of
field, cinematic color grade, --ar 21:9
```

**Why:** Camera angle, lens, leading lines, and aspect ratio create
intentional composition. The before-version leaves composition to chance.

## Pair 8: Tag Salad → Structured (SD)

**Before (unstructured):**
```
girl, park, trees, bench, autumn, coat, smile, hair, light, 8k, detailed,
realistic, nice, pretty, good
```

**After (structured):**
```
1girl, solo, sitting on park bench, wearing autumn coat, curly auburn hair,
smiling, park with autumn foliage, golden hour backlight, rim lighting,
eye-level, medium close-up, photorealistic, 8k uhd, detailed skin, Fujifilm,
shallow depth of field
```

**Why:** Structure follows the universal formula: Subject → Pose → Clothing
→ Setting → Lighting → Camera → Shot → Style → Quality. Each tag adds
specific signal rather than vague adjectives.

## Pair 9: Midjourney Without Parameters → With Parameters

**Before (no control):**
```
woman with curly hair in autumn park, photorealistic
```

**After (full control):**
```
woman with curly hair, autumn coat, sitting on park bench, golden hour
light, autumn foliage, photorealistic, --ar 3:2 --stylize 250 --raw --no
text, watermark, blur
```

**Why:** `--ar` sets composition, `--stylize 250` controls artistic
interpretation, `--raw` for photorealism, `--no` suppresses common defects.

## Pair 10: DALL-E Without Style → With Style Direction

**Before (generic):**
```
a picture of a woman in a park
```

**After (directed):**
```
Create a photorealistic image of a woman with curly auburn hair sitting on
a wooden park bench. She wears a cream autumn coat and smiles softly. The
park has golden fall foliage with soft morning light filtering through
trees. Shot at eye level with a shallow depth of field. Warm, peaceful,
contemplative mood. Portrait orientation. HD quality, vivid style.
```

**Why:** DALL-E 3 responds to conversational detail. "Vivid style" vs
"natural style" controls color saturation. Specifying orientation and
mood gives DALL-E concrete direction.

## Analysis: What Makes Transformations Work

1. **Specificity over vagueness** — concrete nouns and adjectives beat
   generic terms.
2. **Platform-appropriate syntax** — tags for SD, sentences for Flux/DALL-E,
   descriptors+params for Midjourney.
3. **Lighting is the biggest multiplier** — always specify light source,
   quality, and direction.
4. **Composition is intentional** — camera angle, lens, shot size, framing.
5. **Efficient negatives** — one weighted term + specific defects, not
   synonym stacking.
6. **Balanced weighting** — 1.2-1.5 for emphasis, never above 2.0.
7. **Structure follows formula** — Subject → Style → Lighting → Composition
   → Mood → Technical.

## Quick Reference

- Vague → specific (hair, eyes, clothing, setting, light, lens)
- Over-weighted → balanced (1.2-1.5 max)
- Synonym stack → one weighted term + specifics
- SD1.5 negatives → SDXL minimal (3-8 tokens)
- No lighting → atmospheric (source, quality, direction)
- No composition → composed (angle, lens, framing, ratio)
- Tag salad → structured formula
- No params → full Midjourney params
- Generic DALL-E → conversational with style direction
