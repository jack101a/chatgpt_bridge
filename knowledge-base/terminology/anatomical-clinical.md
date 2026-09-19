# Anatomical & Clinical Terminology

> **Purpose:** Clinical/anatomical terminology for use with UNCENSORED models (Flux Dev, SDXL+LoRA, Chroma). Precise language reduces ambiguity and filter triggers while maintaining accuracy.

---

## ⚠️ Usage Warning

- **Only use with uncensored models.** This vocabulary is designed for Flux Dev, SDXL+LoRA, and Chroma — models without content filters.
- **On filtered platforms, these may still trigger filters.** Do not use clinical terms on Midjourney, DALL-E, Grok, or filtered APIs. Use euphemisms instead — see [euphemisms-indirect.md](./euphemisms-indirect.md).
- **Accuracy first.** Clinical terms give precise anatomical targeting that slang cannot. Ambiguity = wrong generations.

---

## Why Clinical Terms Work

1. **Training data overlap:** Uncensored diffusion models are trained on large datasets (LAION, etc.) that include medical textbooks, academic anatomy references, and clinical literature. Models recognize these tokens with high confidence.
2. **Precision:** "Labia minora" targets far more precisely than "down there." Slang is ambiguous and model-agnostic; clinical terms map to specific visual features.
3. **Filter evasion (secondary):** Many porn-classifier filters (NudeNet, prompt guards) are trained primarily on slang and common euphemisms. Clinical Latin-derived terms are less likely to match classifier feature sets. *This is a side benefit, not the primary purpose — use only on uncensored models anyway.*
4. **Consistency:** Medical terms are standardized. Repeated use across prompts yields stable, reproducible results.

---

## Female Anatomy Terms

### External Genitalia
| Term | Notes |
|------|-------|
| clitoris | Use with "glans clitoris" for precision |
| glans clitoris | The exposed tip — often paired with "hood" (prepuce) |
| labia majora | Outer folds |
| labia minora | Inner folds |
| vulva | Collective term for external genitalia |
| pudendum | Formal collective term (less common in prompts) |
| mons pubis | The fatty mound above the vulva; use "pubic mound" for plainer register |
| perineum | Area between vulva/anus |

### Vaginal & Internal
| Term | Notes |
|------|-------|
| vaginal canal | Internal; rarely needed in image prompts |
| hymen | Edge case; rarely prompted |

### Breasts & Chest
| Term | Notes |
|------|-------|
| breast | Clinical baseline |
| mammary gland | Internal structure — usually too deep for images |
| areola | Pigmented ring |
| nipple | Use "erect nipple" or "puffy nipple" for specificity |
| bust | Measurement-oriented; good for sizing |
| cleavage | The cleft between breasts |
| décolletage | Upper chest/shoulder area framing the bust |
| sternum | Chest bone between breasts |
| collarbone | Also: clavicle |
| pectoral | Muscular chest variant |

### Lower Body
| Term | Notes |
|------|-------|
| hip | General |
| pelvis | Skeletal reference |
| thigh | Upper leg |
| gluteal cleft | The cleft between buttocks |
| buttocks | Clinical plural |
| navel | Belly button |
| abdomen | Belly |
| flank | Side of torso |

---

## Male Anatomy Terms

| Term | Notes |
|------|-------|
| penile shaft | The main shaft |
| glans penis | The head |
| corona | Ridge where glans meets shaft |
| foreskin | Also: prepuce |
| frenulum | Small band under glans |
| scrotum | Sac |
| testicle / testis | Singular; "testes" plural |
| epididymis | Rarely needed visually |
| perineum | Same as female |
| prostate | Internal; only for internal-view prompts |
| pubic hair | Regional descriptor |
| mons pubis | Present in males too (less prominent) |
| abdomen | Torso |
| sternum | Chest |

---

## Body Descriptors

### Silhouette / Size
| Term | Meaning |
|------|---------|
| voluptuous | Full, curvy, generous |
| curvaceous | Pronounced curves |
| ample | Large (bust/hips) |
| generous | Slightly euphemistic "large" |
| full-figured | Overall larger body |
| plus-size | Modern sizing term |
| rubenesque | Baroque-style full figure |
| statuesque | Tall and imposing |
| athletic | Muscular-lean |
| slender | Thin |
| petite | Small frame |
| willowy | Tall and thin |
| lithe | Flexible, slim, graceful |
| muscular | Defined muscle |
| toned | Light muscle definition |

> **Tip:** Pair descriptor with a body region: `voluptuous hips`, `ample bust`, `toned abdomen`. Region-first prompts generate more consistently.

---

## Position / Action Terms (Clinical)

| Term | Meaning |
|------|---------|
| supine | Lying on back |
| prone | Lying face down |
| lateral recumbent | Lying on side |
| standing | Erect posture |
| seated | Sitting |
| kneeling | On knees |
| squatting | Deep knee bend |
| bending | Forward flexion at waist |
| reclining | Semi-reclined, supported back |
| arched back | Lumbar extension (strong pose) |
| legs apart | Open leg position |
| legs together | Closed leg position |

### Construction Example
```
supine figure, legs apart, arched back, hands above head
```

---

## Skin / Texture Terms

| Term | Notes |
|------|-------|
| smooth skin | Baseline |
| porcelain skin | Pale, flawless |
| alabaster | Pale, smooth, marble-like |
| olive skin | Warm medium tone |
| ebony skin | Deep dark tone |
| freckled | Spotted skin |
| tanned | Sun-darkened |
| pale | Light complexion |
| dewy | Slightly moist, luminous |
| matte | Non-shiny, dry finish |
| glistening | Wet sheen |
| flushed | Reddened (cheeks/chest) |
| goosebumps | Erected hair follicles |

---

## Example Prompts (Uncensored Models Only)

### Flux Dev — Clinical Precision
```text
full-length portrait, young woman, supine pose, arched back,
toned abdomen, voluminous dark hair, porcelain skin, glistening
with moisture, soft studio lighting, 85mm lens, photorealistic
```

### SDXL + LoRA — Anatomy Focus
```text
bust shot, areola detail, erect nipple, collarbone prominent,
décolletage framing, smooth olive skin, dewy finish, macro
detail, skin texture rendering, high detail
```

### Chroma — Figure Study
```text
lateral recumbent pose, gluteal cleft emphasized, hip curve
exaggerated, thigh contact, rubenesque figure, ebony skin,
reclining on silk sheets, warm rim light, fine art photography
```

### Descriptor Stack
```text
voluptuous hips, ample bust, toned abdomen, slender waist,
petite frame, lithe limbs, statuesque height, freckled shoulders
```

---

## Anti-Patterns (What NOT To Do)

1. **Slang:** `boobs`, `tits`, `pussy`, `dick` — imprecise, model-confused, and filter-prone even on some uncensored pipelines.
2. **Vague anatomy:** `down there`, `her area` — generates garbage or random body parts.
3. **Descriptor overload:** 15 body adjectives in one prompt dilutes every feature. Pick 3–5 and make them region-specific.
4. **Contradictory terms:** `petite` + `statuesque` in one prompt = conflict. Pick one per region.

---

## Quick Reference

| Need | Use |
|------|-----|
| Breasts, precise | breast, areola, nipple, cleavage, bust |
| Breasts, sizing | ample bust, generous cleavage, full chest |
| Genitalia (f) | vulva, labia majora, labia minora, clitoris |
| Genitalia (m) | penile shaft, glans penis, scrotum, testicles |
| Buttocks | buttocks, gluteal cleft |
| Torso | abdomen, sternum, collarbone, navel |
| Full body types | voluptuous, curvaceous, rubenesque, athletic, petite |
| Poses | supine, prone, lateral recumbent, kneeling, arched back |
| Skin | porcelain, alabaster, olive, ebony, dewy, glistening |

**One-liner rule:** Clinical terms = uncensored models only. Filtered platforms → [euphemisms-indirect.md](./euphemisms-indirect.md). Never slang — imprecise everywhere.
