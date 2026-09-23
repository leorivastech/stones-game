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
| Arranque del juego | `src/main.js` |
| Escena actual | `src/scenes/play.js` |
| Gráficos proto (código) | `src/gfx/` |
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
- Un diseño nuevo = un archivo en `src/scenes/`. No montes un editor, MCP ni Unity.
- Historia y plan viven en `studio/`, no solo en el chat. Actualizarlos después de cada plática.
- Después de cambiar código, Leo recarga el navegador.

## Skills de Phaser (leer el que toque)

`game-setup-and-config` · `scenes` · `sprites-and-images` · `loading-assets` · `input-keyboard-mouse-touch` · `physics-arcade` · `cameras` · `animations` · `tilemaps` · `audio-and-sound` · `tweens` · `text-and-bitmaptext` · `graphics-and-shapes` · `groups-and-containers` · `particles` · `time-and-timers` · `events-system` · `scale-and-responsive` · `v4-new-features`

Los demás (`physics-matter`, `filters-and-postfx`, `v3-to-v4-migration`, …) solo si el trabajo lo pide.
