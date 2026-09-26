# Créditos de audio

## Música y efectos propios (IA local)

**Todo el audio que carga el juego es propio de Stones** (desde el 26-sep-2026): la música
(`music-ia/`: pistas por zona en capas calma/tensión, título, stingers y jingles) y todos los efectos,
tonos de interfaz y ambientes (`sfx-ia/`). Se generaron en esta máquina, sin servicios de pago, con
modelos de licencia abierta que no reclaman lo que generan:

- Música: **ACE-Step 1.5** (licencia MIT)
- Efectos y ambientes: **MOSS-SoundEffect v2.0** (licencia Apache-2.0)

Cómo se generaron (prompts, semillas, puntajes CLAP): `studio/musica/ia/` y `studio/musica/README.md`.

El único sonido que no es una muestra es el tecleo de los diálogos: un blip de 18 ms sintetizado en el
navegador (WebAudio), sin archivo.

## Archivos de antes que siguen en el repo (ya no suenan en el juego)

Los usa el trailer (`trailer/`) y se pueden comparar en `escuchar.html` → «Antes». Todo es CC0
(dominio público; el crédito es cortesía).

### Efectos

- `sfx/armor.ogg` — Kenney · CC0 · https://kenney.nl/assets/impact-sounds (origen: `kenney-impact/Audio/impactPlate_light_000.ogg`)
- `sfx/arrow-hit.ogg` — Kenney · CC0 · https://kenney.nl/assets/impact-sounds (origen: `kenney-impact/Audio/impactSoft_medium_000.ogg`)
- `sfx/coin.ogg` — StarNinjas · CC0 · https://opengameart.org/content/12-coin-sound-effects (origen: `oga-coins12/coin.1.ogg`)
- `sfx/die.ogg` — rubberduck · CC0 · https://opengameart.org/users/rubberduck (80 CC0 creature SFX #2) (origen: `oga-80creature2/die_01.ogg`)
- `sfx/jingle-free.ogg` — Kenney · CC0 · https://kenney.nl/assets/music-jingles (origen: `kenney-jingles/Audio/8-Bit jingles/jingles_NES00.ogg`)
- `sfx/jingle-mission.ogg` — Kenney · CC0 · https://kenney.nl/assets/music-jingles (origen: `kenney-jingles/Audio/Pizzicato jingles/jingles_PIZZI00.ogg`)
- `sfx/lever.ogg` — rubberduck · CC0 · https://opengameart.org/users/rubberduck (100 CC0 SFX #2) (origen: `oga-100sfx2/sfx100v2_switch_01.ogg`)
- `sfx/splash.ogg` — rubberduck · CC0 · https://opengameart.org/users/rubberduck (40 CC0 water SFX) (origen: `oga-water/splash_01.ogg`)
- `sfx/swing.ogg` — artisticdude · CC0 · https://opengameart.org/content/swishes-sound-pack (origen: `oga-swishes/swishes/swish-1.wav`)
- `sfx/swing2.ogg` — artisticdude · CC0 · https://opengameart.org/content/swishes-sound-pack (origen: `oga-swishes/swishes/swish-2.wav`)
- `sfx/ui-error.ogg` — Kenney · CC0 · https://kenney.nl/assets/interface-sounds (origen: `kenney-interface/Audio/error_001.ogg`)
- `sfx/ui-move.ogg` — Kenney · CC0 · https://kenney.nl/assets/interface-sounds (origen: `kenney-interface/Audio/select_001.ogg`)
- `sfx/ui-ok.ogg` — Kenney · CC0 · https://kenney.nl/assets/interface-sounds (origen: `kenney-interface/Audio/confirmation_001.ogg`)
- `proto/sfx/draw.mp3`, `latch.mp3`, `sack.mp3`, `chop.mp3` — Kenney · CC0 · https://opengameart.org/content/50-rpg-sound-effects (ver `proto/CREDITS.md`)

### Ambientes

- `ambience/cave.ogg` — JaggedStone · CC0 · https://opengameart.org/content/loopable-dungeon-ambience (origen: `single/dungeon_ambient_1_0.ogg`)

## Sólo para el trailer (no suena en el juego)

- `music/trailer.ogg` — *Epic Orchestral Fantasy Theme* — linxiaoma · CC-BY 4.0 · https://opengameart.org/content/epic-orchestral-fantasy-theme

Las pistas, ambientes y efectos de OpenGameArt/Kenney que ya no suenan siguen en `music/`, `ambience/`,
`sfx/` y `proto/` (se pueden oír en `escuchar.html` → «Antes»); sus créditos están en la historia de git
de este archivo y en `proto/CREDITS.md`.

## Fuentes

- `fonts/pixelify-sans.woff2` — Pixelify Sans, de Stefie Justprince. SIL Open Font License 1.1. Se usa en los botones táctiles.
