# Glossary

Quick reference for prompt engineering terminology.

## A

- **AND** — SD syntax for blending concepts with weights.
  `concept1 AND concept2::0.7`
- **Anamorphic** — cinematic lens format, widescreen with oval bokeh.
- **Aspect ratio** — image dimensions. `--ar` on Midjourney, plain text
  ("wide landscape") on DALL-E, `--ar W:H` on MJ.

## B

- **Bokeh** — out-of-focus blur from shallow depth of field. Pleasing,
  dreamy background blur.
- **BREAK** — SD keyword separating 75-token chunks. Forces model to treat
  text after BREAK as new concept block.
- **Blue hour** — twilight period with cool blue light, just before sunrise
  or after sunset.

## C

- **CFG (Classifier Free Guidance)** — how closely model follows prompt.
  SD: 4-7 typical, Flux: ~1.0. Higher = more prompt adherence but less
  creative variation.
- **Chaos (--chaos)** — Midjourney parameter for variation. 0-100. Higher
  = more unexpected results.
- **Chiaroscuro** — strong contrast between light and dark. Renaissance
  painting technique (Caravaggio).
- **CLIP** — text encoder for Stable Diffusion models. Converts text to
  embeddings.
- **ComfyUI** — node-based Stable Diffusion interface. Uses literal weight
  values (not normalized like A1111).
- **--cref** — Midjourney character reference. URL to image for character
  consistency.
- **--cw** — Midjourney character weight. 0-100. Controls how strongly
  --cref influences output.

## D

- **DPM++** — Stable Diffusion sampler family. DPM++ 2M Karras recommended
  for quality. DPM++ SDE for detail.
- **Depth of field (DOF)** — range of sharp focus. Shallow (f/1.4) = bokeh,
  deep (f/8) = everything sharp.

## E

- **EasyNegative** — pre-trained SD1.5 negative embedding. Use in negative
  prompt field for general quality boost.
- **Embedding (TI)** — Textual Inversion. Trained concept represented as
  small embedding file. Triggered by keyword.

## F

- **Flux** — Black Forest Labs model family. Natural language prompting,
  strong without negatives. Dev (open), Schnell (fast), Pro (API).
- **Fill light** — secondary light softening shadows from key light.

## G

- **Golden hour** — first/last hour of sunlight. Warm, soft, long shadows.
  Flattering for skin.

## H

- **--hd** — Midjourney high definition flag. Higher detail.

## I

- **Impasto** — thick paint application in oil painting. Visible
  brushstrokes, texture.

## K

- **Key light** — primary light source in multi-light setup. Strongest,
  defines direction.

## L

- **LoRA** — Low-Rank Adaptation. Small model add-on for specific style,
  character, or concept. Stacked: `<lora:name:weight>`.
- **Low-key** — predominantly dark lighting. Moody, intimate, dramatic.

## M

- **Macro** — extreme close-up photography. 1:1 or greater magnification.

## N

- **Negative prompt** — text describing what to avoid in generation.
  Essential for SD1.5, minimal for SDXL, barely needed for Flux.
- **--no** — Midjourney negative parameter. `--no text, watermark, blur`
- **NovelAI** — anime-focused SD interface. Uses `{word}` braces for
  weighting (1.05x each brace).

## O

- **Octane render** — photorealistic 3D rendering engine. Tag triggers
  polished 3D look.

## P

- **--p** — Midjourney personalization profile. Uses trained aesthetic
  preferences.
- **PBR** — Physically Based Rendering. Realistic material shading in 3D.
- **Plein air** — outdoor painting from life. Impressionist technique.

## Q

- **--q** — Midjourney quality parameter. Controls generation effort/cost.

## R

- **--raw** — Midjourney photorealism mode. Less stylization, more
  photographic.
- **Rim light** — backlight creating silhouette edge. Separates subject
  from background.

## S

- **Sampler** — algorithm translating latent noise to image. DPM++ 2M
  Karras, Euler a, DDIM common choices.
- **--sref** — Midjourney style reference. URL to image for style
  consistency.
- **--stylize** — Midjourney artistic strength. 0-1000. Higher = more
  artistic interpretation.
- **Steps** — denoising iterations. SD: 20-40, Flux: 20-30. More steps =
  more detail but diminishing returns.
- **Subsurface scattering** — light penetrating translucent materials
  (skin, wax). Key for realistic 3D skin.

## T

- **TI (Textual Inversion)** — see Embedding.
- **Token** — unit of text processed by model. SD CLIP: 75 tokens per
  chunk, SDXL: 77 tokens.

## V

- **VAE** — Variational Autoencoder. Decodes latent representation to
  pixels. Different VAEs affect color/contrast.
- **Volumetric light** — visible light beams through fog/dust. God rays.

## W

- **--weird** — Midjourney experimental variation. 0-3000. Higher = more
  unusual results.
- **Weighting** — emphasizing/de-emphasizing terms. SD: `(word:1.5)`,
  NovelAI: `{word}`, Flux: natural language emphasis.

## Platform Parameter Quick Reference

| Parameter | Platform | Purpose |
|-----------|----------|---------|
| `--ar W:H` | Midjourney | Aspect ratio |
| `--stylize 0-1000` | Midjourney | Artistic strength |
| `--chaos 0-100` | Midjourney | Variation |
| `--weird 0-3000` | Midjourney | Experimental |
| `--no X, Y` | Midjourney | Negative prompt |
| `--sref URL` | Midjourney | Style reference |
| `--cref URL` | Midjourney | Character reference |
| `--cw 0-100` | Midjourney | Character weight |
| `--v 6/7/8` | Midjourney | Model version |
| `--raw` | Midjourney | Photoreal mode |
| `--hd` | Midjourney | High detail |
| `--q 1/2` | Midjourney | Quality tier |
| `--p name` | Midjourney | Personalization |
| `(word:1.5)` | SD/A1111 | Weight emphasis |
| `[word]` | SD/A1111 | Weight de-emphasis |
| `BREAK` | SD | Chunk separator |
| `AND` | SD | Concept blending |
| `{word}` | NovelAI | Weight emphasis |
| `<lora:name:0.8>` | SD | LoRA invocation |
