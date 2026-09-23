/**
 * Trazado de mapas. Cada celda es una letra:
 *
 *  .  pasto          ,  flores         "  pasto alto (esconde, se corta)
 *  :  tierra         =  adoquín        _  arena        ~  agua       g  grava
 *  F  cultivo        B  puente         #  acantilado   ^  borde (se salta hacia abajo)
 *  T  bosque tupido  t  árbol suelto   P  pino         o  roca       O  peñasco
 *  b  arbusto (se corta)   f  cerca    |  cerca vertical   h  heno   r  barril   c  caja
 *  x  muro invisible sobre pasto       X  muro invisible sobre tierra
 */

import { hash } from "../art/pixel.js";

export class Grid {
  constructor(w, h, fill = ".") {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () => Array(w).fill(fill));
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x, y) {
    return this.inside(x, y) ? this.cells[y][x] : "x";
  }

  set(x, y, ch, only) {
    if (!this.inside(x, y)) return;
    if (only && !only.includes(this.cells[y][x])) return;
    this.cells[y][x] = ch;
  }

  rect(x, y, w, h, ch, only) {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.set(i, j, ch, only);
    return this;
  }

  ellipse(cx, cy, rx, ry, ch, only, seed = 0) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const wobble = seed ? (hash(x, y, seed) - 0.5) * 0.5 : 0;
        if (dx * dx + dy * dy <= 1 + wobble) this.set(x, y, ch, only);
      }
    }
    return this;
  }

  /** Camino grueso por una polilínea de puntos [x, y]. */
  road(points, width, ch = ":", only) {
    const r = width / 2;
    for (let k = 0; k < points.length - 1; k += 1) {
      const [x0, y0] = points[k];
      const [x1, y1] = points[k + 1];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const cx = x0 + (x1 - x0) * t;
        const cy = y0 + (y1 - y0) * t;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
            if (Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5) <= r) this.set(x, y, ch, only);
          }
        }
      }
    }
    return this;
  }

  /** Salpica una letra sobre celdas permitidas. */
  scatter(x, y, w, h, ch, density, seed, only = ".") {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) {
      if (hash(i, j, seed) < density) this.set(i, j, ch, only);
    }
    return this;
  }

  /** Borde de bosque con grosor irregular. */
  forestEdges(minT, maxT, seed = 1, sides = "lr") {
    for (let y = 0; y < this.h; y += 1) {
      const span = maxT - minT + 1;
      const l = minT + Math.floor(hash(0, Math.floor(y / 2), seed) * span);
      const r = minT + Math.floor(hash(1, Math.floor(y / 2), seed) * span);
      if (sides.includes("l")) for (let x = 0; x < l; x += 1) this.set(x, y, "T");
      if (sides.includes("r")) for (let x = this.w - r; x < this.w; x += 1) this.set(x, y, "T");
    }
    return this;
  }

  rows() {
    return this.cells.map((r) => r.join(""));
  }
}
