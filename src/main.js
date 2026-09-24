import Phaser from "phaser";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { WorldScene } from "./scenes/world.js";
import { UIScene } from "./scenes/ui.js";
import { VIEW_H, VIEW_W } from "./config.js";
import { SIDE, setupTouch, touch } from "./engine/touch.js";

const params = new URLSearchParams(location.search);
// ?capture=1 → modo grabación para trailers (trailer/capture.mjs): tamaño nativo, sin audio.
const CAPTURE = params.has("capture");

/**
 * Escala entera: cada píxel del juego mide lo mismo en pantalla (×2, ×3, ×4…).
 * Si el múltiplo entero deja demasiado borde en una pantalla chica, se estira un poco.
 */
function fitZoom() {
  // En celular se deja una franja a cada lado para la palanca y los botones: no tapan el juego.
  const w = touch.on ? window.innerWidth - SIDE * 2 : window.innerWidth;
  const r = Math.min(w / VIEW_W, window.innerHeight / VIEW_H);
  const z = Math.max(1, Math.floor(r + 0.001));
  // En celular la pantalla es chica: se usa todo lo que cabe (entero sólo si casi llega).
  if (touch.on) return z >= 2 && r - z < 0.15 ? z : r;
  return z < 3 && r - z > 0.35 ? r : z;
}

// Celular y tableta: palanca y botones en pantalla (o ?touch=1 para probarlos en la compu).
setupTouch();

const game = new Phaser.Game({
  type: params.get("renderer") === "canvas" ? Phaser.CANVAS : Phaser.AUTO,
  parent: "game",
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: "#1b1422",
  pixelArt: true,
  roundPixels: true,
  input: { gamepad: !CAPTURE },
  audio: CAPTURE ? { noAudio: true } : {},
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.NONE, zoom: CAPTURE ? 1 : fitZoom(), autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, WorldScene, UIScene],
});

if (!CAPTURE) window.addEventListener("resize", () => game.scale.setZoom(fitZoom()));

// Si los botones se prenden después (primer toque en una compu con pantalla táctil), se hace lugar.
window.addEventListener("touchcontrols", () => game.scale.setZoom(fitZoom()));

// Mano para revisar escenas desde el navegador y para grabar trailers.
if (import.meta.env.DEV) {
  globalThis.__stones = game;
  globalThis.__game = game;
}
