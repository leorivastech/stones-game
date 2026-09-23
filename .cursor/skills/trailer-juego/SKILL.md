---
name: trailer-juego
description: >-
  Hace el trailer de un juego del framework (Phaser 4): abre el juego, lo graba
  cuadro a cuadro jugando solo (Playwright), narra con voz TTS (edge-tts), usa la
  música y sonidos del propio juego y arma el video con HyperFrames. Úsalo cuando
  Leo diga trailer, teaser, video del juego, gameplay para redes, o "graba el juego".
---

# Trailer de un juego

Salida: MP4 **1920×1080, 30 fps, 30–45 s** en `<juego>/trailer/renders/` y copia en
`~/Downloads/<juego>-trailer.mp4`. Primera versión sin preguntar; al final reportar dudas.

Ejemplo real y completo: `stones_Game/trailer/` (34 s, 11 tomas, 6 voces).

## Arranque (una vez por juego)

1. Copiar el kit: `cp -r .cursor/skills/trailer-juego/kit trailer` (en la raíz del juego).
2. Enganche en `src/main.js` (si no está):
   ```js
   const CAPTURE = new URLSearchParams(location.search).has("capture");
   // en la config de Phaser.Game:
   audio: CAPTURE ? { noAudio: true } : {},
   scale: { ..., zoom: CAPTURE ? 1 : <zoom normal> },
   // después de crear el juego:
   if (import.meta.env.DEV) globalThis.__game = game;
   ```
3. `cd trailer && npm install && python3 -m venv .venv && .venv/bin/pip install edge-tts`
   (necesita red; Chromium sale de `~/.cache/ms-playwright` o de `CHROME=`).

## Flujo

1. **Qué vender.** Leer `studio/story.md` y `mechanics.md`. Elegir 8–12 momentos. Estructura
   que funcionó: gancho con el mundo (voz) → el conflicto (voz) → 3–4 **verbos** del juego con
   texto grande (ESCÓNDETE · PELEA · …) y flashes → progreso/descubrimiento (voz) → cierre con logo,
   lema y PRÓXIMAMENTE.
2. **Tomas** en `trailer/shots.mjs`: cada toma = `setup` (arrancar escena, colocar jugador, quitar
   enemigos que estorban, carga, HUD) + `input` (teclas por segundo) + `sfx` en el segundo exacto.
   Las ayudas de arriba del archivo son lo único propio de cada juego.
3. **Grabar**: juego corriendo (`npm run dev` en la raíz; si Leo ya lo tiene abierto en ese puerto,
   usar ese) → `node capture.mjs [toma…]` → `python3 sheet.py [toma…]` y **mirar** las hojas.
   Re-grabar solo la toma que salió mal.
4. **Guion** en `guion.json`: `lines` (voz) y `beats` (toma, `in`, `dur`, `vo`, `caption`, `enter`,
   `zoom`) + música. Voz: `.venv/bin/python make_voice.py` (solo regenera lo que cambió).
5. `python3 build.py && npm run check` → 0 errores. Los avisos `container_overflow` son el zoom
   lento dentro de cada toma: normales.
6. `npx --yes hyperframes@<pin> snapshot --no-end --describe false --at t1,t2,… .` y mirar
   `snapshots/contact-sheet.jpg` (textos, cierre, nada tapado).
7. `npm run render` → `python3 check_render.py` → mirar `renders/render-sheet.png`; audio ≈ −20 dB
   promedio, pico < −1 dB. Copiar a Descargas.
8. Reportar: ruta del MP4, duración, qué muestra cada tramo, qué salió raro.

## Reglas aprendidas (no repetir errores)

- **Grabar cuadro a cuadro, no la pantalla en vivo**: sin GPU el navegador va lento y el video
  sale a tirones. `capture.mjs` detiene el reloj (`game.loop.stop()`) y avanza con `game.step()`.
- Juego a **tamaño nativo** y escalar con `neighbor` (pixel art nítido). Juego no pixel:
  `pixelArt: false` en `shots.mjs` → `lanczos`.
- Los **diálogos y menús viven en la escena de interfaz**: si escondes el HUD no se ven. Esconder
  HUD en tomas de acción; dejarlo cuando el diálogo es la acción (retén, mercado, mapa).
- La **IA de enemigos varía**: `seed` por toma, quitar los enemigos que no actúan, recolocar al que
  sí, y revisar la hoja. No teletransportar al jugador dentro de árboles o muros.
- `tap` = bajar la tecla y soltarla 2 cuadros después (un toque de 0 cuadros no lo lee el juego).
- **HyperFrames**: no animar `autoAlpha` sobre un elemento `class="clip"` (animar un hijo); nada de
  `letterSpacing` animado; cada `<audio>` con `id`; el audio tiene que vivir dentro de `trailer/`
  (`build.py` copia música y sonidos del juego); la cámara de GSAP usa nombres largos
  (`"Sine.easeInOut"`), los tweens aceptan los cortos.
- **Voz**: narrador `es-MX-JorgeNeural`, `-8%`, `-6Hz`; frases cortas; puede seguir sobre el corte
  siguiente pero nunca pisa otra voz (`build.py` la corre). La música baja sola bajo la voz.
- **Música**: la del propio juego primero (una tranquila para el gancho, la tensa para la acción).
  Si el juego no tiene, `/media-use` → `resolve --type bgm`.
- Texto grande con fuente pixel del kit (Pixelify Sans, OFL) y contorno duro. Logo: se exporta del
  juego con `stills` en `shots.mjs` (textura escalada sin suavizar).

## Archivos del kit

| Archivo | Qué hace | ¿Se edita? |
|---|---|---|
| `shots.mjs` | Tomas: preparación, teclas, sonidos, imágenes fijas | Sí, por juego |
| `guion.json` | Orden, recortes, voz, textos, transiciones, música | Sí, por trailer |
| `capture.mjs` | Graba tomas cuadro a cuadro → `assets/clips/` | No |
| `make_voice.py` | Voz TTS → `assets/vo-*.mp3` + `vo.json` | No |
| `build.py` + `template.tpl` | Arman `index.html` (HyperFrames) | Solo si cambia el estilo |
| `sheet.py`, `check_render.py` | Revisar tomas y render | No |

`index.html`, tomas, renders y copias de audio no van a git: se regeneran.

## No

- No editar `index.html` a mano. No grabar con OBS ni con grabadora de pantalla.
- No inventar funciones que el juego no tiene para el trailer: se graba el juego real.
- No subir `assets/clips/`, `renders/` ni `.venv/` a git.
