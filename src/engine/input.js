/**
 * Controles unificados: teclado y control de consola.
 * Cada acción tiene varias teclas. `held` = apretada; `pressed` = recién apretada este cuadro.
 *
 *  Mover: WASD / flechas / palanca / cruceta
 *  Atacar: J, ESPACIO (A)      Rodar/correr: K, SHIFT (B)
 *  Agacharse: L, C (X)         Hablar/usar: E (Y)
 *  Tónico: Q (LB)            Pausa: ESC, ENTER (Start)
 */

const KEYS = {
  up: ["W", "UP"],
  down: ["S", "DOWN"],
  left: ["A", "LEFT"],
  right: ["D", "RIGHT"],
  attack: ["J", "SPACE"],
  roll: ["K", "SHIFT"],
  hide: ["L", "C"],
  interact: ["E"],
  tonic: ["Q"],
  pause: ["ESC", "ENTER"],
  confirm: ["E", "ENTER", "SPACE", "J"],
  cancel: ["ESC", "K", "Q", "BACKSPACE"],
  debug: ["F1"],
};

const PAD = {
  attack: [0], roll: [1], hide: [2], interact: [3], pause: [9], tonic: [4],
  confirm: [0, 3], cancel: [1],
  up: [12], down: [13], left: [14], right: [15],
};

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
    const pad = this.pad();
    for (const action of Object.keys(KEYS)) {
      let held = this.keys[action].some((k) => k.isDown);
      if (!held && pad && PAD[action]) held = PAD[action].some((i) => pad.buttons[i]?.pressed);
      if (!held && pad && ["up", "down", "left", "right"].includes(action)) {
        const ax = pad.axes[0]?.getValue() ?? 0;
        const ay = pad.axes[1]?.getValue() ?? 0;
        held = (action === "left" && ax < -0.4) || (action === "right" && ax > 0.4)
          || (action === "up" && ay < -0.4) || (action === "down" && ay > 0.4);
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
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }
}
