# Negative Prompts

## Overview

A negative prompt tells the model what **not** to include. It works because Stable Diffusion's sampler steers the denoising process away from the token concepts in the negative field. Getting negatives right is often the difference between usable output and a "same-face, six-fingered, watermarked" disaster.

Critical rule up front: **the optimal negative prompt depends on the model.** The famous SD1.5 negative lists actively *hurt* SDXL and Flux outputs.

---

### Why Negative Prompts Work

During sampling, the model predicts noise both for the positive prompt and the negative prompt. It steers toward the positive and away from the negative. Effectively:

```
final_image ≈ positive_attraction − negative_repulsion
```

Over-weighting the repulsion term produces washed-out, lifeless images. Undershooting produces artifacts.

---

## Universal Negatives (SD1.5)

This is the battle-tested SD1.5 baseline. Apply it via the negative prompt field with A1111 weighting syntax:

```
worst quality:1.4, low quality:1.4, bad anatomy, bad hands,
extra fingers, fewer fingers, deformed, mutated, watermark, signature,
text, jpeg artifacts, blurry, cropped, out of frame, clone face,
disfigured, cross-eyed
```

Breakdown by category:

| Category | Terms |
|----------|-------|
| Quality | `worst quality:1.4`, `low quality:1.4`, `jpeg artifacts`, `blurry` |
| Anatomy | `bad anatomy`, `bad hands`, `extra fingers`, `fewer fingers`, `deformed`, `mutated`, `disfigured`, `cross-eyed` |
| Media pollution | `watermark`, `signature`, `text` |
| Framing | `cropped`, `out of frame` |
| Face | `clone face` |

**Why weights on quality terms?** `worst quality:1.4` and `low quality:1.4` are nearly synonymous — you pick *one*, weighted, not all three stacked (see Common Mistakes).

---

## SDXL Negatives — Less Is More

SDXL has **stronger base quality** and its tokenizer handles concept separation differently. The heavyweight SD1.5 lists are counterproductive.

Recommended minimal negative:

```
3d, illustration, deformed
```

Or for most cases, even shorter:

```
deformed, 3d
```

Key points:

- SDXL produces "plastic" or "3D-render" artifacts when prompted with photography terms — `3d`, `illustration` suppress this
- **8-token blocks** matter more than raw length — SDXL processes the negative prompt in its own token scheme; a short, clean block works better than a wall of text
- Over-negating on SDXL causes:
  - Flat, lifeless color
  - Reduced contrast
  - "AI-clipped" aesthetic where everything is mid-tone beige
- If a specific artifact appears (extra fingers), add one specific negative for it — don't import the whole SD1.5 list

---

## Flux Negatives — Barely Needed

Flux is a strong base model with good instruction-following. The negative prompt field is supported but often unnecessary.

Guidance:

- **Start with an empty negative prompt.**
- If text artifacts appear: `text, watermark`
- That's usually all you ever need.

Flux's architecture (separate text encoder + diffusion transformer) means it rarely produces the anatomy horrors of SD1.5. Adding SD1.5-style negatives to Flux degrades quality noticeably.

---

## Midjourney — `--no` Parameter

Midjourney does not have a negative prompt field. Use `--no`:

```
/imagine prompt: cinematic portrait of a woman --no text, watermark, blur
```

Rules:

- `--no` accepts comma-separated terms
- It's a *suggestion*, not a hard constraint — MJ sometimes includes the banned element anyway
- Better strategy in MJ: **describe what you want** positively (see DALL-E note below)
- Don't list more than 3–4 items in `--no`; MJ starts ignoring the list

---

## DALL-E 3 — No Negative Prompt

DALL-E 3 has **no negative prompt support at all**.

The only lever: describe what you want, explicitly.

```
Bad: "photo of a woman, no glasses, no tattoos"
Good: "photo of a young woman with clear skin, no accessories,
plain background, natural daylight"
```

The "Good" version works because DALL-E 3 renders from the positive description. "No glasses" often *adds* glasses (the token fires the concept).

---

## EasyNegative Embedding (SD1.5)

EasyNegative is a **pre-trained textual-inversion embedding** that condenses a long negative list into one token.

- Place `EasyNegative` in the negative prompt field (A1111: `Negative Embedding` dropdown)
- Download from Civitai/HuggingFace (e.g. `EasyNegative.safetensors` or `.pt`)
- Typical usage: `EasyNegative, (worst quality:1.3), bad anatomy`

Why use it:

- Saves prompt space (long negative lists count against the 75-token budget... in some UIs)
- Acts as a compressed "general badness" prior
- **SD1.5 only** — do not use with SDXL (mismatched embedding dimension, causes errors or silent quality loss)

---

## NSFW-Specific Negatives

For adult content generation, add anatomy-focused negatives (SD1.5 / uncensored models):

```
bad anatomy (genitalia), extra limbs, fused fingers, malformed,
plastic skin, doll-like, uncanny, oversaturated
```

Notes:

- `plastic skin`, `doll-like`, `uncanny` fight the "wax skin" look common in some fine-tunes
- `oversaturated` fights neon-barf colors
- `extra limbs` is the classic NSFW-body horror term — keep it
- Use these in *addition to* the universal baseline, not instead of it

---

## Common Mistakes

| Mistake | Why it fails |
|---------|--------------|
| Stacking synonyms (`worst quality, low quality, bad, poor, ugly`) | Same concept — redundant, eats token budget, no added suppression |
| Over-weighting negatives (`bad hands:2.0`) | Washed out, gray, or anatomy collapses in the opposite direction |
| SD1.5 negatives on SDXL | Quality degrades; flat colors, lifeless output |
| SDXL negatives on Flux | Unnecessary — Flux rarely produces those artifacts |
| `EasyNegative` on SDXL | Dimension mismatch; silent failure or worse output |
| Negatives fighting the positive | e.g. positive "slim body" + negative "skinny" = tug of war, mediocre both |
| Long negative lists on MJ `--no` | MJ ignores lists beyond 3–4 items |

---

## Template Examples

### Portrait (SD1.5)

**Positive:**
```
(masterpiece:1.2), (portrait of a woman:1.3), (intricate braided hair:1.4),
golden hour light, studio lighting, (detailed eyes:1.3)
```

**Negative:**
```
EasyNegative, (worst quality:1.4), bad anatomy, bad hands, extra fingers,
deformed, watermark, signature, text, jpeg artifacts, blurry, cropped,
clone face, cross-eyed
```

### Full Body (SDXL)

**Positive:**
```
photorealistic full body shot of an athletic man, beach at sunset,
gritty film photography, f/2.8 shallow depth of field
```

**Negative:**
```
3d, illustration, deformed
```

### NSFW (uncensored SD1.5 fine-tune)

**Positive:**
```
(masterpiece:1.2), sensual portrait, (voluptuous woman:1.3), elegant
boudoir setting, soft warm lighting, (detailed skin texture:1.2)
```

**Negative:**
```
EasyNegative, (worst quality:1.4), bad anatomy (genitalia), extra limbs,
fused fingers, malformed, plastic skin, doll-like, uncanny, oversaturated,
watermark, text
```

### Flux

**Positive:**
```
A candid photograph of a woman reading a book in a sunlit cafe,
window light, film grain
```

**Negative:** *(empty, or `text, watermark` if needed)*

---

## Quick Reference

| Model | Negative strategy | Length |
|-------|-------------------|--------|
| SD1.5 | Full universal list + EasyNegative | Long (15–25 terms) |
| SDXL | Minimal: `3d, illustration, deformed` | 3–8 tokens |
| Flux | Barely any: `text, watermark` | 0–2 terms |
| Midjourney | `--no text, watermark, blur` (3–4 max) | Short |
| DALL-E 3 | None — describe positives only | N/A |

**Rules of thumb:** match the negatives to the model, never stack synonyms, keep weights ≤1.5 on negatives, and if your output looks flat/gray, your negatives are too aggressive.
