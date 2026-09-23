/**
 * Suelo de un mapa entero, pintado píxel por píxel.
 * La rejilla de 16 px decide el terreno; un ruido suave deforma los bordes para que
 * no se vean cuadritos. Adoquín, puente, campo y acantilado se quedan rectos.
 */

import { Buf, bayer, hash, smoothNoise } from "./pixel.js";
import { rgba } from "./palette.js";

export const TILE = 16;

export const T = {
  GRASS: 1, DIRT: 2, COBBLE: 3, WATER: 4, SAND: 5, FIELD: 6, BRIDGE: 7, CLIFF: 8, FOREST: 9, GRAVEL: 10,
};

const CRISP = new Set([T.COBBLE, T.BRIDGE, T.FIELD, T.CLIFF]);
// Altura aparente: el terreno más alto proyecta sombra sobre el más bajo.
const HEIGHT = { [T.WATER]: 0, [T.SAND]: 1, [T.DIRT]: 2, [T.FIELD]: 2, [T.COBBLE]: 2, [T.GRAVEL]: 2, [T.BRIDGE]: 3, [T.GRASS]: 3, [T.FOREST]: 3, [T.CLIFF]: 4 };

const BIOME_GRASS = {
  temperate: { g0: "g1", g1: "g2", g2: "g3", g3: "g4", g4: "g5", g5: "g6" },
  mountain: { g0: "f1", g1: "f2", g2: "f3", g3: "f4", g4: "f5", g5: "f6" },
};

const c = (n) => rgba(n);

/** Pinta el suelo. `grid[y][x]` es un número de T. Devuelve el Buf y el terreno por píxel. */
export function paintGround(grid, { biome = "temperate", seed = 7, crispCobble = true } = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const W = cols * TILE;
  const H = rows * TILE;
  const cellAt = (cx, cy) => grid[Math.max(0, Math.min(rows - 1, cy))][Math.max(0, Math.min(cols - 1, cx))];
  // En las rutas la calzada sigue la curva del camino; en los pueblos la plaza es recta.
  const crisp = new Set(CRISP);
  if (!crispCobble) crisp.delete(T.COBBLE);

  // 1) Terreno por píxel con bordes deformados.
  const ter = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const base = cellAt(Math.floor(x / TILE), Math.floor(y / TILE));
      const wx = x + (smoothNoise(x, y, 9, seed) - 0.5) * 9;
      const wy = y + (smoothNoise(x, y, 9, seed + 31) - 0.5) * 9;
      const warped = cellAt(Math.floor(wx / TILE), Math.floor(wy / TILE));
      ter[y * W + x] = crisp.has(base) || crisp.has(warped) ? base : warped;
    }
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? ter[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))] : ter[y * W + x]);

  // 2) Distancia a tierra dentro del agua (para orilla, espuma y fondo).
  const waterDist = new Float32Array(W * H).fill(0);
  for (let i = 0; i < ter.length; i += 1) waterDist[i] = ter[i] === T.WATER ? 99 : 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    if (!waterDist[i]) continue;
    const up = y ? waterDist[i - W] + 1 : 99;
    const left = x ? waterDist[i - 1] + 1 : 99;
    waterDist[i] = Math.min(waterDist[i], up, left);
  }
  for (let y = H - 1; y >= 0; y -= 1) for (let x = W - 1; x >= 0; x -= 1) {
    const i = y * W + x;
    if (!waterDist[i]) continue;
    const down = y < H - 1 ? waterDist[i + W] + 1 : 99;
    const right = x < W - 1 ? waterDist[i + 1] + 1 : 99;
    waterDist[i] = Math.min(waterDist[i], down, right);
  }

  const buf = new Buf(W, H);
  const gp = BIOME_GRASS[biome] ?? BIOME_GRASS.temperate;

  // 3) Color base de cada píxel.
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = ter[y * W + x];
      buf.data[y * W + x] = baseColor(t, x, y, seed, gp, waterDist[y * W + x], at);
    }
  }

  // 4) Bordes: sombra del terreno alto sobre el bajo, luz en el canto.
  const out = buf.data.slice();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = at(x, y);
      if (t === T.WATER || t === T.CLIFF) continue;
      const up = at(x, y - 1);
      const up2 = at(x, y - 2);
      const down = at(x, y + 1);
      const left = at(x - 1, y);
      const right = at(x + 1, y);
      const i = y * W + x;
      if (t === T.COBBLE) {
        const edge = [up, down, left, right].some((n) => n !== T.COBBLE);
        if (edge) out[i] = c(down !== T.COBBLE || right !== T.COBBLE ? "s1" : "s5");
        else if ([at(x, y - 2), at(x, y + 2), at(x - 2, y), at(x + 2, y)].some((n) => n !== T.COBBLE)) out[i] = c("s3");
        continue;
      }
      if (HEIGHT[up] > HEIGHT[t] && up !== T.CLIFF) {
        out[i] = shadowOf(t, gp, 2);
      } else if (HEIGHT[up2] > HEIGHT[t] && up2 !== T.CLIFF && bayer(x, y) < 0.5) {
        out[i] = shadowOf(t, gp, 1);
      } else if (HEIGHT[left] > HEIGHT[t] && left !== T.CLIFF && bayer(x, y) < 0.5) {
        out[i] = shadowOf(t, gp, 1);
      }
      // Canto iluminado del pasto que da a algo más bajo, con hojitas colgando.
      if ((t === T.GRASS || t === T.FOREST) && HEIGHT[down] < HEIGHT[t]) {
        out[i] = c(t === T.FOREST ? gp.g2 : gp.g4);
        if (hash(x, y, seed + 5) < 0.35) {
          const j = (y + 1) * W + x;
          if (y + 1 < H) out[j] = c(gp.g3);
        }
      }
      if (t === T.SAND && [up, down, left, right].includes(T.WATER)) out[i] = c("d4");
    }
  }
  buf.data.set(out);

  // 5) Adornos sueltos: matas, flores, piedritas.
  decorate(buf, ter, W, H, seed, gp);
  return { buf, ter, W, H };
}

function shadowOf(t, gp, amount) {
  if (t === T.DIRT || t === T.FIELD) return c(amount > 1 ? "d1" : "d2");
  if (t === T.SAND) return c(amount > 1 ? "d3" : "d4");
  if (t === T.GRAVEL) return c(amount > 1 ? "s1" : "s2");
  if (t === T.BRIDGE) return c("o1");
  if (t === T.FOREST) return c(gp.g0);
  return c(amount > 1 ? gp.g0 : gp.g1);
}

function patch(x, y, cell, seed, lo, hi) {
  // Manchas grandes con borde tramado: da textura sin ruido de sal y pimienta.
  const n = smoothNoise(x, y, cell, seed);
  const d = bayer(x, y) * 0.12;
  if (n + d > hi) return 1;
  if (n - d < lo) return -1;
  return 0;
}

function baseColor(t, x, y, seed, gp, wd, at) {
  switch (t) {
    case T.GRASS: {
      const p = patch(x, y, 30, seed + 3, 0.24, 0.72);
      return c(p > 0 ? gp.g3 : p < 0 ? gp.g1 : gp.g2);
    }
    case T.FOREST: {
      const p = patch(x, y, 14, seed + 9, 0.35, 0.72);
      return c(p > 0 ? gp.g1 : p < 0 ? gp.g0 : "f1");
    }
    case T.DIRT: {
      const p = patch(x, y, 11, seed + 11, 0.13, 0.8);
      return c(p > 0 ? "d4" : p < 0 ? "d2" : "d3");
    }
    case T.SAND: {
      const p = patch(x, y, 16, seed + 13, 0.3, 0.75);
      return c(p > 0 ? "d6" : p < 0 ? "d4" : "d5");
    }
    case T.GRAVEL: {
      const p = patch(x, y, 10, seed + 17, 0.3, 0.72);
      return c(p > 0 ? "s4" : p < 0 ? "s2" : "s3");
    }
    case T.FIELD: {
      const r = y % 5;
      if (r === 0) return c("d1");
      if (r === 1) return c("d2");
      const sprout = (x + Math.floor(y / 5) * 3) % 6;
      if (r === 2 && sprout === 2) return c(gp.g4);
      if (r === 3 && (sprout === 1 || sprout === 2 || sprout === 3)) return c(sprout === 2 ? gp.g3 : gp.g2);
      return c(r === 2 ? "d4" : "d3");
    }
    case T.BRIDGE: {
      if (y % 5 === 4) return c("o1");
      const grain = hash(Math.floor(x / 3), Math.floor(y / 5), seed) < 0.2;
      if (y % 5 === 0) return c("o5");
      return c(grain ? "o3" : "o4");
    }
    case T.COBBLE:
      return cobble(x, y, seed);
    case T.CLIFF:
      return cliff(x, y, seed, at, gp);
    case T.WATER:
    default:
      return water(x, y, seed, wd);
  }
}

function cobble(x, y, seed) {
  const rowH = 6;
  const row = Math.floor(y / rowH);
  const ly = y % rowH;
  const offset = Math.floor(hash(row, 0, seed + 21) * 6) + (row % 2) * 4;
  const wBase = 7;
  const col = Math.floor((x + offset) / wBase);
  const lx = (x + offset) % wBase;
  const tone = hash(col, row, seed + 23);
  if (ly === 0 || lx === 0) return c(tone < 0.1 ? "g2" : "s1");
  if (ly === 1 || lx === 1) return c(tone > 0.7 ? "s5" : "s4");
  if (ly === rowH - 1 || lx === wBase - 1) return c("s2");
  if (tone > 0.85) return c("d4");
  return c(tone > 0.45 ? "s3" : "s4");
}

function water(x, y, seed, wd) {
  if (wd <= 1) return c(hash(x, y >> 1, seed) < 0.75 ? "w6" : "w5");
  if (wd <= 2) return c(bayer(x, y) < 0.6 ? "w5" : "w4");
  if (wd <= 5) return c(bayer(x, y) < (5 - wd) / 3 ? "w4" : "w3");
  const deep = wd > 14 ? 1 : wd > 9 ? 0.5 : 0;
  // Brillos horizontales sueltos.
  const glint = hash(Math.floor(x / 5), y, seed + 41) < 0.018;
  if (glint) return c("w4");
  if (deep && bayer(x, y) < deep) return c("w1");
  return c(patch(x, y, 18, seed + 43, 0.25, 0.8) > 0 ? "w3" : "w2");
}

function cliff(x, y, seed, at, gp) {
  // Cara de roca: estratos verticales, grieta oscura, labio de pasto arriba.
  let top = 0;
  while (top < 40 && at(x, y - top - 1) === T.CLIFF) top += 1;
  let bottom = 0;
  while (bottom < 40 && at(x, y + bottom + 1) === T.CLIFF) bottom += 1;
  if (top === 0) return c(gp.g4);
  if (top === 1) return c(hash(x, y, seed) < 0.5 ? gp.g2 : "s4");
  if (top === 2 && hash(x, 0, seed + 3) < 0.4) return c(gp.g1);
  if (bottom === 0) return c("s0");
  if (bottom === 1) return c(bayer(x, y) < 0.5 ? "s0" : "s1");
  // Peñas apiladas: filas de alto variable, bloques irregulares con esquinas gastadas.
  const yy = y - 2 + Math.floor(hash(Math.floor(x / 11), 7, seed) * 4);
  const rowH = 7 + Math.floor(hash(Math.floor(yy / 9), 5, seed) * 3);
  const row = Math.floor(yy / rowH);
  const ly = ((yy % rowH) + rowH) % rowH;
  let bx = -Math.floor(hash(row, 3, seed) * 12);
  let w = 0;
  let k = 0;
  while (true) {
    w = 6 + Math.floor(hash(row, k, seed + 53) * 10);
    if (bx + w > x) break;
    bx += w;
    k += 1;
  }
  const lx = x - bx;
  const tone = hash(row, k, seed + 55);
  const corner = (lx < 2 || lx > w - 3) && (ly < 1 || ly > rowH - 2);
  if (corner) return c("s1");
  if (ly === 0 || lx === 0) return c(tone > 0.5 ? "s1" : "s0");
  if (ly === rowH - 1 || lx === w - 1) return c("s1");
  if (ly === 1 || lx === 1) return c(tone > 0.5 ? "s5" : "s4");
  if (lx / w + ly / rowH > 1.1 && bayer(x, y) < 0.75) return c("s2");
  if (tone < 0.1 && ly < 3) return c(gp.g2);
  if (hash(x, y, seed + 57) < 0.04) return c("s2");
  return c(tone > 0.7 ? "s4" : tone < 0.3 ? "s2" : "s3");
}

const TUFTS = [
  ["l.l", "lml", ".s."],
  [".l.", "lml", "s.s"],
  ["l..l", ".ml.", ".ss."],
  ["..l", "l.m", "mss"],
];

const FLOWERS = [
  { rows: [".p.", "pyp", ".p."], petal: "c4" },
  { rows: [".p.", "pyp", ".p."], petal: "e4" },
  { rows: [".p.", "pyp", ".p."], petal: "v4" },
  { rows: ["p.p", ".y.", "p.p"], petal: "y4" },
];

function decorate(buf, ter, W, H, seed, gp) {
  const terAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : ter[y * W + x]);
  const allGrass = (x, y, w, h, t) => {
    for (let j = -1; j <= h; j += 1) for (let i = -1; i <= w; i += 1) if (terAt(x + i, y + j) !== t) return false;
    return true;
  };
  for (let gy = 0; gy < H; gy += 6) {
    for (let gx = 0; gx < W; gx += 7) {
      const r = hash(gx, gy, seed + 61);
      const x = gx + Math.floor(hash(gx, gy, seed + 62) * 5);
      const y = gy + Math.floor(hash(gx, gy, seed + 63) * 4);
      const t = terAt(x, y);
      if (t === T.GRASS && r < 0.42 && allGrass(x, y, 4, 3, T.GRASS)) {
        const tuft = TUFTS[Math.floor(hash(gx, gy, seed + 64) * TUFTS.length)];
        buf.stamp(tuft, { l: gp.g4, m: gp.g3, s: gp.g1 }, x, y);
      } else if (t === T.GRASS && r > 0.975 && allGrass(x, y, 3, 3, T.GRASS)) {
        const f = FLOWERS[Math.floor(hash(gx, gy, seed + 65) * FLOWERS.length)];
        buf.stamp(f.rows, { p: f.petal, y: "y3" }, x, y);
      } else if (t === T.FOREST && r < 0.3 && allGrass(x, y, 4, 3, T.FOREST)) {
        buf.stamp(TUFTS[1], { l: gp.g2, m: gp.g1, s: gp.g0 }, x, y);
      } else if ((t === T.DIRT || t === T.GRAVEL) && r < 0.2 && allGrass(x, y, 2, 2, t)) {
        const light = t === T.DIRT ? "d5" : "s5";
        const dark = t === T.DIRT ? "d1" : "s1";
        buf.stamp(["lm", "md"], { l: light, m: t === T.DIRT ? "d4" : "s4", d: dark }, x, y);
      } else if (t === T.SAND && r < 0.08 && allGrass(x, y, 2, 2, T.SAND)) {
        buf.stamp(["l.", ".d"], { l: "c4", d: "d3" }, x, y);
      }
    }
  }
}

/** Flores densas en celdas marcadas (se llama aparte con la lista de celdas). */
export function paintFlowerBeds(buf, cells, seed = 3) {
  for (const [cx, cy] of cells) {
    for (let k = 0; k < 3; k += 1) {
      const x = cx * TILE + 1 + Math.floor(hash(cx, cy * 7 + k, seed) * 12);
      const y = cy * TILE + 1 + Math.floor(hash(cx * 5 + k, cy, seed) * 12);
      const f = FLOWERS[Math.floor(hash(cx + k, cy, seed + 1) * FLOWERS.length)];
      buf.stamp(f.rows, { p: f.petal, y: "y3" }, x, y);
    }
  }
}
