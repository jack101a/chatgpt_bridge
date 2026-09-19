# Structural Templates

Reusable prompt structures for different platforms and goals. These templates
focus on standard prompt engineering craft — composition, lighting, style
integration — applicable to any content type.

## Universal Formula

```
Subject + Style + Lighting + Composition + Mood + Technical details
```

Order matters less on natural-language platforms (Flux, DALL-E), more on
tag-based platforms (SD, Midjourney). Lead with the most important element.

## Stable Diffusion Template (Comma Tags)

```
[character/subject], [action/pose], [clothing], [body description],
[setting], [lighting], [camera angle], [shot type], [style], [quality tags],
[technical]
```

**Example (portrait):**
```
1girl, solo, sitting on park bench, autumn coat, curly hair, smiling,
golden hour, eye-level, medium close-up, photorealistic, 8k uhd,
detailed skin, shallow depth of field, Fujifilm
```

**Negative prompt:**
```
worst quality:1.4, low quality:1.4, bad anatomy, bad hands, extra fingers,
deformed, watermark, text, jpeg artifacts
```

**Weighting example:**
```
(curly hair:1.3), (smiling:1.2), [background details:0.8], BREAK,
quality tags
```

## Flux Template (Natural Language)

```
A [style] photograph of [subject] [action/pose], [body/clothing description],
in [setting]. [Lighting description]. [Camera/lens description]. [Mood].
[Quality details].
```

**Example:**
```
A photorealistic image of a woman with curly hair sitting on a park bench,
wearing an autumn coat, smiling. In a park with autumn foliage. Soft golden
hour light filtering through trees. Shot at eye level with an 85mm lens,
shallow depth of field. Warm, peaceful atmosphere. Highly detailed skin
texture, 8k quality.
```

## Midjourney Template (Descriptors + Parameters)

```
[subject], [action/pose], [clothing], [body description], [setting],
[lighting], [style], --ar [ratio] --stylize [0-1000] --no [negatives]
```

**Example:**
```
woman with curly hair, sitting on park bench, autumn coat, smiling, park
with fall foliage, golden hour light, photorealistic, --ar 3:2 --stylize 250
--raw --no text, watermark
```

## DALL-E 3 Template (Conversational)

```
Create a [style] image of [subject] [action/pose]. [Body/clothing description].
[Setting]. [Lighting]. [Mood]. [Aspect ratio]. [Quality].
```

**Example:**
```
Create a photorealistic image of a woman with curly hair sitting on a park
bench in autumn. She wears a warm coat and smiles softly. The park has
golden fall foliage. Soft golden hour lighting. Peaceful, warm mood. Wide
landscape format. HD quality.
```

## BREAK Usage (SD)

Separate conceptual chunks so the model treats each as a distinct block:

```
[subject description] BREAK [pose/action] BREAK [setting] BREAK [quality tags]
```

Example:
```
1girl, curly hair, freckles, green eyes BREAK sitting, leaning forward,
hands on knees BREAK park bench, autumn trees, path winding BREAK
photorealistic, 8k uhd, detailed, sharp focus
```

## AND Blending (SD)

Blend two concepts with weights:

```
concept1 AND concept2::0.7
```

Example:
```
oil painting AND watercolor::0.5, portrait of woman, soft edges, visible
brushstrokes
```

## LoRA Stacking (SD)

Combine character + style + pose LoRAs:

```
<lora:characterLoRA:0.8>, <lora:styleLoRA:0.6>, <lora:poseLoRA:0.4>,
[prompt description]
```

Example:
```
<lora:animeGirlStyle:0.7>, <lora:softLighting:0.5>, 1girl, solo, sitting,
park bench, autumn, photorealistic anime style
```

## Template Variables

| Variable | Options |
|----------|---------|
| Subject | 1girl, 1boy, couple, group, animal, landscape |
| Pose | standing, sitting, reclining, walking, kneeling, dancing |
| Clothing | casual, formal, swimwear, historical, fantasy armor |
| Setting | indoor, outdoor, studio, bedroom, forest, city, abstract |
| Lighting | golden hour, blue hour, studio, chiaroscuro, rim, overcast |
| Camera | eye-level, low angle, high angle, dutch, POV, over-shoulder |
| Shot | extreme close-up, close-up, medium, full body, wide |
| Style | photorealistic, cinematic, oil painting, anime, 3D render |
| Quality | 8k uhd, detailed, sharp focus, masterpiece, professional |

## Platform-Specific Notes

- **SD/SDXL**: Comma tags, weighting syntax, BREAK, AND, LoRAs. Token limit
  75 (SD1.5) / 77 (SDXL).
- **Flux**: Natural language sentences. No weighting syntax — use emphasis
  words ("prominently", "very important"). No BREAK needed.
- **Midjourney**: Concise descriptors + parameters. No weighting — use
  --stylize, --chaos, --weird. Repetition for emphasis.
- **DALL-E 3**: Conversational sentences. No parameters — describe ratio
  in text. No negatives — describe what you want.

## Quick Reference

- **SD**: tags + `(word:1.5)` + BREAK + AND + LoRAs
- **Flux**: natural language, no syntax tricks needed
- **Midjourney**: descriptors + `--ar` `--stylize` `--no` `--sref` `--cref`
- **DALL-E 3**: conversational, describe everything in sentences
- **Universal**: Subject + Style + Lighting + Composition + Mood + Technical
