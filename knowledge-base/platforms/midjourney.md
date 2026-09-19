# Midjourney — Prompt Engineering

Midjourney is a Discord-based, subscription image generator. It produces some of the most aesthetically pleasing images, but has a strict PG-13 content filter. Prompting uses concise comma-separated descriptors plus `--` parameters.

---

## Overview: V6 / V7 / V8

Midjourney versions change behavior significantly.

### V6
- **Released:** 2023.
- **Style:** More photorealistic, better prompt adherence.
- **Parameters:** `--v 6`.

### V7
- **Released:** 2024.
- **Style:** Improved coherence, better text rendering, more natural language tolerance.
- **Parameters:** `--v 7`.

### V8
- **Released:** 2025.
- **Style:** Latest, best quality, refined aesthetics.
- **Parameters:** `--v 8`.

All versions are **Discord-based** and require a **subscription**. You prompt in a Discord channel and Midjourney returns images.

---

## Version Comparison

| Version | Release | Strength | Best for |
|---------|---------|----------|----------|
| V6 | 2023 | Photorealistic, prompt adherence | Realistic portraits |
| V7 | 2024 | Coherence, text rendering | Detailed scenes, text |
| V8 | 2025 | Refined aesthetics, best quality | Anything, flagship |

---

## Prompt Style

Midjourney uses **comma-separated concise descriptors** plus parameters. Unlike Flux, it's not full sentences — it's a compact list of visual concepts.

```
cinematic portrait, woman, auburn hair, green eyes, soft light, forest background --ar 2:3 --v 7
```

The model fills in the aesthetic details. You provide the subject, setting, and mood.

---

## Prompt Anatomy

A strong Midjourney prompt has:

1. **Subject** — what's in the image.
2. **Details** — appearance, clothing, expression.
3. **Setting** — background, environment.
4. **Mood/style** — lighting, atmosphere, medium.
5. **Parameters** — aspect ratio, version, stylize.

```
[subject] cinematic portrait, [details] woman, auburn hair, green eyes, [setting] forest background, [mood] soft light, [params] --ar 2:3 --v 7
```

---

## Parameters

| Parameter | Range | Purpose |
|-----------|-------|---------|
| `--ar` | any ratio | Aspect ratio (e.g., `--ar 16:9`, `--ar 2:3`). |
| `--stylize` | 0–1000 | Artistic interpretation. Higher = more stylized, less literal. |
| `--chaos` | 0–100 | Variation between images in a batch. Higher = more diverse. |
| `--weird` | 0–3000 | Surreal/abstract deviation. |
| `--no` | list | Negative prompt (e.g., `--no text, watermark`). |
| `--sref` | URL | Style reference image. |
| `--cref` | URL | Character reference image. |
| `--cw` | 0–100 | Character reference strength (with `--cref`). |
| `--v` | 6/7/8 | Version. |
| `--raw` | flag | Photorealism mode, less stylization. |
| `--hd` | flag | Higher detail. |
| `--q` | 0.25–1 | Quality/effort. |
| `--p` | profile | Personalization profile. |

---

## Style & Character References

### Style Reference (`--sref`)
Pulls the visual style from a reference image URL.
```
cinematic portrait --sref https://example.com/style.jpg
```

### Character Reference (`--cref`)
Keeps a character consistent across images.
```
woman in a red dress --cref https://example.com/char.jpg --cw 100
```
- `--cw 0` = only face consistency.
- `--cw 100` = full character (face + clothing + body) consistency.

### Workflow Tip
Generate one character, save the image URL, then use `--cref` with that URL for every subsequent prompt. This gives consistent characters across a series.

---

## Content Filter

Midjourney has a **strict PG-13 filter**. It blocks explicit content aggressively.

### Banned Words (200+)
The filter blocks words including:
```
breasts, nude, cleavage, nipples, penis, vagina, erotic, sensual, lingerie, voluptuous, seductive, ...
```

Any prompt containing these is rejected or heavily sanitized.

---

## Workarounds (Artistic Framing)

Midjourney's filter is strict, but **artistic framing** can bypass it. The key is to describe the scene in artistic, editorial, or classical terms rather than explicit anatomical terms.

### Techniques
- **Artistic framing:** "Renaissance painting," "classical sculpture," "museum artwork."
- **Fashion editorial language:** "high fashion editorial," "runway look," "couture."
- **Boudoir photography terms:** "boudoir," "intimate," "soft shadows," "silk sheets."
- **Implied rather than explicit:** Suggest nudity through context, silhouette, or drapery instead of naming body parts.

### Raw Mode vs Stylize
- **`--raw`** = photorealism, less stylization. Good for realistic editorial shots.
- **`--stylize`** high = more artistic, painterly. Good for classical/artistic framing.

---

## Common Mistakes

- **Forgetting `--v`** — results vary wildly across versions; pin the version.
- **Over-stylizing** — `--stylize 1000` destroys subject fidelity.
- **Long sentences** — Midjourney wants descriptors, not paragraphs.
- **Using banned words** — instant rejection. Use artistic language.
- **No aspect ratio** — defaults to square; specify `--ar` for your use case.

---

## Example Prompts

### SFW Portrait
```
cinematic portrait, woman with auburn hair, green eyes, soft window light, cream blouse, studio background, shallow depth of field --ar 2:3 --v 7 --stylize 250
```

### Fashion Editorial
```
high fashion editorial, woman in flowing silk gown, dramatic studio lighting, minimalist background, vogue style, elegant pose --ar 3:4 --v 7 --stylize 400
```

### Landscape
```
breathtaking mountain landscape at sunrise, golden light, misty valleys, alpine lake reflection, epic scale --ar 16:9 --v 8 --stylize 100
```

### Artistic-Nude Workaround
```
Renaissance oil painting, reclining female figure, classical drapery, soft chiaroscuro lighting, museum artwork, elegant composition, marble and silk textures --ar 3:4 --v 7 --stylize 600
```
This frames the subject as classical art, avoiding explicit anatomical terms while implying the subject.

---

## Quick Reference

- **V6/V7/V8**, Discord-based, subscription required.
- **Prompt:** comma-separated descriptors + `--` parameters.
- **Key params:** `--ar`, `--stylize`, `--chaos`, `--weird`, `--no`, `--sref`, `--cref`, `--cw`, `--v`, `--raw`, `--hd`, `--q`, `--p`.
- **`--sref`** = style ref, **`--cref`** = character ref, `--cw 0–100` controls strength.
- **Filter:** PG-13 strict, 200+ banned words.
- **Workarounds:** artistic framing, fashion editorial, boudoir terms, implied not explicit.
- **`--raw`** = photorealism; **`--stylize`** high = artistic.