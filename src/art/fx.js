/** Efectos e íconos pequeños: golpe, polvo, chispa, burbujas, gemas, monedas, corazones. */

import { Buf, rng, strip } from "./pixel.js";
import { rgba } from "./palette.js";

/**
 * Barrido del bastón hacia la derecha (32×32, el caminante en el centro-izquierda).
 * Tres cuadros: arranque, arco completo, estela que se apaga. Se rota para las otras direcciones.
 */
export function slashSheet(palette = ["c4", "y5", "y3", "o3"]) {
  const [core, glow, trail, staff] = palette;
  const make = (f) => {
    const b = new Buf(32, 32);
    const cx = 10;
    const cy = 16;
    const spans = [[-1.35, -0.55], [-1.3, 1.25], [0.3, 1.3]];
    const [a0, a1] = spans[f];
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        if (a < a0 || a > a1) continue;
        const along = (a - a0) / (a1 - a0);
        if (r > 13 && r < 17) {
          const thick = f === 2 ? r > 14.5 && r < 16 : true;
          if (!thick) continue;
          const lead = f === 2 ? 0 : along;
          b.set(x, y, lead > 0.7 ? core : r > 15.5 ? trail : glow);
        } else if (r >= 11 && r <= 13 && f === 1 && along > 0.3) {
          b.set(x, y, rgba(glow, 140));
        }
      }
    }
    // El bastón en su ángulo final.
    if (f < 2) {
      const ang = f === 0 ? a1 : 0.25;
      for (let r = 4; r < 16; r += 0.5) {
        const x = Math.round(cx + Math.cos(ang) * r);
        const y = Math.round(cy + Math.sin(ang) * r);
        b.set(x, y, staff);
        b.set(x, y + 1, "o1");
      }
      b.set(Math.round(cx + Math.cos(ang) * 16), Math.round(cy + Math.sin(ang) * 16), "y4");
    }
    return b;
  };
  return strip([make(0), make(1), make(2)]);
}

/** Rota una tira de cuadros 90° × n. */
export function rotateSheet(sheet, turns) {
  const frames = [];
  const { buf, frameWidth: fw, frameHeight: fh, frames: n } = sheet;
  for (let i = 0; i < n; i += 1) {
    let f = new Buf(fw, fh);
    for (let y = 0; y < fh; y += 1) for (let x = 0; x < fw; x += 1) f.data[y * fw + x] = buf.data[y * buf.w + i * fw + x];
    for (let t = 0; t < turns; t += 1) f = f.rotated();
    frames.push(f);
  }
  return strip(frames);
}

export function dustSheet() {
  return strip([0, 1, 2, 3].map((f) => {
    const b = new Buf(10, 10);
    const r = 1.6 + f * 0.8;
    b.ellipse(5, 6 - f * 0.5, r, r * 0.8, f < 2 ? "c3" : "c2");
    if (f < 3) b.ellipse(4.2, 5.2 - f * 0.5, r * 0.5, r * 0.4, "c4");
    if (f === 3) for (let i = 0; i < b.data.length; i += 2) b.data[i] = 0;
    return b;
  }));
}

export function sparkSheet(color = "y5", mid = "y3") {
  return strip([0, 1, 2].map((f) => {
    const b = new Buf(13, 13);
    const len = [3, 6, 5][f];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const diag = [[1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of dirs) for (let i = 1; i <= len; i += 1) {
      if (f === 2 && i < 3) continue;
      b.set(6 + dx * i, 6 + dy * i, i < len - 1 ? color : mid);
    }
    if (f === 1) for (const [dx, dy] of diag) for (let i = 1; i <= 2; i += 1) b.set(6 + dx * i, 6 + dy * i, mid);
    if (f < 2) b.set(6, 6, "white");
    return b;
  }));
}

export function shadowBlob(w = 12, h = 5) {
  const b = new Buf(w, h);
  b.ellipse(w / 2, h / 2, w / 2, h / 2, rgba("ink", 85));
  return b;
}

function bubble(glyph, color) {
  const b = new Buf(11, 14);
  b.rect(1, 0, 9, 11, "c4");
  b.rect(0, 1, 11, 9, "c4");
  b.set(4, 11, "c4"); b.set(5, 11, "c4"); b.set(5, 12, "c4");
  b.stamp(glyph, { "#": color }, 3, 1);
  b.outline("ink");
  return b;
}

export function alertBubble() {
  return bubble(["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."].map((r) => r.slice(0, 5)), "e2");
}

export function askBubble() {
  return bubble([".###.", "#...#", "...#.", "..#..", "..#..", ".....", "..#.."], "y1");
}

export function talkBubble() {
  return bubble([".....", ".....", ".....", ".....", ".....", "#.#.#", "....."], "ink2");
}

/** Gemas 8×9 por mercancía. */
export const GEM_COLORS = {
  amber: ["r1", "r3", "r4", "y4"],
  rune: ["v1", "v2", "v4", "v5"],
  rain: ["w1", "w3", "w4", "w6"],
  sun: ["y1", "y2", "y3", "y5"],
  frost: ["n0", "n1", "n3", "n4"],
};

export function gem(good) {
  const [d, m, l, h] = GEM_COLORS[good];
  const b = new Buf(9, 10);
  b.stamp([
    "...lh....",
    "..llhm...",
    ".lllhmm..",
    "lllmmmmd.",
    ".lmmmmdd.",
    "..mmmdd..",
    "...mdd...",
    "....d....",
  ], { l, h, m, d }, 0, 1);
  b.outline("ink");
  return b;
}

export function coinSheet() {
  const widths = [6, 4, 2, 4];
  return strip(widths.map((w) => {
    const b = new Buf(9, 9);
    b.ellipse(4.5, 4.5, w / 2 + 0.5, 3.5, "y2");
    b.ellipse(4.5 - (w > 3 ? 0.6 : 0), 4.2, Math.max(0.6, w / 2 - 0.6), 2.6, "y3");
    if (w > 3) { b.set(3, 3, "y5"); b.vline(4, 3, 3, "y1"); }
    b.outline("ink");
    return b;
  }));
}

export function heartIcon(fill = 2) {
  const b = new Buf(9, 8);
  const shape = [".##.##..", "#######.", "#######.", ".#####..", "..###...", "...#....", "........"];
  shape.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "#") return;
    const on = fill === 2 || (fill === 1 && x < 4);
    b.set(x, y, on ? (y < 2 && x < 3 ? "e4" : y > 3 ? "e1" : "e2") : "ink2");
  }));
  if (fill) b.set(1, 1, "c4");
  b.outline("ink");
  return b;
}

export function grassBits() {
  return strip([0, 1].map((f) => {
    const b = new Buf(4, 4);
    if (f) b.stamp([".l.", "lm.", "m.."], { l: "g5", m: "g3" });
    else b.stamp(["l..", ".m.", "..m"], { l: "g5", m: "g4" });
    return b;
  }));
}

export function leafBits() {
  const b = new Buf(4, 3);
  b.stamp(["ll.", ".mm"], { l: "f5", m: "f3" });
  return b;
}

export function glintSheet() {
  return strip([0, 1, 2, 3].map((f) => {
    const b = new Buf(7, 5);
    if (f === 0) b.hline(2, 2, 3, "w5");
    if (f === 1) { b.hline(1, 2, 5, "w6"); b.set(3, 1, "w5"); }
    if (f === 2) b.hline(2, 2, 3, "w5");
    return b;
  }));
}

/** Pisada: dos puntitos que se borran. */
export function stepMark() {
  const b = new Buf(4, 2);
  b.set(0, 0, rgba("d1", 150)); b.set(3, 1, rgba("d1", 150));
  return b;
}

/** Destellos de hojas para el laboratorio y partículas. */
export function sparkleDot(color = "y5") {
  const b = new Buf(3, 3);
  b.set(1, 0, color); b.set(0, 1, color); b.set(1, 1, "white"); b.set(2, 1, color); b.set(1, 2, color);
  return b;
}

export function stoneBurst() {
  const r = rng(5);
  return strip([0, 1, 2].map((f) => {
    const b = new Buf(16, 16);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + r() * 0.3;
      const d = 3 + f * 2.5;
      b.set(Math.round(8 + Math.cos(a) * d), Math.round(8 + Math.sin(a) * d), f < 2 ? "y5" : "y3");
    }
    return b;
  }));
}

/** Flecha de la arquera, horizontal (se rota al disparar). */
export function arrow() {
  const b = new Buf(12, 5);
  b.hline(2, 2, 8, "o4");
  b.set(10, 2, "s5"); b.set(11, 2, "s4"); b.set(10, 1, "s3"); b.set(10, 3, "s3");
  b.set(0, 1, "c4"); b.set(1, 2, "c3"); b.set(0, 3, "c4"); b.set(1, 1, "e3"); b.set(1, 3, "e3");
  return b;
}

/** Tónico de raíz: frasco verde con tapón. */
export function tonicIcon() {
  const b = new Buf(9, 11);
  b.rect(3, 0, 3, 2, "o3");
  b.rect(3, 2, 3, 2, "c3");
  b.ellipse(4.5, 7, 4, 3.5, "g3");
  b.ellipse(3.5, 6, 1.5, 1.5, "g5");
  b.set(3, 5, "white");
  b.outline("ink");
  return b;
}
