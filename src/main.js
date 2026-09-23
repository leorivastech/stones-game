import Phaser from "phaser";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { WorldScene } from "./scenes/world.js";
import { UIScene } from "./scenes/ui.js";
import { VIEW_H, VIEW_W } from "./config.js";

const params = new URLSearchParams(location.search);

/**
 * Escala entera: cada píxel del juego mide lo mismo en pantalla (×2, ×3, ×4…).
 * Si el múltiplo entero deja demasiado borde en una pantalla chica, se estira un poco.
 */
function fitZoom() {
  const r = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const z = Math.max(1, Math.floor(r + 0.001));
  return z < 3 && r - z > 0.35 ? r : z;
}

const game = new Phaser.Game({
  type: params.get("renderer") === "canvas" ? Phaser.CANVAS : Phaser.AUTO,
  parent: "game",
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: "#1b1422",
  pixelArt: true,
  roundPixels: true,
  input: { gamepad: true },
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.NONE, zoom: fitZoom(), autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, WorldScene, UIScene],
});

window.addEventListener("resize", () => game.scale.setZoom(fitZoom()));

// Mano para revisar escenas desde el navegador mientras trabajamos.
if (import.meta.env.DEV) globalThis.__stones = game;
