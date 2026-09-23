/**
 * Lienzo de píxeles. Todo el arte se dibuja aquí, píxel por píxel, y luego
 * se sube a Phaser como textura. Nada de antialias ni de formas vectoriales.
 */

import { rgba } from "./palette.js";

/** Generador determinista (mulberry32). Mismo seed → mismo dibujo. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido por celda, estable: hash(x, y, seed) ∈ [0, 1). */
export function hash(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruido suave por valor (bilineal sobre una rejilla de `cell` píxeles). */
export function smoothNoise(x, y, cell, seed = 0) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Matriz de Bayer 4×4 para tramas ordenadas (dither). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x, y) {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

export class Buf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, color) {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y) || color == null) return;
    this.data[y * this.w + x] = typeof color === "number" ? color : rgba(color);
  }

  get(x, y) {
    x |= 0;
    y |= 0;
    return this.inside(x, y) ? this.data[y * this.w + x] : 0;
  }

  alpha(x, y) {
    return this.get(x, y) >>> 24;
  }

  rect(x, y, w, h, color) {
    const c = typeof color === "number" ? color : rgba(color);
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j, c);
  }

  hline(x, y, w, color) {
    this.rect(x, y, w, 1, color);
  }

  vline(x, y, h, color) {
    this.rect(x, y, 1, h, color);
  }

  /** Elipse rellena, bordes a píxel. */
  ellipse(cx, cy, rx, ry, color) {
    const c = typeof color === "number" ? color : rgba(color);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  /** Dibuja un mapa de caracteres. `map` traduce cada letra a un color de paleta. */
  stamp(rows, map, ox = 0, oy = 0, { flip = false } = {}) {
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        const color = map[ch];
        if (color === undefined) throw new Error(`Letra sin color: "${ch}" en ${JSON.stringify(row)}`);
        if (color === null) continue;
        this.set(ox + (flip ? width - 1 - x : x), oy + y, color);
      }
    });
  }

  /** Copia otro Buf encima (respeta transparencia). */
  blit(src, ox = 0, oy = 0, { flip = false } = {}) {
    for (let y = 0; y < src.h; y += 1) {
      for (let x = 0; x < src.w; x += 1) {
        const c = src.data[y * src.w + x];
        if (c >>> 24) this.set(ox + (flip ? src.w - 1 - x : x), oy + y, c);
      }
    }
  }

  /** Contorno de 1 px alrededor de lo opaco. `sides` limita a qué lados. */
  outline(color, { diagonal = false } = {}) {
    const c = typeof color === "number" ? color : rgba(color);
    const src = this.data.slice();
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] >>> 24 : 0);
    const dirs = diagonal
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (at(x, y)) continue;
        if (dirs.some(([dx, dy]) => at(x + dx, y + dy))) this.data[y * this.w + x] = c;
      }
    }
    return this;
  }

  /** Cambia colores: {from: to}. Sirve para variantes de paleta. */
  swap(pairs) {
    const table = new Map(Object.entries(pairs).map(([a, b]) => [rgba(a), b == null ? 0 : rgba(b)]));
    for (let i = 0; i < this.data.length; i += 1) {
      const next = table.get(this.data[i]);
      if (next !== undefined) this.data[i] = next;
    }
    return this;
  }

  clone() {
    const out = new Buf(this.w, this.h);
    out.data.set(this.data);
    return out;
  }

  flipped() {
    const out = new Buf(this.w, this.h);
    out.blit(this, 0, 0, { flip: true });
    return out;
  }

  /** Rotación exacta de 90° en sentido horario (sin pérdida). */
  rotated() {
    const out = new Buf(this.h, this.w);
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) out.data[x * out.w + (this.h - 1 - y)] = this.data[y * this.w + x];
    }
    return out;
  }

  toCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(this.w, this.h);
    new Uint32Array(image.data.buffer).set(this.data);
    ctx.putImageData(image, 0, 0);
    return canvas;
  }
}

/** Estira un marco de 9 partes (esquinas de `c` px) a w×h repitiendo bordes y centro. */
export function ninePatch(src, w, h, c = 5) {
  const out = new Buf(w, h);
  const mapAxis = (v, size, srcSize) => {
    if (v < c) return v;
    if (v >= size - c) return srcSize - (size - v);
    return c + ((v - c) % (srcSize - c * 2));
  };
  for (let y = 0; y < h; y += 1) {
    const sy = mapAxis(y, h, src.h);
    for (let x = 0; x < w; x += 1) out.data[y * w + x] = src.data[sy * src.w + mapAxis(x, w, src.w)];
  }
  return out;
}

/** Tira de cuadros: pega Bufs de igual tamaño en una fila. */
export function strip(frames) {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const out = new Buf(fw * frames.length, fh);
  frames.forEach((f, i) => out.blit(f, i * fw, 0));
  return { buf: out, frameWidth: fw, frameHeight: fh, frames: frames.length };
}

/** Atajo: sprite desde filas de texto. */
export function sprite(rows, map, w, h) {
  const width = w ?? rows.reduce((m, r) => Math.max(m, r.length), 0);
  const buf = new Buf(width, h ?? rows.length);
  buf.stamp(rows, map);
  return buf;
}
