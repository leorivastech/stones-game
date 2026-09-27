/**
 * Controles en pantalla para celular y tableta.
 *
 * Aparecen solos si el aparato es táctil (o con ?touch=1 para probar en la compu; ?touch=0 los
 * apaga). Escriben en `touch`, y `Controls` (input.js) lo lee junto con el teclado: el juego no
 * sabe de dónde vino el botón.
 *
 *   Mitad izquierda: palanca (aparece donde pones el dedo).
 *   Derecha: A acción (golpear / hablar / elegir) · B rodar, correr y salir · C agacharse · T tónico.
 *   Arriba a la derecha: pausa.
 *
 * Es HTML encima del juego (no Phaser) para que varios dedos funcionen a la vez y los botones
 * midan lo mismo en cualquier pantalla.
 */

import { P } from "../art/palette.js";

export const touch = {
  on: false,
  held: {},
  /** Toques por acción: cada escena compara con su cuenta y no se pierde un toque rápido. */
  count: {},
  stick: { x: 0, y: 0 },
};

/** Qué acciones del juego aprieta cada botón. */
const BUTTONS = [
  { id: "a", label: "A", sub: "acción", actions: ["attack", "interact", "confirm"] },
  { id: "b", label: "B", sub: "rodar", actions: ["roll", "cancel"] },
  { id: "c", label: "C", sub: "agachar", actions: ["hide"] },
  { id: "t", label: "T", sub: "tónico", actions: ["tonic"] },
  { id: "p", label: "II", sub: "", actions: ["pause"] },
];

const STICK_R = 46;
/** Franja a cada lado que el juego deja libre en celular: ahí van la palanca y los botones. */
export const SIDE = 100;

function press(actions, down) {
  for (const a of actions) {
    if (down && !touch.held[a]) touch.count[a] = (touch.count[a] ?? 0) + 1;
    touch.held[a] = down;
  }
}

function wantsTouch(params) {
  if (params.get("touch") === "1") return true;
  if (params.get("touch") === "0" || params.has("capture")) return false;
  return window.matchMedia?.("(pointer: coarse)").matches && (navigator.maxTouchPoints > 0 || "ontouchstart" in window);
}

const CSS = `
@font-face { font-family: "Pixel"; src: url("/assets/fonts/pixelify-sans.woff2") format("woff2"); font-weight: 400 700; }
html.touch, html.touch body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#touch { position: fixed; inset: 0; z-index: 10; pointer-events: none; font-family: "Pixel", monospace; touch-action: none;
  /* Corrimiento por la muesca / isla y la barra de inicio (0 en la compu). */
  --sr: max(0px, calc(env(safe-area-inset-right, 0px) - 12px)); --sb: env(safe-area-inset-bottom, 0px); }
#touch * { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#touch .zone { position: absolute; left: 0; top: 0; bottom: 0; width: 48%; pointer-events: auto; }
#touch .base { position: absolute; width: ${STICK_R * 2}px; height: ${STICK_R * 2}px; margin: -${STICK_R}px 0 0 -${STICK_R}px; border-radius: 50%;
  background: ${P.ink}66; border: 3px solid ${P.c4}55; box-sizing: border-box; left: ${SIDE / 2}px; bottom: 54px; top: auto; }
#touch .base.active { border-color: ${P.y3}aa; }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
  background: ${P.c4}99; border: 3px solid ${P.ink}; box-sizing: border-box; }
#touch .btn { position: absolute; pointer-events: auto; border-radius: 50%; box-sizing: border-box; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: ${P.c4}; background: ${P.ink}aa; border: 3px solid ${P.c4}66;
  text-shadow: 2px 2px 0 ${P.ink}; line-height: 1; }
#touch .btn b { font-size: 26px; font-weight: 700; }
#touch .btn i { font-style: normal; font-size: 11px; margin-top: 2px; color: ${P.y4}; }
#touch .btn.down { background: ${P.y1}dd; border-color: ${P.y4}; transform: scale(0.94); }
/* Los cuatro juntos en la franja derecha, como en un control: A grande, B abajo, C arriba, T tónico. */
#touch .btn-a { width: 68px; height: 68px; right: calc(6px + var(--sr)); bottom: calc(66px + var(--sb)); border-color: ${P.y3}aa; }
#touch .btn-a b { font-size: 30px; }
#touch .btn-b { width: 54px; height: 54px; right: calc(47px + var(--sr)); bottom: calc(17px + var(--sb)); }
#touch .btn-c { width: 54px; height: 54px; right: calc(47px + var(--sr)); bottom: calc(135px + var(--sb)); }
#touch .btn-t { width: 44px; height: 44px; right: calc(12px + var(--sr)); bottom: calc(192px + var(--sb)); }
#touch .btn-b b, #touch .btn-c b { font-size: 22px; }
#touch .btn-t b { font-size: 18px; }
#touch .btn-p { width: 44px; height: 44px; right: calc(14px + env(safe-area-inset-right, 0px) / 2); top: calc(12px + env(safe-area-inset-top, 0px)); border-radius: 10px; }
/* Tableta (juego arriba a lo ancho, controles en la franja de abajo): la pausa va al centro de la franja. */
html.touch-bottom #touch .btn-p { top: auto; right: auto; left: calc(50% - 22px); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
/* Franja baja (tableta acostada): los cuatro botones en fila, T C B A, y la palanca pegada abajo. */
html.touch-row #touch .btn-a { right: calc(16px + var(--sr)); bottom: calc(20px + var(--sb)); }
html.touch-row #touch .btn-b { right: calc(96px + var(--sr)); bottom: calc(27px + var(--sb)); }
html.touch-row #touch .btn-c { right: calc(162px + var(--sr)); bottom: calc(27px + var(--sb)); }
html.touch-row #touch .btn-t { right: calc(228px + var(--sr)); bottom: calc(32px + var(--sb)); }
html.touch-row #touch .base:not(.active) { bottom: calc(10px + var(--sb)) !important; }
/* Encima del juego (celular acostado): semitransparentes, para ver lo que hay debajo. */
html.touch-over #touch .btn:not(.down), html.touch-over #touch .base:not(.active) { opacity: 0.6; }
#touch .btn-p b { font-size: 18px; }
#touch .turn { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 14px;
  background: ${P.ink}; color: ${P.c4}; font-size: 22px; text-align: center; pointer-events: auto; }
#touch .turn span { font-size: 64px; color: ${P.y3}; }
/* main.js la prende cuando el aparato está parado y el juego quedaría muy chico (celular). */
html.turn #touch .turn { display: flex; }
`;

/** Arma los controles si el aparato es táctil. Si no, espera: el primer toque también los prende. */
export function setupTouch() {
  const params = new URLSearchParams(location.search);
  if (params.get("touch") === "0" || params.has("capture")) return;
  if (wantsTouch(params)) build();
  else window.addEventListener("touchstart", build, { once: true, passive: true });
}

function build() {
  if (touch.on) return;
  touch.on = true;
  document.documentElement.classList.add("touch");
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement("div");
  root.id = "touch";
  root.innerHTML = `<div class="zone"></div><div class="base"><div class="knob"></div></div>
    ${BUTTONS.map((b) => `<div class="btn btn-${b.id}" data-id="${b.id}"><b>${b.label}</b>${b.sub ? `<i>${b.sub}</i>` : ""}</div>`).join("")}
    <div class="turn"><span>↻</span>Gira el celular<br>para jugar acostado</div>`;
  document.body.append(root);
  buildStick(root);
  for (const b of BUTTONS) buildButton(root.querySelector(`.btn-${b.id}`), b.actions);
  // Pantalla completa al primer toque (en Android; iPhone no lo permite desde el navegador).
  root.addEventListener("pointerdown", fullscreen, { once: true });
  window.dispatchEvent(new Event("touchcontrols"));
}

function fullscreen() {
  if (!isFullscreen()) toggleFullscreen();
}

/** ¿El navegador deja poner la página en pantalla completa? (En iPhone no: sólo videos.) */
export function canFullscreen() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/** Entra o sale de pantalla completa. Si el navegador no puede, no pasa nada. */
export function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
      Promise.resolve(exit?.call(document)).catch(() => {});
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!req) return;
    Promise.resolve(req.call(el, { navigationUI: "hide" }))
      .then(() => screen.orientation?.lock?.("landscape").catch(() => {}))
      .catch(() => {});
  } catch { /* sin pantalla completa: se juega igual */ }
}

const isText = (t) => !!t?.closest?.("input, textarea, select, [contenteditable]");

/**
 * Que la página no se mueva ni se acerque (iPhone y iPad). Safari ignora `user-scalable=no` desde iOS 10:
 * con dos dedos en la pantalla (palanca + botón) lo toma como pellizco, y dos toques rápidos en A como
 * "doble toque para acercar". Se bloquean aquí; los campos de texto quedan libres para escribir.
 */
export function lockPage() {
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  // Pellizco de Safari (eventos propios de WebKit).
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, stop, { passive: false });
  document.addEventListener("dblclick", stop, { passive: false });
  // Arrastrar o pellizcar la página: nada se desplaza (la palanca sigue: usa pointermove).
  document.addEventListener("touchmove", (e) => {
    if (!isText(e.target) || e.touches.length > 1) stop(e);
  }, { passive: false });
  // Doble toque: los controles nunca necesitan el "click" que genera el toque; en lo demás, sólo se
  // corta el segundo toque rápido (así los botones del chat siguen funcionando).
  let last = 0;
  document.addEventListener("touchend", (e) => {
    if (isText(e.target)) return;
    const now = e.timeStamp;
    if (e.target?.closest?.("#touch") || now - last < 380 || e.touches.length) stop(e);
    last = now;
  }, { passive: false });
}

function buildButton(el, actions) {
  const ids = new Set();
  const down = (e) => {
    e.preventDefault();
    ids.add(e.pointerId);
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura: igual funciona */ }
    el.classList.add("down");
    press(actions, true);
    navigator.vibrate?.(8);
  };
  const up = (e) => {
    if (!ids.delete(e.pointerId)) return;
    if (ids.size) return;
    el.classList.remove("down");
    press(actions, false);
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("lostpointercapture", up);
}

function buildStick(root) {
  const zone = root.querySelector(".zone");
  const base = root.querySelector(".base");
  const knob = root.querySelector(".knob");
  let id = null;
  let cx = 0;
  let cy = 0;
  const rest = () => {
    base.style.left = `${SIDE / 2}px`;
    base.style.top = "";
    base.style.bottom = "54px";
    base.classList.remove("active");
    knob.style.transform = "";
    touch.stick.x = 0;
    touch.stick.y = 0;
  };
  const move = (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      dx = (dx / d) * STICK_R;
      dy = (dy / d) * STICK_R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Zona muerta chica; a 80 % del borde ya es velocidad completa.
    const k = d > 6 ? Math.min(1, d / (STICK_R * 0.8)) / Math.max(d, 1) : 0;
    touch.stick.x = (e.clientX - cx) * k;
    touch.stick.y = (e.clientY - cy) * k;
  };
  zone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (id !== null) return;
    id = e.pointerId;
    try { zone.setPointerCapture(id); } catch { /* sin captura: igual funciona */ }
    cx = e.clientX;
    cy = e.clientY;
    base.style.left = `${cx}px`;
    base.style.top = `${cy}px`;
    base.style.bottom = "auto";
    base.classList.add("active");
    move(e);
  });
  zone.addEventListener("pointermove", move);
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    rest();
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
  rest();
}
