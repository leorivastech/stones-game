# 2026-09-19 · Todo más chico, y fuera las máscaras

## Qué pidió Leo

- Los caminos eran gigantes y aburridos: "un caminito muy cortito que dé una vueltita, pasa el evento y ya".
- Las ciudades también demasiado grandes: "todo es demasiado grande y no pasa nada de acción".
- Los caminos con círculos apilados eran horribles; conservar la calidad de los diseños de Codex.
- En su navegador veía Ashfen bajo el agua, Valkeep hecho de piedra y Verdelume de adoquín.

## Qué se encontró

Las capas recortadas (plaza de adoquín, superficie del camino, agua del golfo, transición de bioma)
usaban máscaras de geometría de Phaser. En Chrome funcionan; en el navegador embebido de Cursor
no se aplican y la capa se pinta completa. Las capturas del agente (Chrome headless) se veían
bien mientras la pantalla de Leo se veía rota. Lección: **verificar en la pantalla real de Leo**
(`gnome-screenshot`), no solo en Chrome.

## Qué se hizo

- `src/routes.js`: mundo de ruta 1760×1600 → 1040×700. Cada ruta es un solo recodo (~5 s a pie),
  extremos en el borde del mundo. `PATH_HALF` 46.
- `src/gfx/route.js`: camino como banda por tramos (`fillBand`, cuadriláteros + discos) que no se
  dobla en curvas; rodadas, grano y manchas dibujadas (`sprinkleBand`); transición de bioma con
  elipses de `GROUND_COLORS`. **Cero máscaras.**
- `src/gfx/townground.js`: calles con vaivén, plaza con adoquines reales recortados por
  matemática, costa con arena, agua, crestas y espuma. **Cero máscaras.**
- `src/scenes/town.js`: pueblo 1400×1000 → 1000×700, todo relativo a `CX/CY`. Cámara zoom 0.85.
  Con golfo, la fila sur de casas sube y el portón queda en la orilla. Vegetación por bioma en
  `placeEdgeProp` (pinos en montaña y nieve, palmeras en selva, roca/paja en desierto).
- `src/scenes/road.js`: cámara zoom 0.85, zona de evento 190×160, llegada a 60 px.
- `src/hud.js`: barra 84 → 42 px; aviso de llegada al pie de pantalla.
- `src/gfx/tiles.js`: fuera las manchas grandes de los tiles (repetían en cuadrícula de 96 px);
  nuevo piso `highland` para Valkeep. `bake.js` lo registra.
- `src/world.js`: Valkeep usa `highland`, tintes de piedra.
- `src/main.js`: `globalThis.__stones` solo en DEV, para inspeccionar escenas desde el navegador.

## Decisiones

- Rutas cortas: un recodo, evento a mitad, llegada. Nada de mapas largos "donde no pasa nada".
- Nunca depender de máscaras de geometría para el arte del piso.
- Verificar siempre con captura de la pantalla de Leo, además de Chrome.

## Pendiente

- Leo revisa cada ciudad. Ajustar una por una con captura de su pantalla.
- Valkeep aún sin cerros/acantilados que lo hagan sentir "entre picos".
- Plaza: revisar contraste del adoquín bajo el brillo del puesto.
