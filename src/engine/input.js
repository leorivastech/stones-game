/**
 * Controles unificados: teclado, control de consola y pantalla táctil.
 * Cada acción tiene varias teclas. `held` = apretada; `pressed` = recién apretada este cuadro.
 *
 * Las teclas van juntas, en dos grupos iguales (según con qué mano muevas):
 *
 *   Mover: WASD o flechas (palanca / cruceta)
 *   Acción — golpear, o hablar y usar si tienes algo enfrente:  J  o  Z   (A)
 *   Rodar (tocar) · correr (mantener):                           K  o  X   (B)
 *   Agacharse · esconderse:                                      L  o  C   (X)
 *   Tónico:                                                      I  o  V   (Y)
 *   Pausa y mapa:                                                ESC o P   (Start)
 *
 * Siguen funcionando las de antes (E, ESPACIO, SHIFT, Q, ENTER), pero ya no se anuncian.
 */

import { touch } from "./touch.js";

const ACTION = ["J", "Z", "E", "SPACE"];

const KEYS = {
  up: ["W", "UP"],
  down: ["S", "DOWN"],
  left: ["A", "LEFT"],
  right: ["D", "RIGHT"],
  attack: ACTION,
  interact: ACTION,
  roll: ["K", "X", "SHIFT"],
  hide: ["L", "C"],
  tonic: ["I", "V", "Q"],
  pause: ["ESC", "P", "ENTER"],
  confirm: [...ACTION, "ENTER"],
  cancel: ["K", "X", "ESC", "BACKSPACE"],
  debug: ["F1"],
};

const PAD = {
  attack: [0], interact: [0], roll: [1], hide: [2], tonic: [3, 4], pause: [9],
  confirm: [0], cancel: [1],
  up: [12], down: [13], left: [14], right: [15],
};

/** Cómo se llama la tecla de una acción en pantalla (en celular, el botón). */
export function keyName(action) {
  if (touch.on) return { attack: "A", interact: "A", confirm: "A", roll: "B", cancel: "B", hide: "C", tonic: "T", pause: "II" }[action] ?? "";
  return { attack: "J", interact: "J", confirm: "J", roll: "K", cancel: "K", hide: "L", tonic: "I", pause: "ESC" }[action] ?? "";
}

export class Controls {
  constructor(scene) {
    this.scene = scene;
    this.keys = {};
    const kb = scene.input.keyboard;
    for (const [action, names] of Object.entries(KEYS)) {
      this.keys[action] = names.map((n) => kb.addKey(n, true, false));
    }
    kb.addCapture("SPACE,UP,DOWN,LEFT,RIGHT,F1");
    // Un toque rápido puede bajar y subir entre dos cuadros; el evento keydown no se pierde.
    this.taps = new Set();
    kb.on("keydown", (event) => this.taps.add(event.keyCode));
    this.prev = {};
    this.now = {};
    this.hit = {};
    this.touchSeen = { ...touch.count };
    this.locked = 0;
  }

  pad() {
    const gp = this.scene.input.gamepad;
    return gp && gp.total ? gp.getPad(0) : null;
  }

  update() {
    this.prev = this.now;
    this.now = {};
    this.hit = {};
    for (const [action, keys] of Object.entries(this.keys)) this.hit[action] = keys.some((k) => this.taps.has(k.keyCode));
    this.taps.clear();
    // Botones de la pantalla: cada escena lleva su propia cuenta de toques.
    for (const [action, n] of Object.entries(touch.count)) {
      if (n !== (this.touchSeen[action] ?? 0)) this.hit[action] = true;
    }
    this.touchSeen = { ...touch.count };
    const pad = this.pad();
    const s = touch.stick;
    for (const action of Object.keys(KEYS)) {
      let held = this.keys[action].some((k) => k.isDown) || Boolean(touch.held[action]);
      if (!held && pad && PAD[action]) held = PAD[action].some((i) => pad.buttons[i]?.pressed);
      if (!held && ["up", "down", "left", "right"].includes(action)) {
        const ax = pad ? pad.axes[0]?.getValue() ?? 0 : 0;
        const ay = pad ? pad.axes[1]?.getValue() ?? 0 : 0;
        held = (action === "left" && (ax < -0.4 || s.x < -0.5)) || (action === "right" && (ax > 0.4 || s.x > 0.5))
          || (action === "up" && (ay < -0.4 || s.y < -0.5)) || (action === "down" && (ay > 0.4 || s.y > 0.5));
      }
      this.now[action] = held;
    }
    if (this.locked > 0) this.locked -= 1;
  }

  held(action) {
    return this.locked <= 0 && Boolean(this.now[action]);
  }

  pressed(action) {
    return this.locked <= 0 && (this.hit[action] || (Boolean(this.now[action]) && !this.prev[action]));
  }

  /** Ignora la entrada unos cuadros (al cerrar un diálogo, para no atacar con la misma tecla). */
  lock(frames = 2) {
    this.locked = frames;
  }

  move() {
    let x = 0;
    let y = 0;
    if (this.held("left")) x -= 1;
    if (this.held("right")) x += 1;
    if (this.held("up")) y -= 1;
    if (this.held("down")) y += 1;
    const pad = this.pad();
    if (pad && this.locked <= 0) {
      const ax = pad.axes[0]?.getValue() ?? 0;
      const ay = pad.axes[1]?.getValue() ?? 0;
      if (Math.hypot(ax, ay) > 0.3) {
        x = ax;
        y = ay;
      }
    }
    // Palanca de la pantalla: analógica, como la del control.
    if (this.locked <= 0 && Math.hypot(touch.stick.x, touch.stick.y) > 0.2) {
      x = touch.stick.x;
      y = touch.stick.y;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }
}
