/** Piezas de interfaz: marcos 9-slice, íconos del HUD, teclas, mapa del mundo y logo. */

import { Buf, bayer, hash, smoothNoise } from "./pixel.js";
import { rgba } from "./palette.js";
import { FONT_VARIANTS } from "./font.js";

/** Marco oscuro con filo dorado (menús, HUD). 16×16, esquinas de 5. */
export function panelDark() {
  const b = new Buf(16, 16);
  b.rect(1, 1, 14, 14, rgba("ink2", 235));
  b.rect(0, 1, 1, 14, "ink"); b.rect(15, 1, 1, 14, "ink");
  b.rect(1, 0, 14, 1, "ink"); b.rect(1, 15, 14, 1, "ink");
  b.rect(2, 1, 12, 1, "y2"); b.rect(2, 14, 12, 1, "y1");
  b.rect(1, 2, 1, 12, "y2"); b.rect(14, 2, 1, 12, "y1");
  b.set(1, 1, "y3"); b.set(14, 1, "y2"); b.set(1, 14, "y2"); b.set(14, 14, "y1");
  b.rect(2, 2, 12, 1, rgba("ink", 200));
  return b;
}

/** Pergamino para diálogos. */
export function panelPaper() {
  const b = new Buf(16, 16);
  for (let y = 1; y < 15; y += 1) for (let x = 1; x < 15; x += 1) b.set(x, y, bayer(x, y) < 0.15 ? "c2" : "c3");
  b.rect(0, 2, 1, 12, "o1"); b.rect(15, 2, 1, 12, "o1");
  b.rect(2, 0, 12, 1, "o1"); b.rect(2, 15, 12, 1, "o1");
  b.set(1, 1, "o1"); b.set(14, 1, "o1"); b.set(1, 14, "o1"); b.set(14, 14, "o1");
  b.rect(2, 1, 12, 1, "c4"); b.rect(1, 2, 1, 11, "c4");
  b.rect(2, 14, 12, 1, "c1"); b.rect(14, 2, 1, 12, "c1");
  return b;
}

/** Placa pequeña para nombres y avisos (oscura, sin filo dorado). */
export function panelTag() {
  const b = new Buf(8, 8);
  b.rect(1, 0, 6, 8, rgba("ink", 220));
  b.rect(0, 1, 8, 6, rgba("ink", 220));
  b.rect(1, 1, 6, 6, rgba("ink2", 230));
  return b;
}

export function slotIcon(hidden = false) {
  const b = new Buf(12, 12);
  b.rect(1, 1, 10, 10, rgba("ink", 200));
  b.rect(0, 1, 1, 10, "s2"); b.rect(11, 1, 1, 10, "s1");
  b.rect(1, 0, 10, 1, "s2"); b.rect(1, 11, 10, 1, "s1");
  if (hidden) for (let y = 2; y < 10; y += 1) for (let x = 2; x < 10; x += 1) if ((x + y) % 3 === 0) b.set(x, y, "o2");
  return b;
}

export function eyeIcon(level = 0) {
  const b = new Buf(13, 9);
  const col = level >= 3 ? "e3" : level >= 2 ? "y3" : level >= 1 ? "c3" : "s4";
  b.stamp([
    "...#######...",
    "..#.......#..",
    ".#...ppp...#.",
    "#...ppipp...#",
    ".#...ppp...#.",
    "..#.......#..",
    "...#######...",
  ], { "#": col, p: level >= 2 ? "e1" : "ink2", i: "white" }, 0, 1);
  b.outline("ink");
  return b;
}

export function starIcon(on = true) {
  const b = new Buf(9, 9);
  b.stamp(["....#....", "...###...", "#########", ".#######.", "..#####..", ".###.###.", ".##...##."], { "#": on ? "y3" : "s2" }, 0, 1);
  if (on) { b.set(4, 2, "y5"); b.set(3, 4, "y5"); }
  b.outline("ink");
  return b;
}

export function pipIcon(on) {
  const b = new Buf(5, 5);
  b.rect(0, 0, 5, 5, "ink");
  b.rect(1, 1, 3, 3, on ? "e3" : "s1");
  if (on) b.set(1, 1, "e4");
  return b;
}

/** Flecha del tutorial: apunta abajo, oro con borde oscuro. 13×10. Se gira de 90 en 90. */
export function guideArrow() {
  const b = new Buf(13, 10);
  b.stamp([
    "..#######..",
    "..#######..",
    "###########",
    ".#########.",
    "..#######..",
    "...#####...",
    "....###....",
    ".....#.....",
  ], { "#": "y3" }, 1, 1);
  b.hline(4, 1, 5, "y5");
  b.hline(2, 3, 3, "y4");
  b.rect(9, 4, 2, 1, "y1");
  b.rect(8, 5, 2, 1, "y1");
  b.outline("ink");
  return b;
}

export function keycap(wide = false) {
  const w = wide ? 21 : 11;
  const b = new Buf(w, 12);
  b.rect(1, 0, w - 2, 11, "c3");
  b.rect(0, 1, w, 9, "c3");
  b.rect(1, 9, w - 2, 2, "c1");
  b.hline(1, 11, w - 2, "ink");
  b.set(0, 10, "ink"); b.set(w - 1, 10, "ink");
  b.rect(1, 1, w - 2, 1, "c4");
  return b;
}

/**
 * Mapa del mundo en pergamino. Golfo al sur, cinco regiones, ruta dibujada.
 * Las posiciones de los pueblos se exportan para que la pausa ponga marcas encima.
 */
export const WORLD_MAP = { w: 220, h: 128 };
export const WORLD_PINS = {
  ashfen: [36, 86],
  valkeep: [64, 38],
  verdelume: [116, 26],
  duneshade: [168, 42],
  mossgrove: [198, 64],
  frostholm: [186, 90],
};
export const WORLD_ROADS = [["ashfen", "valkeep"], ["valkeep", "verdelume"], ["verdelume", "duneshade"], ["duneshade", "mossgrove"], ["mossgrove", "frostholm"]];

export function worldMap() {
  const { w, h } = WORLD_MAP;
  const b = new Buf(w, h);
  const gulf = (x, y) => {
    const dx = (x - 110) / 70;
    const dy = (y - 150) / 70;
    return dx * dx + dy * dy < 1 + (smoothNoise(x, y, 9, 3) - 0.5) * 0.35;
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const n = smoothNoise(x, y, 12, 1);
      let col = n > 0.78 && bayer(x, y) < 0.2 ? "c2" : "c3";
      if (gulf(x, y)) col = bayer(x, y) < 0.35 ? "w4" : "w5";
      else if (gulf(x, y + 2) || gulf(x + 2, y) || gulf(x - 2, y)) col = "c1";
      // Regiones tintadas
      const region = [
        [70, 34, "f5"], [115, 22, "g5"], [170, 40, "d5"], [190, 92, "n3"], [36, 86, "g6"], [200, 64, "f4"],
      ];
      for (const [rx, ry, rc] of region) {
        const d = Math.hypot(x - rx, y - ry);
        if (!gulf(x, y) && d < 24 && bayer(x, y) < (1 - d / 24) * 0.6) col = rc;
      }
      b.set(x, y, col);
    }
  }
  // Montañas (picos) al noroeste y bosque al norte
  const peak = (px, py) => {
    for (let i = 0; i < 6; i += 1) { b.set(px - i, py + i, "o2"); b.set(px + i, py + i, "o1"); }
    b.set(px, py, "c4"); b.set(px - 1, py + 1, "c4");
  };
  [[20, 40], [30, 30], [44, 44], [52, 20], [80, 14], [90, 30]].forEach(([x, y]) => peak(x, y));
  const tree = (px, py) => { b.set(px, py, "f3"); b.hline(px - 1, py + 1, 3, "f3"); b.set(px, py + 2, "o2"); };
  for (let i = 0; i < 22; i += 1) tree(100 + Math.floor(hash(i, 1, 4) * 36), 10 + Math.floor(hash(i, 2, 4) * 30));
  // Bosque de Mossgrove, entre el desierto y la nieve.
  for (let i = 0; i < 12; i += 1) tree(188 + Math.floor(hash(i, 7, 4) * 24), 54 + Math.floor(hash(i, 8, 4) * 18));
  // Dunas
  for (let i = 0; i < 8; i += 1) {
    const x = 150 + Math.floor(hash(i, 3, 5) * 40);
    const y = 30 + Math.floor(hash(i, 4, 5) * 26);
    b.hline(x, y, 5, "d3"); b.hline(x + 1, y - 1, 3, "d3");
  }
  // Borde
  for (let x = 0; x < w; x += 1) { b.set(x, 0, "o1"); b.set(x, h - 1, "o1"); b.set(x, 1, "c1"); }
  for (let y = 0; y < h; y += 1) { b.set(0, y, "o1"); b.set(w - 1, y, "o1"); b.set(1, y, "c1"); }
  // Rosa de los vientos
  b.vline(206, 106, 12, "o2"); b.hline(200, 112, 13, "o2"); b.set(206, 104, "e2");
  return b;
}

/** Logo STONES: letras gruesas en piedra, con filo dorado y sombra. */
const LOGO = {
  S: ["#####", "#....", "#####", "....#", "#####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
  O: ["#####", "#...#", "#...#", "#...#", "#####"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
  E: ["#####", "#....", "####.", "#....", "#####"],
};

export function logo() {
  const scale = 5;
  const word = "STONES";
  const gap = 2;
  const w = word.length * (5 * scale + gap * scale) + 8;
  const h = 5 * scale + 10;
  const b = new Buf(w, h);
  const mask = new Uint8Array(w * h);
  [...word].forEach((ch, i) => {
    LOGO[ch].forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== "#") return;
      for (let j = 0; j < scale; j += 1) for (let k = 0; k < scale; k += 1) {
        const px = 4 + i * (5 + gap) * scale + x * scale + k;
        const py = 3 + y * scale + j;
        mask[py * w + px] = 1;
      }
    }));
  });
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  // Sombra
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (on(x - 2, y - 3) && !on(x, y)) b.set(x, y, "ink");
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!on(x, y)) continue;
      const edgeTop = !on(x, y - 1);
      const edgeLeft = !on(x - 1, y);
      const edgeBottom = !on(x, y + 1);
      const edgeRight = !on(x + 1, y);
      let col = hash(x >> 1, y >> 1, 3) < 0.25 ? "s4" : "s3";
      if (y > 3 + scale * 3) col = hash(x >> 1, y >> 1, 3) < 0.25 ? "s3" : "s2";
      if (edgeTop || edgeLeft) col = "y4";
      if (edgeBottom || edgeRight) col = "y1";
      if (!edgeTop && on(x, y - 1) && !on(x, y - 2)) col = "s5";
      b.set(x, y, col);
    }
  }
  b.outline("ink");
  return b;
}

export { FONT_VARIANTS };
