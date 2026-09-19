# Flux — Prompt Engineering

Flux is Black Forest Labs' modern diffusion family. It uses a completely different prompt paradigm than Stable Diffusion: **natural language sentences**, not comma-tags. It's the current state of the art for open-source image generation.

---

## Overview: Flux Variants

Flux comes in several flavors, each with different access and capabilities.

### Flux Dev
- **Type:** Open, runs locally.
- **License:** Non-commercial (dev license). Free for personal/research use.
- **Quality:** High. Near state-of-the-art for open models.
- **Prompt style:** Natural language sentences.
- **NSFW:** Possible locally with LoRAs.

### Flux Schnell
- **Type:** Fast, open, local.
- **Speed:** Optimized for speed — 1–4 steps.
- **Quality:** Lower than Dev, but very fast.
- **Best for:** Rapid iteration, previews, real-time.

### Flux Pro
- **Type:** API-only, commercial.
- **Quality:** Highest tier.
- **Access:** Via BFL API or partners.
- **Filtering:** API is content-filtered.

### Chroma 8.9B
- **Type:** Uncensored variant.
- **Capability:** Fully uncensored — no content filter.
- **Best for:** NSFW generation without LoRA workarounds.
- **Note:** Runs locally; check the specific distribution for setup.

---

## Variant Comparison

| Variant | Access | Speed | Quality | NSFW | Best for |
|---------|--------|-------|---------|------|----------|
| Dev | Local (open) | Medium | High | With LoRA | Quality local gen |
| Schnell | Local (open) | Very fast | Medium | With LoRA | Previews, iteration |
| Pro | API | Fast | Highest | Filtered | Commercial |
| Chroma 8.9B | Local | Medium | High | Fully uncensored | Uncensored gen |

---

## Prompt Style

**Flux does NOT use comma-tags.** It uses natural language sentences. Describe the scene like you're talking to a photographer or describing a photo to a friend.

### Good (natural language)
```
A young woman with long dark hair standing in a sunlit field, wearing a flowing white dress, soft golden hour light, gentle smile, shallow depth of field, photorealistic
```

### Bad (comma-tag style)
```
masterpiece, best quality, 1girl, long hair, white dress, forest, soft lighting
```

Flux reads the sentence as a whole. It understands context, relationships, and scene composition. Write full descriptive sentences.

---

## Prompt Anatomy

A good Flux prompt includes:

1. **Subject** — person, object, scene.
2. **Appearance details** — hair, clothing, expression.
3. **Environment** — where the subject is.
4. **Lighting** — golden hour, soft diffused, studio.
5. **Style qualifier** — photorealistic, cinematic, etc.

Write 2–3 sentences describing all five. Flux's large context window handles it easily.

---

## NSFW Capabilities

- **Flux Dev (local):** NSFW-capable **with LoRAs**. The base Dev model is filtered, but LoRAs like the NSFW Master Flux LoRA unlock explicit content.
- **Flux Pro (API):** Content-filtered. NSFW is blocked.
- **Kontext (API):** API-only, filtered. No NSFW.
- **Chroma 8.9B:** Fully uncensored variant. No filter — works out of the box.

**Rule of thumb:** Local + LoRA = NSFW possible. API = filtered.

---

## ComfyUI Workflows

Flux has specific recommended settings in ComfyUI:

- **CFG:** Near **1.0** (Flux is a distilled model; high CFG breaks it).
- **Sampler:** DPM++ 2M.
- **Scheduler:** Beta.
- **Steps:** 20–30 is sufficient. More steps give diminishing returns.
- **Resolution:** Native 1024×1024.

### Recommended Node Settings
```
Sampler: DPM++ 2M
Scheduler: Beta
CFG: 1.0
Steps: 25
```

### Why CFG 1.0
Flux was distilled with a fixed guidance schedule. Raising CFG past ~2 causes oversaturation and artifacts. Leave it at 1.0 and control composition via the prompt instead.

---

## Safety Tolerance Slider

Some Flux interfaces expose a **safety tolerance slider (1–5)**.

- **1:** Strictest filtering.
- **5:** Most permissive.

If you're working with NSFW content and the interface has this slider, set it to **5** to minimize filtering. Lower values will block or degrade explicit content.

---

## Negative Prompts

**Barely needed with Flux.** The model is strong enough that negative prompts are largely unnecessary and can even hurt.

- Flux understands composition well enough that it rarely produces bad anatomy or artifacts.
- If you do use negatives, keep them minimal and natural-language.
- Most Flux workflows omit negative prompts entirely.

---

## No BREAK Keyword

Flux has a **large context window** (T5-XXL encoder). There's no 75-token chunk limit, so the `BREAK` keyword from Stable Diffusion is **not needed**. You can write long, detailed paragraphs.

---

## Common Mistakes

- **Comma-tag prompting** — SD-style tags produce flat, lifeless results.
- **High CFG** — anything above ~2.0 breaks Flux. Keep it at 1.0.
- **Expecting NSFW from base Dev** — you need a LoRA or the Chroma variant.
- **Short prompts** — Flux rewards detail. A single fragment wastes its context window.
- **Using SD negatives** — the "worst quality, low quality" blocks do nothing here.

---

## Example Prompts

### Natural Language Paragraph Style
```
A serene portrait of a woman in her thirties with freckles and auburn hair, wearing a flowing emerald dress, standing beside a misty lake at dawn, soft diffused light, water reflections, cinematic color grading, ultra detailed, photorealistic
```

### Scene Description
```
Inside a cozy mountain cabin, a fire crackles in a stone fireplace, snow falls outside the window, a golden retriever sleeps on a wool rug, warm amber light fills the room, photorealistic, high detail
```

### NSFW (with LoRA, natural language)
```
A confident woman with long blonde hair and a toned figure, completely nude, reclining on a velvet chaise lounge, dramatic studio lighting, full breasts with detailed nipples, smooth skin, elegant pose, photorealistic, high detail
```

---

## Quick Reference

- **Flux Dev** = open, local, natural-language prompts.
- **Flux Schnell** = fast, 1–4 steps, previews.
- **Flux Pro** = API, commercial, filtered.
- **Chroma 8.9B** = uncensored variant, no filter.
- **Prompt style:** natural sentences, NOT comma-tags.
- **NSFW:** Dev + LoRA, or Chroma. API is filtered.
- **ComfyUI:** CFG ~1.0, DPM++ 2M + beta scheduler, 20–30 steps.
- **Safety slider:** set to 5 for permissive.
- **Negatives:** barely needed.
- **No BREAK keyword** — large context window.