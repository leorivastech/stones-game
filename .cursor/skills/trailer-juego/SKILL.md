---
name: trailer-juego
description: >-
  Hace el trailer de un juego del framework (Phaser 4): abre el juego, lo graba
  cuadro a cuadro jugando solo (Playwright), narra con voz TTS (edge-tts), usa la
  música y sonidos del propio juego y arma el video con HyperFrames. Úsalo cuando
  Leo diga trailer, teaser, video del juego, gameplay para redes, o "graba el juego".
---

# Trailer de un juego

Salida: MP4 **1920×1080, 30 fps** — teaser 30–45 s o trailer completo 75–90 s — en
`<juego>/trailer/renders/` y copia en `~/Downloads/<juego>-trailer.mp4`. Primera versión sin
preguntar; al final reportar dudas.

Ejemplo real y completo: `stones_Game/trailer/` — `guion.json` (v3, teaser de 40 s, todo en
cortes rápidos con gráficos encima: el que más gustó) y `guion-v2.json` (90 s, 36 cortes, 10 voces).
`python3 build.py [guion]` y `make_voice.py [guion]` aceptan cualquiera de los dos.

## Arranque (una vez por juego)

1. Copiar el kit: `cp -r .cursor/skills/trailer-juego/kit trailer` (en la raíz del juego).
2. Enganches en el juego (si no están):
   ```js
   const CAPTURE = new URLSearchParams(location.search).has("capture");
   // en la config de Phaser.Game:
   audio: CAPTURE ? { noAudio: true } : {},
   scale: { ..., zoom: CAPTURE ? 1 : <zoom normal> },
   // después de crear el juego:
   if (import.meta.env.DEV) globalThis.__game = game;
   ```
   Y en la función que toca efectos del juego (la primera línea), para que la grabación anote
   cada sonido en su cuadro (en modo captura no hay audio):
   ```js
   if (globalThis.__captureSfx) globalThis.__captureSfx.push({ name, volume });
   ```
3. `cd trailer && npm install && python3 -m venv .venv && .venv/bin/pip install edge-tts librosa`
   (necesita red; Chromium sale de `~/.cache/ms-playwright` o de `CHROME=`).

## Flujo

1. **Qué vender.** Leer `studio/` (historia, mecánicas). Estructura que funcionó (Stones v2):
   apertura con los lugares y su **rótulo** (town) → el conflicto (voz) → **tarjeta** sobre negro en
   el silencio de la música → la premisa (voz sobre la pantalla del juego que la muestra) → 6–8
   **verbos** con texto grande y rótulo chico, uno por compás, entrando con **barrido** → el mundo
   vivo (voz) → tensión: cámara lenta + **barras de cine** → **clímax**: cortes de medio compás con
   destellos y sacudidas → **logo que cae de golpe** con rayos, lema, PRÓXIMAMENTE y créditos.
1a. **Teaser corto (~40 s, lo que Leo prefirió en Stones v3):** TODO al estilo del clímax — cortes
   de medio compás (~1.1 s) con destello (`"flash": {"opacity": 1, "dur": 0.45}`) y todos los textos
   encima de los cortes, nada de tomas largas. Guion de 5–7 frases de 1–2 s (`"tight": true` en la
   voz quita los silencios de edge-tts). Música en dos tramos: inicio de la canción → salto a la
   subida previa al clímax (una tarjeta "¿TE ATREVES?" cae en el salto) → verbos sobre el clímax →
   ráfaga de 3 cortes de 0.37 s → logo. Gráficos que lucen HyperFrames: letras que caen con separación
   de color (`"letters": true`), `words` (frases en orden), `stamp` (sello que cae con sacudida),
   `counter` (número que sube), `ticker` (cinta de precios), `split` (2–3 tomas en paneles
   inclinados), tarjeta con `gems`, y en el cierre `gems` (esquirlas), anillo de choque y barrido de
   luz sobre el logo. Ejemplo: `stones_Game/trailer/guion.json` (v3); el largo es `guion-v2.json`.
1b. **Música con curva.** `.venv/bin/python beats.py <pista>` imprime tempo, compases y energía por
   segundo. Elegir una pista que tenga respiro y clímax (no una plana) y cortar en sus compases:
   cada `dur` = distancia al siguiente compás. El clímax del trailer va donde la energía sube.
2. **Tomas** en `trailer/shots.mjs`: cada toma = `setup` (arrancar escena, colocar jugador, quitar
   enemigos que estorban, carga, HUD) + `input` (teclas por segundo) + `sfx` en el segundo exacto.
   Las ayudas de arriba del archivo son lo único propio de cada juego.
3. **Grabar**: juego corriendo (`npm run dev` en la raíz; si Leo ya lo tiene abierto en ese puerto,
   usar ese) → `node capture.mjs [toma…]` → `python3 sheet.py [toma…]` y `python3 sheets.py …`
   (junta 4 hojas por imagen) y **mirar** todas. Re-grabar solo la toma que salió mal.
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
- **Voz**: narrador `es-MX-JorgeNeural`, `-6%`, `-8Hz`; frases cortas (edge-tts alarga las pausas:
  medir con `make_voice.py` y acortar si la voz se come el corte siguiente); nunca pisa otra voz
  (`build.py` la corre). La música baja sola bajo la voz.
- **Sonido del juego**: con el enganche de `__captureSfx`, `capture.mjs` anota cada sonido que el
  juego pidió (golpes, flechas, pasos, monedas) y `build.py` lo pone en su cuadro. Los pasos van más
  bajos (`stepGain`). El mismo sonido en el mismo cuadro se pone una vez, y cada sonido busca un
  carril libre (si dos se enciman en un carril, `check` avisa).
- **Textos**: la palabra grande en el **tercio de arriba** (la acción suele estar al centro); el
  rótulo chico con fondo oscuro (si no, falla el contraste sobre arena o nieve).
- **Diálogo sobre negro** (cruces, fundidos): ocultar sólo el HUD (`ui.hud.setVisible(false)`), no la
  cámara de la interfaz, o se pierde el diálogo.
- **Contenedores sin tiempo** (paneles de `split`): el `<video>` no puede ir dentro de algo con
  `data-start`, así que el contenedor se muestra/oculta con `tl.set(autoAlpha)`; si no, su fondo
  tapa todo el video. `fromTo` que empieza tarde sobre algo ya visible → `immediateRender: false`.
  Nada de animar `letterSpacing` (es error en `check`).
- Texto grande sobre menús del juego: fondo oscuro difuso detrás (`.caption`), si no compite con la tabla.
- Si la IA del juego es azarosa (rumores, emboscadas), fijar `Math.random` en el setup de esa toma.
- **Música**: la del propio juego primero (una tranquila para el gancho, la tensa para la acción).
  Si el juego no tiene, `/media-use` → `resolve --type bgm`.
- Texto grande con fuente pixel del kit (Pixelify Sans, OFL) y contorno duro. Logo: se exporta del
  juego con `stills` en `shots.mjs` (textura escalada sin suavizar). Sin logo, el cierre pone el
  nombre en texto; sin música, `build.py` avisa y sigue (queda solo voz: conseguir música).
- Render: si se queda sin memoria, `npx --yes hyperframes@<pin> render --workers 4`.

## Archivos del kit

| Archivo | Qué hace | ¿Se edita? |
|---|---|---|
| `shots.mjs` | Tomas: preparación, teclas, sonidos, imágenes fijas | Sí, por juego |
| `guion.json` | Orden, recortes, voz, textos, transiciones, música | Sí, por trailer |
| `capture.mjs` | Graba tomas cuadro a cuadro → `assets/clips/` | No |
| `make_voice.py` | Voz TTS → `assets/vo-*.mp3` + `vo.json` | No |
| `build.py` + `template.tpl` | Arman `index.html` (HyperFrames) | Solo si cambia el estilo |
| `beats.py` | Tempo, compases y energía de la música → `assets/beats.json` | No |
| `sheet.py`, `sheets.py`, `check_render.py` | Revisar tomas (de a una o 4 por imagen) y render | No |

`index.html`, tomas, renders y copias de audio no van a git: se regeneran.

## No

- No editar `index.html` a mano. No grabar con OBS ni con grabadora de pantalla.
- No inventar funciones que el juego no tiene para el trailer: se graba el juego real.
- No subir `assets/clips/`, `renders/` ni `.venv/` a git.
