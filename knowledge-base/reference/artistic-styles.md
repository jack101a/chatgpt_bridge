# Artistic Styles Reference

Style anchors for different aesthetic goals. Each style lists key prompt words
and model behavior notes.

## Photorealistic

**Key words:** photorealistic, hyperrealistic, 8k uhd, detailed, sharp focus,
professional photography, DSLR, raw photo, Fujifilm, Sony A7, 85mm portrait

**Notes:** Works best with Flux, SDXL + photoreal LoRAs, Midjourney --raw.
Specify lens, lighting, and camera body for realism. Avoid "illustration",
"painting", "anime" tags.

**Example:**
```
photorealistic portrait, woman with freckles, 85mm lens, soft window light,
shallow depth of field, Fujifilm Pro 400H, 8k uhd, detailed skin texture
```

## Cinematic

**Key words:** cinematic, film still, movie scene, anamorphic, color graded,
teal and orange, atmospheric, Roger Deakins, film noir, 35mm

**Notes:** Midjourney excels here. Use --ar 21:9 or 16:9. Color grade terms
trigger cinematic look. Reference cinematographers for specific styles.

**Example:**
```
cinematic film still, detective in rain, anamorphic lens flare, teal and
orange color grade, volumetric rain, noir lighting, 35mm, --ar 21:9 --stylize 600
```

## Oil Painting

**Key words:** oil painting, Renaissance, Baroque, classical, Titian, Rubens,
Rembrandt, Caravaggio, Pre-Raphaelite, impasto, canvas texture, old master

**Notes:** Classical painters produce specific aesthetics — Titian (warm,
golden, Venetian), Caravaggio (chiaroscuro, dramatic), Rembrandt (warm,
intimate), Rubens (voluptuous, Baroque). Specify painter for control.

**Example:**
```
oil painting in the style of Rembrandt, old woman reading, warm chiaroscuro
lighting, impasto brushwork, canvas texture, museum quality, Baroque
```

## Watercolor

**Key words:** watercolor, wash, soft edges, pigments, paper texture, delicate,
wet on wet, dry brush, transparent

**Notes:** Best on SD/Midjourney. "Wet on wet" for soft blends, "dry brush"
for texture. Specify paper (cold-press, hot-press).

**Example:**
```
watercolor painting, mountain lake at dawn, soft washes, wet on wet, cold-press
paper texture, delicate pigments, loose brushwork
```

## Digital Painting

**Key words:** digital painting, concept art, ArtStation, Greg Rutkowski,
smooth shading, vibrant, matte painting, illustration

**Notes:** Greg Rutkowski is heavily trained in SD models — strong anchor.
ArtStation tag triggers polished digital look.

**Example:**
```
digital painting, concept art, dragon perched on mountain, ArtStation,
Greg Rutkowski style, dramatic lighting, vibrant colors, epic scale
```

## Anime / Manga

**Key words:** anime, manga, cel shading, Studio Ghibli, Makoto Shinkai,
Kyoto Animation, key visual, line art, screentone

**Notes:** SD anime models (AnythingV3, Nai) excel. Specify studio for style
— Ghibli (soft, natural), Shinkai (detailed skies, cinematic), KyoAni (moe,
detailed eyes). Cel shading = flat color blocks.

**Example:**
```
anime key visual, girl with umbrella in rain, Makoto Shinkai style, detailed
sky, cel shading, vibrant, cinematic atmosphere
```

## 3D Render

**Key words:** 3D render, Octane render, Unreal Engine, ray tracing, subsurface
scattering, PBR materials, ZBrush, Blender, Cycles

**Notes:** Specify renderer for look — Octane (realistic), Unreal (game),
Blender Cycles (open). Subsurface scattering for realistic skin. PBR for
physically accurate materials.

**Example:**
```
3D render, Octane, fantasy character portrait, subsurface scattering skin,
PBR materials, ray traced reflections, 8k, highly detailed
```

## Pencil Sketch

**Key words:** pencil sketch, graphite, cross-hatching, study, line art,
contour drawing, shading, stippling

**Notes:** Simple style, works across platforms. Specify graphite grade (2B,
4B, 6B) for darkness. "Study" for academic reference look.

**Example:**
```
pencil sketch, figure study, 4B graphite, cross-hatching shading, contour
lines, on cream paper, academic drawing
```

## Impressionism

**Key words:** impressionism, Monet, visible brushstrokes, light-focused,
plein air, broken color, optical mixing

**Notes:** Monet for landscapes, Renoir for figures. "Broken color" and
"visible brushstrokes" are key anchors. Plein air = outdoor natural light.

**Example:**
```
impressionist painting, Monet style, water lilies pond, visible brushstrokes,
broken color, plein air light, soft dappled reflections
```

## Surrealism

**Key words:** surrealism, Dali, dreamlike, impossible geometry, melting,
juxtaposition, Magritte, Ernst

**Notes:** Dali (melting, bizarre), Magritte (clean, conceptual juxtaposition),
Ernst (collage, frottage). Combine unrelated elements for surreal effect.

**Example:**
```
surrealist painting, Magritte style, man with apple for face, clean flat
sky background, conceptual juxtaposition, impossible scene
```

## Cyberpunk

**Key words:** cyberpunk, neon, rain, Blade Runner, dystopian, holographic,
megacity, synthwave, high-tech low-life

**Notes:** Blade Runner aesthetic — neon signs, rain, dark streets, holographic
ads. Synthwave for 80s retro variant. Specify megacity for scale.

**Example:**
```
cyberpunk street scene, neon signs reflecting in rain puddles, holographic
advertisements, Blade Runner atmosphere, dystopian megacity, night, fog
```

## Art Nouveau

**Key words:** Art Nouveau, Mucha, ornamental, flowing lines, decorative,
botanical, sinuous, Jugendstil

**Notes:** Alphonse Mucha is the key anchor — flowing hair, botanical frames,
ornamental borders, flat color. Jugendstil = German variant.

**Example:**
```
Art Nouveau poster, Mucha style, woman with flowing hair surrounded by
botanical ornaments, sinuous lines, decorative border, flat color
```

## Pixel Art

**Key words:** pixel art, 8-bit, 16-bit, limited palette, dithering, sprite,
isometric

**Notes:** Specify palette size (16 colors, 32 colors). Dithering for gradient
effect. Isometric for strategy game look. 8-bit = NES, 16-bit = SNES.

**Example:**
```
pixel art, 16-bit RPG scene, isometric village, 32 color palette, dithered
shadows, SNES style, sprite art
```

## Fantasy

**Key words:** fantasy art, epic, dragons, magic, Brian Froud, Frank Frazetta,
high fantasy, sword and sorcery

**Notes:** Frazetta (muscular, oil painting, pulp), Froud (whimsical, fairy),
Greg Rutkowski (epic digital). Specify subgenre — high fantasy, dark fantasy,
fairy tale.

**Example:**
```
fantasy art, Frank Frazetta style, warrior on cliff edge, oil painting,
dramatic lighting, muscular figure, epic landscape, sword and sorcery
```

## Quick Reference

| Style | Key Anchor | Best Platform |
|-------|-----------|---------------|
| Photorealistic | "photorealistic, 8k, DSLR" | Flux, SDXL, MJ --raw |
| Cinematic | "cinematic, anamorphic, film still" | Midjourney, SDXL |
| Oil painting | "oil painting, [painter name]" | All |
| Watercolor | "watercolor, wash, paper texture" | SD, Midjourney |
| Digital painting | "digital painting, ArtStation" | SD, Midjourney |
| Anime | "anime, [studio name]" | SD anime models |
| 3D render | "3D render, Octane, Unreal" | All |
| Pencil sketch | "pencil sketch, graphite" | All |
| Impressionism | "impressionism, Monet" | All |
| Surrealism | "surrealism, Dali/Magritte" | All |
| Cyberpunk | "cyberpunk, neon, Blade Runner" | All |
| Art Nouveau | "Art Nouveau, Mucha" | All |
| Pixel art | "pixel art, 8-bit/16-bit" | All |
| Fantasy | "fantasy art, [artist]" | SD, Midjourney |
