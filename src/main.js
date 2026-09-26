import Phaser from "phaser";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { WorldScene } from "./scenes/world.js";
import { UIScene } from "./scenes/ui.js";
import { VIEW_H, VIEW_W } from "./config.js";
import { SIDE, setupTouch, touch } from "./engine/touch.js";
import { online, connect, flushSave } from "./net/online.js";
import { saveGame } from "./state.js";
import { setupHud, askName } from "./net/hud.js";
import { setupVoice, voice } from "./net/voice.js";

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
  // En celular también se prefiere el zoom entero (píxeles parejos) con franjas a los lados, si lo que
  // se pierde es poco: menos de 12 % de la pantalla, o hasta 0.35 de zoom desde ×2. Sólo cuando el
  // entero deja demasiado borde (un celular chico entre ×1 y ×2) se estira a lo que cabe.
  if (touch.on) return z >= 3 || (z >= 2 && r - z < 0.35) || (r - z) / r < 0.12 ? z : r;
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

globalThis.__stonesGame = game;
// Para revisar el modo en línea desde el navegador (y en las pruebas).
globalThis.__online = online;
globalThis.__voice = voice;

// En línea (?online=1, lo pone el título al elegir "En línea"): nombre, conexión al servidor, chat y voz.
if (online.on) {
  setupHud();
  setupVoice();
  askName().then(() => connect(game.registry));
  // Al cerrar o esconder la página (celular que se bloquea), el avance sale ya al servidor.
  const flush = () => {
    if (!game.scene.isActive("world")) return;
    saveGame(game.registry);
    flushSave();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
}

// Si los botones se prenden después (primer toque en una compu con pantalla táctil), se hace lugar.
window.addEventListener("touchcontrols", () => game.scale.setZoom(fitZoom()));

// Mano para revisar escenas desde el navegador y para grabar trailers.
if (import.meta.env.DEV) {
  globalThis.__stones = game;
  globalThis.__game = game;
}
