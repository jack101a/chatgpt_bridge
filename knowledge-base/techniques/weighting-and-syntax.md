# Prompt Weighting & Syntax

## Overview

Different image generation platforms use different syntaxes to control how much influence a word or concept has on the final image. Some platforms support explicit weighting syntax (numbers, nesting, operators), while others expect you to convey emphasis through natural language alone.

This guide covers weighting syntax across the major platforms, best practices, common mistakes, and worked examples.

---

### Why Weighting Matters

- **Control emphasis** — push a subject, style, or attribute into prominence
- **Suppress unwanted elements** — de-emphasize or "negative" terms that appear anyway
- **Balance prompts** — keep composition coherent when many concepts compete
- **Fix recurring issues** — e.g. bad hands, background bleed, style drift

Weighting is a **multiplier on the attention the model pays to a token**. It is not a volume knob — over-weighting does not mean "more of it," it means "the model ignores everything else and artifacts appear."

---

## Stable Diffusion (A1111 / Forge / SD.Next)

Stable Diffusion uses the most flexible weighting syntax. All examples below use A1111-style syntax.

### Parentheses — Emphasis

```
(word)         # 1.1x default weight
(word:1.5)     # explicit weight, 1.5x
((word))       # nested, 1.1 * 1.1 = 1.21x
(((word)))     # 1.331x
(word:0.8)     # explicit weight below 1.0
```

- Each `(` multiplies by 1.1 by default (A1111).
- Explicit `(word:value)` is precise and preferred over nested parens.
- Values between 1.0 and 1.5 are the practical sweet spot (see Best Practices).

### Brackets — De-emphasis

```
[word]         # 0.9x default de-emphasis
[word:0.5]     # explicit de-emphasis, 0.5x
[[word]]       # 0.81x
```

- Useful to *reduce* a concept without removing it from the prompt.
- Heavy de-emphasis on a subject can cause it to vanish entirely — rare but happens on hard-to-render subjects.

### BREAK Keyword

The BREAK keyword separates 75-token chunks. Stable Diffusion processes the prompt in 75-token CLIP chunks; BREAK forces a hard break between chunks.

```
cinematic lighting, portrait of a woman, dramatic shadows BREAK
flowing dress, sunset background, golden hour
```

- Prevents concepts from bleeding across chunk boundaries.
- Useful for prompt lengths over 75 tokens.
- Some models (SDXL) use longer context and care less, but BREAK still works for structure.

### AND Syntax — Concept Blending

```
(concept1 AND concept2::0.7)
```

- Blends two concepts at the same position.
- `::0.7` sets the weight of the second concept relative to the first.
- Useful for mixed subjects: `(photograph AND oil painting::0.5)`

### Full Example

```
(masterpiece:1.2), (portrait of a woman:1.3), (intricate braided hair:1.4),
flowing renaissance dress, (sunset light:1.1), [background details:0.8],
(film grain:0.9) BREAK award-winning photography, 8k, detailed eyes
```

---

## ComfyUI vs A1111 — Weight Handling Differences

| Aspect | A1111 | ComfyUI |
|--------|-------|---------|
| Weight interpretation | Normalizes weights across the whole prompt | Uses literal values as written |
| Effective range | ~0.8–1.5 | Wider range usable |
| Nested parens | Multiplies (1.1^n) | Same, but literal |
| Weight drift | Slight — model rebalances internally | None — value is applied verbatim |

**Key practical difference:** a prompt tuned in A1111 may render differently in ComfyUI and vice versa. If you port a prompt, expect to retune weights.

---

## NovelAI

NovelAI uses curly-brace syntax:

```
{word}        # 1.05x
{{word}}      # 1.1025x (1.05 * 1.05)
{word|1.2}    # alternative: explicit-ish value in some versions
```

- Braces are *gentler* than A1111 parens — stacking many braces is common.
- NovelAI's older models were sensitive to syntax errors; modern ones are lenient.
- Negative weighting in NovelAI works via the negative prompt field or `word` in brackets depending on version.

---

## Flux

**Flux has no weighting syntax.** Do not use `(word:1.5)` — it will be interpreted literally (and typically ignored or treated as raw text).

Instead, use **natural language emphasis**:

```
"very important: the woman wears an ornate gold necklace"
"prominently featured: a glass dome over the city"
"the cat is the central subject, rendered in extreme detail"
```

- Order still matters somewhat — early tokens get slightly more attention.
- Sentence structure and adjective density are your levers.
- Flux follows instructions well: explicit statements like "the X is the focus of the image" work.

---

## Midjourney

Midjourney has **no token-weighting syntax** (weights were removed in v4+).

Levers available instead:

| Parameter | Effect |
|-----------|--------|
| `--stylize` | Artistic interpretation strength |
| `--chaos` | Variety / unpredictability |
| `--weird` | Unusual aesthetics |
| `--no` | Negative list (see negative-prompts.md) |

- **Repetition** for emphasis: repeating a phrase increases its influence (in older versions); in v6+, plain descriptive prominence matters more.
- Reordering: first words carry more weight in MJ's prompt parsing.
- `::` multi-prompts were largely deprecated — modern MJ parses full natural language.

---

## DALL-E 3

**No weighting syntax.** DALL-E 3 is a natural-language model — it reads your prompt as prose.

Emphasis techniques:

- Describe the element first and in detail
- Use explicit "the most important element is…" statements
- Quantify: "large", "dominant", "foreground", "center frame"
- Avoid listing keywords — write sentences

---

## Best Practices

1. **Weight key subjects 1.2–1.5.** Above 1.5 gains are marginal; above 2.0 artifacts appear.
2. **Never exceed 2.0** on a single token — color bleed, anatomy breakage, background collapse.
3. **Use explicit weights, not nesting.** `(x:1.3)` is clearer and easier to tune than `((x))`.
4. **De-emphasize, don't delete.** `[clutter:0.8]` beats removing the token entirely.
5. **BREAK to separate concepts** that fight each other (two subjects, conflicting styles).
6. **Weigh negatives** in the negative prompt (e.g. `worst quality:1.4`).
7. **Tune per platform** — a weight-tuned A1111 prompt does not transfer to ComfyUI or Flux.
8. **Keep total token weight balanced** — a 2.0 token plus 20 unweighted tokens = the unweighted ones vanish.

---

## Common Mistakes

| Mistake | Why it fails |
|---------|--------------|
| Stacking synonyms (`masterpiece, best quality, ultra detailed, 8k`) | Redundant — model pays attention to the *concept*, extra tokens waste budget and add noise |
| Over-weighting (`(boobs:2.5)`) | Hard artifacts, body horror, collapsed composition |
| Using SD syntax on Flux/DALL-E | Literal parentheses in output, no effect, wasted tokens |
| Nested parens beyond 3 layers | 1.33x is enough; 5 layers = 1.6x, risking artifacts with zero benefit |
| Weighting entire phrases instead of key tokens | Dilutes the effect — weight the noun, not the article |
| Forgetting to de-weight conflicts | Two strong subjects fight; one must give |

---

## Examples: Weighted vs Unweighted

### Example 1 — Portrait

**Unweighted:**
```
portrait of a woman, braided hair, golden hour, studio lighting, detailed
```

**Weighted:**
```
(masterpiece:1.2), (portrait of a woman:1.3), (intricate braided hair:1.4),
golden hour light, studio lighting, (detailed eyes:1.3), [harsh shadows:0.7]
```

*Result:* braided hair and eyes dominate; shadow harshness reduced.

### Example 2 — Two competing subjects

**Unweighted:**
```
a wolf and a castle, night, fog, dramatic
```

**Weighted (with BREAK):**
```
(white wolf:1.4) in the foreground, (glowing eyes:1.3), night fog BREAK
(medieval castle:1.1) in the distant background, moonlight
```

*Result:* the wolf wins the foreground, the castle stays background, no merge into a blob.

### Example 3 — Fixing recurring hands

```
portrait of a woman, (detailed hands:1.3) folded gently, [extra fingers:0.5]
```

Combine with the negative prompt (see negative-prompts.md) for best results.

---

## Quick Reference

| Platform | Syntax | Emphasis lever |
|----------|--------|----------------|
| A1111 / SD | `(word)` 1.1x, `(word:1.5)`, `[word]` 0.9x, `BREAK`, `AND` | Weights + negatives |
| ComfyUI | Same, literal values | Weights (retune from A1111) |
| NovelAI | `{word}` 1.05x, `{{word}}` 1.1025x | Braces |
| Flux | None | Natural language ("very important") |
| Midjourney | None | `--stylize`, `--chaos`, `--weird`, repetition |
| DALL-E 3 | None | Descriptive prose, order, explicit statements |

**Rules of thumb:** weight 1.2–1.5 for subjects, never above 2.0, use explicit values not nesting, BREAK for concept separation, and always retune when changing platforms.
