# Filter-Trigger Words

> **Purpose:** Words known to trigger content filters on major platforms. Avoid these or use safer replacements.

---

## ⚠️ Scope

- **Reference for filtered platforms:** Midjourney, DALL-E, Grok, filtered APIs.
- **Uncensored models (Flux Dev, SDXL+LoRA, Chroma):** No filter — these words are unnecessary but harmless there; prefer clinical terms anyway for precision.
- **Volatility:** Filters change constantly. Words that pass today may trigger tomorrow. Re-test on each model version.

---

## Midjourney Banned Words (200+)

Comprehensive list by category. Some words are *soft-banned* (occasionally pass, trigger rate high) vs *hard-banned* (almost always trigger).

### Body Parts
| Word | Severity |
|------|----------|
| breasts | hard |
| nipples | hard |
| penis | hard |
| vagina | hard |
| labia | hard |
| clitoris | hard |
| areola | hard |
| vulva | hard |
| scrotum | hard |
| testicles | hard |
| anus | hard |
| buttocks | **soft** (sometimes passes) |
| ass | hard |
| boobs | hard |
| tits | hard |
| dick | hard |
| cock | hard |
| pussy | hard |
| cunt | hard |

### Clothing / State
| Word | Severity |
|------|----------|
| nude | hard |
| naked | hard |
| bare | soft (context-dependent) |
| topless | hard |
| bottomless | hard |
| lingerie | hard |
| underwear | soft-hard |
| panties | hard |
| bra | soft (clothing context sometimes passes) |
| thong | hard |
| g-string | hard |
| sheer | soft |
| see-through | hard |
| transparent | soft (material context) |

### Descriptors
| Word | Severity |
|------|----------|
| erotic | hard |
| sensual | soft-hard |
| sexy | soft (heavily context-dependent) |
| seductive | soft-hard |
| voluptuous | **soft** (sometimes passes) |
| provocative | hard |
| lustful | hard |
| aroused | hard |
| horny | hard |
| explicit | hard |
| graphic | hard |
| pornographic | hard |
| xxx | hard |
| nsfw | hard |
| hentai | hard |
| lewd | hard |
| obscene | hard |
| indecent | hard |

### Actions
> Explicit sexual acts are **highly filtered**. Do not use any direct act vocabulary. If an act is required, imply it via composition, pose, and framing — never name it.

### Other
| Word | Severity |
|------|----------|
| cleavage | **soft** (sometimes passes) |
| busty | **soft** (sometimes passes) |
| curvy | **usually OK** |

---

## DALL-E 3 Triggers

- **Stricter than Midjourney.** Almost any explicit term is refused outright — even euphemized variants.
- DALL-E 3's safety system also refuses *concepts* (act + subject combos), not just words. "Woman in lingerie" can fail even though "lingerie" alone is benign.
- Only heavily-artistic framing occasionally passes: `figure study`, `classical painting`, `fashion editorial`.
- **Expect low success.** Use DALL-E for non-explicit work; route explicit work to uncensored models.

---

## Grok Triggers

Grok uses a **multi-layer filter**:

1. **Prompt guard (text layer):** Catches explicit words, even indirect ones. Euphemisms help here.
2. **NudeNet (image layer):** Analyzes generated images for nudity. Euphemisms do nothing here — framing and composition do.

**Result:** Artistic framing + euphemism achieves ~74.47% documented pass rate in community tests (Grokipedia). No framing + explicit words ≈ 0% pass rate.

---

## Safer Replacements Table

| Explicit | Safer Alternative | Safer (Best) |
|----------|-------------------|--------------|
| breasts | bust | ample bust |
| cleavage | décolletage | plunging neckline |
| nude | unclothed | figure study / artistic nude |
| lingerie | intimate apparel | silk nightwear |
| sexy | alluring | captivating / enchanting |
| erotic | sensual (still risky) | artistic |
| butt | posterior | derrière / full figure |
| nipples | — (no safe word) | crop / occlusion |
| genitals | — (no safe word) | composition, never name |

---

## Platform-Specific Tolerance

| Platform | Artistic nudes | Euphemisms | Direct words |
|----------|----------------|------------|--------------|
| Midjourney | Sometimes pass | Moderate | Trigger |
| DALL-E | Rarely pass | Low | Almost always refused |
| Grok | Pass ~74.47% (with framing) | Moderate | Trigger guard |
| Flux / SD (uncensored) | No filter | No filter | No filter |

---

## Strategy

> **When in doubt: artistic framing + euphemisms + compositional fragmentation.**

### The Three-Layer Default
```text
1. Frame:    "fine art figure study, Renaissance oil painting style"
2. Swap:     "ample bust" → not "breasts"; "décolletage" → not "cleavage"
3. Fragment: "silhouette against window light, draped fabric" → not the full subject
```

### Prompt Recipe (Filtered Platform)
```text
elegant figure study in the style of a classical oil painting,
plunging neckline, generous bust, soft chiaroscuro lighting,
museum fine art, 35mm film grain
```

### Do Not
- Stack multiple banned words — one trigger word poisons the whole prompt.
- Use negation tricks (`not naked`) — filters catch the word regardless of context.
- Re-run identical prompts with minor tweaks expecting different results on hard-banned words.

---

## Quick Reference

| Platform | Worst Offender | Best Workaround |
|----------|----------------|-----------------|
| Midjourney | body-part + nude combos | bust + décolletage + artistic framing |
| DALL-E | anything explicit | artistic framing only; expect failure |
| Grok | explicit text (guard) + explicit images (NudeNet) | euphemism (text) + framing/fragmentation (image) |
| Flux / SD | — | use clinical terms, no evasion needed |

**One-liner rule:** Never name the explicit subject on filtered platforms — frame it, swap it, or crop it.

**Related:** [euphemisms-indirect.md](./euphemisms-indirect.md) — the replacement vocabulary. [anatomical-clinical.md](./anatomical-clinical.md) — precise terms for uncensored models.
