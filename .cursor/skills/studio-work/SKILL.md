---
name: studio-work
description: >-
  Keep the AI game studio in sync. Use when Leo plans story, mechanics, art,
  graphics, or the game bible; after a design talk; or when starting a feature.
  Update studio/ and docs/guides/stones-studio.html. Do not invent a new engine.
---

# Studio — memoria viva

El chat se olvida. `studio/` no.

## Cuándo

- Leo habla de historia, tono, personaje, mecánicas, arte o “qué ocupamos”.
- Vas a programar una feature nueva.
- Cierra o cambia una decisión.

## Pasos

1. Lee `studio/README.md`, `story.md`, `mechanics.md`, `art.md`, `decisions.md`.
2. Si la plática cambió algo: actualiza esos archivos (no borres historia; agregá).
3. Escribí una nota corta en `studio/sessions/YYYY-MM-DD-<tema>.md`.
4. Si la decisión es sí/no, una línea en `decisions.md` con fecha.
5. Actualizá `docs/guides/stones-studio.html` (Last updated + pestaña que toque).
6. Código: solo Phaser 4.2.1. Proto gráfico en `src/gfx/` o `public/assets/proto/`.
   Final en `public/assets/final/`. No Three.js salvo que Leo lo pida explícito.
7. Después, el flujo de `.cursor/skills/phaser-work/SKILL.md`.

## No

- No montes un editor, MCP studio, Unity ni un segundo motor “por si acaso”.
- No dejes la historia solo en el chat.
