import Phaser from "phaser";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { WorldScene } from "./scenes/world.js";
import { UIScene } from "./scenes/ui.js";
import { VIEW_H, VIEW_W } from "./config.js";
import { SIDE, setupTouch, touch, lockPage } from "./engine/touch.js";
import { online, connect, flushSave } from "./net/online.js";
import { saveGame } from "./state.js";
import { setupHud, askName } from "./net/hud.js";
import { setupVoice, voice } from "./net/voice.js";

const params = new URLSearchParams(location.search);
// ?capture=1 → modo grabación para trailers (trailer/capture.mjs): tamaño nativo, sin audio.
const CAPTURE = params.has("capture");

/** Franja de abajo mínima para los controles en fila (tableta). Con menos, van encima del juego. Ver touch.js. */
const BAND_MIN = 112;
/** Con una franja así de alta caben los botones en su racimo de siempre (tableta parada). */
const BAND_TALL = 250;

/**
 * Lo que de verdad se ve. En iPhone/iPad `innerWidth` cambia si la página quedó acercada y con la barra
 * de Safari; `visualViewport` × escala da el tamaño de la página sin acercar.
 */
function viewSize() {
  const vv = window.visualViewport;
  const s = vv?.scale || 1;
  const w = vv ? vv.width * s : window.innerWidth;
  const h = vv ? vv.height * s : window.innerHeight;
  return { w: Math.round(w) || window.innerWidth, h: Math.round(h) || window.innerHeight };
}

/** Zonas seguras (muesca, isla, barra de inicio). Se miden con un div que usa env(safe-area-inset-*). */
let probe;
function safeInsets() {
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;"
      + "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe);
  const n = (v) => parseFloat(v) || 0;
  return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
}

/**
 * Dónde va el juego y a qué zoom.
 *  - Compu: toda la ventana, escala entera (cada píxel del juego mide lo mismo: ×2, ×3…) si se pierde
 *    poco; si no, estira.
 *  - Celular y tableta: SIEMPRE lo más grande que quepa (zoom fraccional; los píxeles pueden quedar un
 *    poco desiguales). Los controles van, según sobre espacio:
 *      "bottom": en la franja de abajo (tableta: juego a lo ancho arriba);
 *      "side":   en franjas a los lados (pantallas muy alargadas);
 *      "over":   encima del juego, semitransparentes, en las esquinas de abajo (celular acostado).
 */
function plan() {
  const { w, h } = viewSize();
  const ins = safeInsets();
  const sw = w - ins.l - ins.r;
  const sh = h - ins.t - ins.b;
  const r = Math.max(0.25, Math.min(sw / VIEW_W, sh / VIEW_H));
  let zoom;
  if (CAPTURE) zoom = 1;
  else if (touch.on || r < 1) zoom = r;
  else {
    const z = Math.floor(r + 0.001);
    zoom = z < 3 && r - z > 0.35 ? r : z;
  }
  const gw = VIEW_W * zoom;
  const gh = VIEW_H * zoom;
  let kind = "full";
  let left = ins.l + (sw - gw) / 2;
  let top = ins.t + (sh - gh) / 2;
  let band = 0;
  if (touch.on) {
    band = h - ins.t - gh;
    if (band >= BAND_MIN + ins.b) {
      kind = "bottom";
      // Juego arriba; si sobra mucho (tableta parada), baja hasta dejar la franja justa para los controles.
      const room = Math.max(BAND_TALL, BAND_MIN + ins.b);
      top = ins.t + Math.max(0, (h - ins.t - gh - room) / 2);
      band = h - top - gh;
    } else if ((sw - gw) / 2 >= SIDE) kind = "side";
    else kind = "over";
  }
  return {
    zoom,
    kind,
    row: kind === "bottom" && band < BAND_TALL,
    left: Math.round(left),
    top: Math.round(top),
    // Parado y muy chico (celular): mejor pedir que lo giren.
    turn: touch.on && h > w && r < 1.2,
    w,
    h,
  };
}

// Celular y tableta: palanca y botones en pantalla (o ?touch=1 para probarlos en la compu).
setupTouch();
// Que Safari no acerque ni desplace la página (pellizco, doble toque).
if (!CAPTURE) lockPage();

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
  scale: { mode: Phaser.Scale.NONE, zoom: plan().zoom, autoCenter: Phaser.Scale.NO_CENTER },
  scene: [BootScene, TitleScene, WorldScene, UIScene],
});

const typing = () => !!document.activeElement?.closest?.("input, textarea, select, [contenteditable]");

/** Por si Safari alcanzó a acercar la página: reescribir el viewport la regresa a escala 1. */
function resetZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const base = meta.content;
  meta.content = base.replace(/initial-scale=[\d.]+/, "initial-scale=1.0001");
  requestAnimationFrame(() => { meta.content = base; });
}

/** Acomoda el juego: zoom, posición y franjas. Se llama en cada cambio de tamaño o giro. */
function fit() {
  // Con el teclado abierto (chat, nombre) no se mueve nada: al cerrarlo se acomoda.
  if (typing()) return;
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  if ((window.visualViewport?.scale ?? 1) > 1.01) resetZoom();
  const p = plan();
  const root = document.documentElement;
  root.classList.toggle("touch-bottom", touch.on && p.kind === "bottom");
  root.classList.toggle("touch-row", touch.on && p.row);
  root.classList.toggle("touch-over", touch.on && p.kind === "over");
  root.classList.toggle("turn", p.turn);
  if (Math.abs(game.scale.zoom - p.zoom) > 0.0001) game.scale.setZoom(p.zoom);
  const box = document.getElementById("game");
  box.style.left = `${p.left}px`;
  box.style.top = `${p.top}px`;
  if (game.canvas) game.scale.updateBounds();
}

// iOS avisa del nuevo tamaño tarde (al girar, al esconder la barra, al cerrar el teclado): se acomoda
// al momento y otra vez un poco después.
let timers = [];
function refit() {
  fit();
  for (const t of timers) clearTimeout(t);
  timers = [120, 400, 900].map((ms) => setTimeout(fit, ms));
}
if (!CAPTURE) {
  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", refit);
  window.visualViewport?.addEventListener("resize", refit);
  window.visualViewport?.addEventListener("scroll", () => { if (!typing() && (window.scrollX || window.scrollY)) refit(); });
  document.addEventListener("fullscreenchange", refit);
  document.addEventListener("webkitfullscreenchange", refit);
  // Al terminar de escribir iOS deja la página corrida: de regreso arriba y a acomodar.
  document.addEventListener("focusout", (e) => {
    if (e.target?.closest?.("input, textarea, select, [contenteditable]")) setTimeout(refit, 60);
  });
}
game.events.once(Phaser.Core.Events.READY, fit);
fit();

globalThis.__stonesGame = game;
// Para revisar el modo en línea desde el navegador (y en las pruebas).
globalThis.__online = online;
globalThis.__voice = voice;

// Al cerrar o esconder la página (celular que se bloquea o cambia de app),
// el avance se guarda inmediatamente en memoria (localStorage) y, si está en línea, al servidor.
const flush = () => {
  if (!game.scene.isActive("world")) return;
  saveGame(game.registry);
  if (online.on) flushSave();
};
window.addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });

// En línea (?online=1, lo pone el título al elegir "En línea"): nombre, conexión al servidor, chat y voz.
if (online.on) {
  setupHud();
  setupVoice();
  askName().then(() => connect(game.registry));
}

// Si los botones se prenden después (primer toque en una compu con pantalla táctil), se hace lugar.
window.addEventListener("touchcontrols", refit);

// Mano para revisar escenas desde el navegador y para grabar trailers.
if (import.meta.env.DEV) {
  globalThis.__stones = game;
  globalThis.__game = game;
}
