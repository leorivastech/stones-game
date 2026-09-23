# Stones Game — cómo trabajamos

Este repo es el juego y la caja de herramientas. No es un editor.
Leo habla aquí (Cursor). El agente cambia `src/`. El navegador muestra el resultado.

## Arrancar

```bash
cd ~/Development/stones_Game
npm run dev
```

Abre http://127.0.0.1:5181/

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Arranque del juego (480×270, escala entera) | `src/main.js` |
| Escenas: arranque, título, mundo, interfaz | `src/scenes/` (`world.js` es el juego; `ui.js` HUD, diálogos, mercado, pausa) |
| Mapas (pueblos y rutas, trazados con letras) | `src/maps/` — leyenda en `src/maps/grid.js` |
| Jugador, enemigos, gente | `src/entities/` |
| Controles, constructor de mapas, efectos | `src/engine/` |
| Pixel art hecho en código | `src/art/` — paleta en `palette.js`, catálogo en `index.js` |
| Laboratorio de arte (sprites ampliados) | http://127.0.0.1:5181/lab.html?z=4 |
| Números que se ajustan jugando | `src/config.js` |
| Economía (precios, calor, carga) | `src/state.js` + `src/world.js` |
| Trailer (grabar el juego + voz + HyperFrames) | `trailer/` — skill `trailer-juego` |
| Historia, mecánicas, arte | `studio/` |
| Guía viva (pestañas) | `docs/guides/stones-studio.html` |
| Assets de prueba | `public/assets/proto/` |
| Assets cerrados | `public/assets/final/` |
| Skills oficiales Phaser 4.2.1 | `node_modules/phaser/skills/` (28) |
| Cómo debemos trabajar | `.cursor/skills/phaser-work/` y `studio-work` |
| Otro juego (molde) | skill `empezar-juego` → `~/Development/framework-ia-videojuegos` |

## Reglas

- Phaser **4** solamente. No copies recetas de Phaser 3. No Three.js salvo pedido explícito.
- Física: Arcade, salvo que Leo pida otra.
- Un lugar nuevo = un archivo en `src/maps/` (y agregarlo a `src/maps/index.js`). No montes un editor, MCP ni Unity.
- Arte: sólo pixel art con la paleta de `src/art/palette.js`. Nada de antialias ni formas vectoriales.
- Revisar arte nuevo en `lab.html` antes de meterlo al juego. Verificar en WebGL y en Canvas (`?renderer=canvas`).
- F1 en el juego: depuración (1 oro · 2 carga · 3 calor · 4 vida · 5 fama · 6 caballo).
- Historia y plan viven en `studio/`, no solo en el chat. Actualizarlos después de cada plática.
- Después de cambiar código, Leo recarga el navegador.

## Skills de Phaser (leer el que toque)

`game-setup-and-config` · `scenes` · `sprites-and-images` · `loading-assets` · `input-keyboard-mouse-touch` · `physics-arcade` · `cameras` · `animations` · `tilemaps` · `audio-and-sound` · `tweens` · `text-and-bitmaptext` · `graphics-and-shapes` · `groups-and-containers` · `particles` · `time-and-timers` · `events-system` · `scale-and-responsive` · `v4-new-features`

Los demás (`physics-matter`, `filters-and-postfx`, `v3-to-v4-migration`, …) solo si el trabajo lo pide.
