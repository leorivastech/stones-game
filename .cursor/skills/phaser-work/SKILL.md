---
name: phaser-work
description: >-
  Workflow for this Phaser 4 game repo. Use when Leo asks to make, change, or
  design a Phaser game, scene, sprite, player, door, enemy, platform, or
  browser game in stones_Game. Plan in chat, edit src/, reload the browser.
  Do not build a visual editor or MCP studio.
---

# Cómo trabajamos Phaser aquí

Leo describe el juego en el chat. Tú cambias código. Él recarga
http://127.0.0.1:5181/ y lo ve. No construyas un editor.

## Pasos

1. Lee `AGENTS.md`, `studio/` (historia / mecánicas / arte) y el código actual
   (`src/main.js`, `src/scenes/`). Si la plática fue de diseño, actualizá el studio
   (skill `studio-work`).
2. Abre el skill oficial que toque:
   `node_modules/phaser/skills/<nombre>/SKILL.md`
   (en este repo: `~/Development/stones_Game/node_modules/phaser/skills/`).
   Si Cursor abrió esta carpeta, también están en `.cursor/skills/`.
3. Phaser **4.2.1** solamente. Arcade para movimiento/colisión, salvo que pidan Matter.
4. Cambia el mínimo. Un diseño nuevo = `src/scenes/<nombre>.js` y, si hay que mostrarlo,
   registrarlo en `src/main.js`.
5. Assets en `public/assets/`, se cargan en `preload()` con `this.load.*`.
6. No inventes APIs de Phaser 3 (`Geom.Point`, `Math.PI2`, plugins viejos).
   Si dudas, lee `v3-to-v4-migration`.
7. No MCP, no Unity, no Tauri, no chat interno. Este chat es el plan.

## Mapa rápido de skills

| Si Leo pide | Skill |
|---|---|
| Arrancar el Game, canvas, pixel art | `game-setup-and-config` |
| Otra pantalla / menú | `scenes` |
| Imagen, sprite | `sprites-and-images`, `loading-assets` |
| Teclado, clic | `input-keyboard-mouse-touch` |
| Gravedad, suelo, overlap | `physics-arcade` |
| Cámara que sigue | `cameras` |
| Animar un spritesheet | `animations` |
| Mapa Tiled | `tilemaps` |
| Sonido | `audio-and-sound` |

## Ejemplo

Leo: «que el cuadrado salte con espacio».
Tú: lees `physics-arcade` + `input-keyboard-mouse-touch`, pones gravedad y
`this.cursors.space`, no reescribes el proyecto.
