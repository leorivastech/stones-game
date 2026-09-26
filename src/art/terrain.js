/**
 * Suelo de un mapa entero, pintado píxel por píxel.
 * La rejilla de 16 px decide el terreno; un ruido suave deforma los bordes para que
 * no se vean cuadritos. Adoquín, puente, campo y acantilado se quedan rectos.
 */

import { Buf, bayer, hash, smoothNoise } from "./pixel.js";
import { rgba } from "./palette.js";

export const TILE = 16;

export const T = {
  GRASS: 1, DIRT: 2, COBBLE: 3, WATER: 4, SAND: 5, FIELD: 6, BRIDGE: 7, CLIFF: 8, FOREST: 9, GRAVEL: 10, SNOW: 11, ICE: 12,
};

const CRISP = new Set([T.COBBLE, T.BRIDGE, T.FIELD, T.CLIFF]);
// Altura aparente: el terreno más alto proyecta sombra sobre el más bajo.
const HEIGHT = { [T.WATER]: 0, [T.SAND]: 1, [T.DIRT]: 2, [T.FIELD]: 2, [T.COBBLE]: 2, [T.GRAVEL]: 2, [T.BRIDGE]: 3, [T.GRASS]: 3, [T.FOREST]: 3, [T.CLIFF]: 4, [T.SNOW]: 3, [T.ICE]: 1 };

const BIOME_GRASS = {
  temperate: { name: "temperate", g0: "g1", g1: "g2", g2: "g3", g3: "g4", g4: "g5", g5: "g6" },
  mountain: { name: "mountain", g0: "f1", g1: "f2", g2: "f3", g3: "f4", g4: "f5", g5: "f6" },
  // Selva: verde hondo y saturado.
  tropical: { name: "tropical", g0: "f0", g1: "g1", g2: "g2", g3: "g3", g4: "g4", g5: "g5" },
  // Desierto: matorral seco, olivo y paja.
  desert: { name: "desert", g0: "l0", g1: "l1", g2: "l2", g3: "l3", g4: "l4", g5: "t4" },
  // Nieve: el pasto asoma escarchado.
  snow: { name: "snow", g0: "f1", g1: "n0", g2: "n1", g3: "n2", g4: "n3", g5: "n4" },
};

/**
 * Plaza (adoquín) de cada pueblo. Cada estilo pinta sus piedras y su bordillo:
 * `curb` = [sombra (abajo/derecha), luz (arriba/izquierda), anillo interior].
 * Sin estilo, el bioma elige: templado → warm, montaña → mountain, selva → planks, desierto → mud, nieve → frost.
 */
const PLAZA_BY_BIOME = { temperate: "warm", mountain: "mountain", tropical: "planks", desert: "mud", snow: "frost" };
const CURB = {
  road: ["s1", "s5", "s3"],
  warm: ["d1", "c3", "d3"],
  mountain: ["s0", "s4", "s1"],
  planks: ["o0", "o3", "o1"],
  mud: ["d2", "d6", "d3"],
  frost: ["s2", "n4", "s3"],
  moss: ["s1", "s4", "g2"],
};

const c = (n) => rgba(n);

/** Pinta el suelo. `grid[y][x]` es un número de T. Devuelve el Buf y el terreno por píxel. */
export function paintGround(grid, { biome = "temperate", seed = 7, crispCobble = true, biomeAt = null, plaza = null } = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const W = cols * TILE;
  const H = rows * TILE;
  const cellAt = (cx, cy) => grid[Math.max(0, Math.min(rows - 1, cy))][Math.max(0, Math.min(cols - 1, cx))];
  // En las rutas la calzada sigue la curva del camino; en los pueblos la plaza es recta.
  const crisp = new Set(CRISP);
  if (!crispCobble) crisp.delete(T.COBBLE);

  // Bioma por celda (rutas mixtas) y su paleta de pasto.
  const fallback = BIOME_GRASS[biome] ?? BIOME_GRASS.temperate;
  const PALS = [fallback];
  const cellBiome = biomeAt
    ? Array.from({ length: rows }, (_, cy) => Array.from({ length: cols }, (_, cx) => {
      const gp = BIOME_GRASS[biomeAt(cx, cy)] ?? fallback;
      if (!PALS.includes(gp)) PALS.push(gp);
      return PALS.indexOf(gp);
    }))
    : null;
  const biomeCell = (cx, cy) => cellBiome[Math.max(0, Math.min(rows - 1, cy))][Math.max(0, Math.min(cols - 1, cx))];
  // Suelos que cambian con el bioma: en la frontera se funden con la misma onda que la paleta.
  const SOFT = new Set([T.GRASS, T.SAND, T.SNOW]);

  // 1) Terreno por píxel con bordes deformados.
  //    En rutas mixtas, además, la paleta de pasto se elige con una onda más larga (la frontera de
  //    bioma no cae en el borde del cuadro) y una trama Bayer de ~8 px entre las dos paletas.
  const ter = new Uint8Array(W * H);
  const gpIdx = cellBiome && PALS.length > 1 ? new Uint8Array(W * H) : null;
  // Sólo cerca de la frontera (2 celdas) vale la pena la onda larga: lejos, el bioma es el de la celda.
  const nearBorder = new Uint8Array(rows * cols);
  if (gpIdx) {
    for (let cy = 0; cy < rows; cy += 1) for (let cx = 0; cx < cols; cx += 1) {
      const k = cellBiome[cy][cx];
      let near = 0;
      for (let j = -2; j <= 2 && !near; j += 1) for (let i = -2; i <= 2; i += 1) if (biomeCell(cx + i, cy + j) !== k) { near = 1; break; }
      nearBorder[cy * cols + cx] = near;
    }
  }
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const base = cellAt(Math.floor(x / TILE), Math.floor(y / TILE));
      const wx = x + (smoothNoise(x, y, 9, seed) - 0.5) * 9;
      const wy = y + (smoothNoise(x, y, 9, seed + 31) - 0.5) * 9;
      const warped = cellAt(Math.floor(wx / TILE), Math.floor(wy / TILE));
      let t = crisp.has(base) || crisp.has(warped) ? base : warped;
      if (gpIdx && !nearBorder[(y >> 4) * cols + (x >> 4)]) {
        gpIdx[y * W + x] = cellBiome[y >> 4][x >> 4];
      } else if (gpIdx) {
        // Onda larga (40 px) + ondita (13 px): la frontera serpentea varios cuadros; ±4 px de Bayer la trama.
        const bx = wx + (smoothNoise(x, y, 40, seed + 47) - 0.5) * 30 + (smoothNoise(x, y, 13, seed + 53) - 0.5) * 10 + (bayer(x, y) - 0.5) * 8;
        const by = wy + (smoothNoise(x, y, 40, seed + 59) - 0.5) * 30 + (smoothNoise(x, y, 13, seed + 61) - 0.5) * 10 + (bayer(x + 2, y + 1) - 0.5) * 8;
        const bcx = Math.floor(bx / TILE);
        const bcy = Math.floor(by / TILE);
        const k = biomeCell(bcx, bcy);
        gpIdx[y * W + x] = k;
        // Pasto → arena o nieve de otro bioma: el suelo sigue la misma frontera ondulada.
        const wk = biomeCell(Math.floor(wx / TILE), Math.floor(wy / TILE));
        let swapped = false;
        if (SOFT.has(t) && !crisp.has(base) && k !== wk) {
          const other = cellAt(bcx, bcy);
          if (SOFT.has(other)) { t = other; swapped = true; }
        }
        // La arena no cambia de paleta a medias (en nieve es grava helada): la del cuadro de donde salió.
        if (t === T.SAND && !swapped) gpIdx[y * W + x] = wk;
      }
      ter[y * W + x] = t;
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
  // Paleta de pasto por píxel: una ruta puede pasar de montaña a selva, o de desierto a nieve.
  const gpAt = gpIdx
    ? (x, y) => PALS[gpIdx[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))]]
    : () => fallback;
  const plazaStyle = crispCobble ? plaza ?? PLAZA_BY_BIOME[biome] ?? "warm" : "road";
  const curb = CURB[plazaStyle] ?? CURB.road;

  // 3) Color base de cada píxel.
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = ter[y * W + x];
      buf.data[y * W + x] = baseColor(t, x, y, seed, gpAt(x, y), waterDist[y * W + x], at, plazaStyle);
    }
  }

  // 4) Bordes: sombra del terreno alto sobre el bajo, luz en el canto.
  const out = buf.data.slice();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = at(x, y);
      if (t === T.WATER || t === T.CLIFF) continue;
      const gp = gpAt(x, y);
      const up = at(x, y - 1);
      const up2 = at(x, y - 2);
      const down = at(x, y + 1);
      const left = at(x - 1, y);
      const right = at(x + 1, y);
      const i = y * W + x;
      if (t === T.COBBLE) {
        const edge = [up, down, left, right].some((n) => n !== T.COBBLE);
        if (edge) out[i] = c(down !== T.COBBLE || right !== T.COBBLE ? curb[0] : curb[1]);
        else if ([at(x, y - 2), at(x, y + 2), at(x - 2, y), at(x + 2, y)].some((n) => n !== T.COBBLE)) out[i] = c(curb[2]);
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
      if (t === T.SNOW && HEIGHT[down] < HEIGHT[t]) out[i] = c("n4");
      if ((t === T.GRASS || t === T.FOREST) && HEIGHT[down] < HEIGHT[t]) {
        out[i] = c(t === T.FOREST ? gp.g2 : gp.g4);
        if (hash(x, y, seed + 5) < 0.35) {
          const j = (y + 1) * W + x;
          if (y + 1 < H) out[j] = c(gp.g3);
        }
      }
      if (t === T.SAND && [up, down, left, right].includes(T.WATER)) out[i] = c(gp.name === "snow" ? "s4" : "d4");
    }
  }
  buf.data.set(out);

  // 5) Adornos sueltos: matas, flores, piedritas.
  decorate(buf, ter, W, H, seed, gpAt);
  return { buf, ter, W, H, wd: waterDist };
}

function shadowOf(t, gp, amount) {
  if (t === T.DIRT || t === T.FIELD) return c(amount > 1 ? "d1" : "d2");
  if (t === T.SAND && gp.name === "snow") return c(amount > 1 ? "s3" : "n1");
  if (t === T.SAND) return c(amount > 1 ? "d3" : "d4");
  if (t === T.GRAVEL) return c(amount > 1 ? "d1" : "d2");
  if (t === T.BRIDGE) return c("o1");
  if (t === T.SNOW) return c(amount > 1 ? "n1" : "n2");
  if (t === T.ICE) return c("w4");
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

function baseColor(t, x, y, seed, gp, wd, at, plazaStyle = "road") {
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
      if (gp.name === "snow") return frostShore(x, y, seed);
      const p = patch(x, y, 26, seed + 13, 0.17, 0.72);
      return c(p > 0 ? "d6" : p < 0 ? "d4" : "d5");
    }
    case T.SNOW: {
      const p = patch(x, y, 28, seed + 19, 0.15, 0.7);
      if (hash(x, y, seed + 71) < 0.006) return c("white");
      return c(p > 0 ? "n4" : p < 0 ? "n2" : "n3");
    }
    case T.ICE: {
      // Hielo: vetas diagonales claras y alguna grieta.
      const streak = (x + y * 2 + Math.floor(smoothNoise(x, y, 14, seed) * 20)) % 23;
      if (streak < 2) return c("n4");
      if (hash(x >> 1, y, seed + 73) < 0.01) return c("w3");
      const p = patch(x, y, 18, seed + 29, 0.3, 0.7);
      return c(p > 0 ? "w6" : p < 0 ? "w4" : "w5");
    }
    case T.GRAVEL: {
      // Tierra con guijarros sueltos (antes era gris plano y se leía como mancha).
      const by = Math.floor(y / 3);
      const sx = x + ((by * 5) % 4);
      const bx = Math.floor(sx / 4);
      const lx = sx % 4;
      const ly = y % 3;
      const r = hash(bx, by, seed + 17);
      if (r < 0.62 && lx < 3) {
        const wide = r < 0.3;
        if (ly === 2) return lx < (wide ? 3 : 2) ? c("s1") : c("d2");
        if (!wide && lx === 2) return c("d3");
        if (ly === 0) return c(lx === 0 ? "s5" : "s4");
        return c(lx === 0 ? "s4" : "s3");
      }
      const p = patch(x, y, 10, seed + 23, 0.35, 0.72);
      return c(p > 0 ? "d4" : p < 0 ? "d2" : "d3");
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
      return (PLAZAS[plazaStyle] ?? cobble)(x, y, seed);
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

// ---------- Plazas por pueblo ----------

/** Rejilla de piedras en hileras corridas: devuelve la piedra (col, row) y la posición dentro. */
function brick(x, y, seed, rowH, wBase, jitter = 6) {
  const row = Math.floor(y / rowH);
  const ly = y % rowH;
  const offset = Math.floor(hash(row, 0, seed + 21) * jitter) + (row % 2) * Math.floor(wBase / 2);
  const col = Math.floor((x + offset) / wBase);
  const lx = (x + offset) % wBase;
  return { row, col, lx, ly, tone: hash(col, row, seed + 23) };
}

/** Ashfen: adoquín cálido (crema y ocre), juntas de tierra, musgo sólo en algunas juntas. */
function plazaWarm(x, y, seed) {
  const { lx, ly, tone } = brick(x, y, seed, 6, 7);
  if (ly === 0 || lx === 0) {
    const moss = smoothNoise(x, y, 18, seed + 91) > 0.68;
    return c(moss ? (hash(x, y, seed) < 0.5 ? "g2" : "g3") : "d1");
  }
  if (ly === 1 || lx === 1) return c(tone > 0.66 ? "d5" : "c3");
  if (ly === 5 || lx === 6) return c(tone > 0.66 ? "d3" : "c1");
  if (tone > 0.86) return c("d4");
  if (tone < 0.035) return c("s4");
  return c(tone > 0.45 ? "c2" : "c1");
}

/** Valkeep: losas grandes de piedra oscura de montaña, juntas claras, liquen y algo de nieve. */
function plazaMountain(x, y, seed) {
  const { row, col, lx, ly, tone } = brick(x, y, seed + 5, 9, 12, 9);
  const joint = ly === 0 || lx === 0;
  if (joint) {
    // Nieve que se queda en las juntas de arriba de la losa.
    if (smoothNoise(x, y, 22, seed + 93) > 0.7) return c(bayer(x, y) < 0.6 ? "n3" : "s5");
    return c("s4");
  }
  if (ly === 1 || lx === 1) return c(tone > 0.5 ? "s3" : "s2");
  if (ly === 8 || lx === 11) return c("s0");
  // Liquen: manchas ocre y olivo sobre algunas losas.
  const lich = hash(col, row, seed + 97);
  if (lich < 0.3) {
    const n = smoothNoise(x, y, 4, seed + col * 7 + row);
    if (n > 0.72) return c(lich < 0.12 ? "t2" : "l3");
  }
  // Cara de la losa: dos tonos en manchas grandes, no ruido.
  if (tone < 0.3) return c("s1");
  return c(smoothNoise(x, y, 6, seed + col * 3 + row * 5) > 0.66 ? "s1" : tone > 0.75 ? "s3" : "s2");
}

/** Verdelume: entarimado de tablones oscuros y húmedos, con musgo entre tabla y tabla. */
function plazaPlanks(x, y, seed) {
  const rowH = 5;
  const row = Math.floor(y / rowH);
  const ly = y % rowH;
  const len = 18 + Math.floor(hash(row, 1, seed + 31) * 10);
  const off = Math.floor(hash(row, 2, seed + 33) * len);
  const col = Math.floor((x + off) / len);
  const lx = (x + off) % len;
  const tone = hash(col, row, seed + 35);
  if (ly === rowH - 1) {
    // Rendija: oscura, con musgo que asoma.
    return c(smoothNoise(x, y, 7, seed + 37) > 0.62 ? (hash(x, y, seed) < 0.5 ? "g2" : "f3") : "o0");
  }
  if (lx === 0) return c("o0");
  if (lx === 1 && ly < 3) return c("o1");
  // Clavos.
  if ((lx === 2 || lx === len - 2) && ly === 2) return c("s2");
  // Tabla mojada: el canto de arriba brilla en tramos, y un charquito de luz de vez en cuando.
  const wet = smoothNoise(x, y, 12, seed + 39);
  if (ly === 0) return c(wet > 0.55 ? "o3" : "o2");
  if (ly === 1 && wet > 0.7 && lx > 3 && lx < len - 4 && hash(col, row, seed + 43) < 0.5) return c("o3");
  const grain = hash(Math.floor(x / 4), row * 5 + ly, seed + 41) < 0.18;
  if (grain) return c("o1");
  return c(tone > 0.6 ? "o2" : tone < 0.2 ? "o1" : bayer(x, y) < 0.35 ? "o1" : "o2");
}

/** Duneshade: arena apisonada con losas de barro cocido sueltas, algunas faltan. */
function plazaMud(x, y, seed) {
  const cw = 13;
  const ch = 11;
  const col = Math.floor(x / cw);
  const row = Math.floor(y / ch);
  const lx = x % cw;
  const ly = y % ch;
  const tone = hash(col, row, seed + 61);
  const present = tone > 0.18;
  if (present && lx >= 2 && ly >= 2) {
    const sx = lx - 2;
    const sy = ly - 2;
    const sw = cw - 2;
    const sh = ch - 2;
    // Esquinas gastadas.
    if ((sx === 0 || sx === sw - 1) && (sy === 0 || sy === sh - 1)) return sandBase(x, y, seed);
    if (sy === sh - 1 || sx === sw - 1) return c("d2");
    if (sy === 0 || sx === 0) return c("d5");
    if (hash(x, y, seed + 63) < 0.03) return c("d2");
    // Grieta en algunas losas.
    if (tone > 0.9 && sx === Math.floor(sw / 2) + (sy >> 2)) return c("d2");
    return c(tone > 0.55 ? "d4" : "d3");
  }
  return sandBase(x, y, seed);
}

function sandBase(x, y, seed) {
  // Arena apisonada: más oscura y quieta que la de duna.
  const p = patch(x, y, 9, seed + 65, 0.3, 0.75);
  if (hash(x, y, seed + 67) < 0.02) return c("d3");
  return c(p > 0 ? "d5" : "d4");
}

/** Frostholm: piedra clara, escarcha blanca en las juntas, sin musgo. */
function plazaFrost(x, y, seed) {
  const { lx, ly, tone } = brick(x, y, seed + 11, 7, 9);
  if (ly === 0 || lx === 0) return c(hash(x, y, seed + 71) < 0.7 ? "n4" : "n3");
  if (ly === 1 || lx === 1) return c(tone > 0.5 ? "s6" : "s5");
  if (ly === 6 || lx === 8) return c("s3");
  // Escarcha que trepa desde la junta a la esquina de arriba.
  if (ly === 2 && lx < 4 && bayer(x, y) < 0.5) return c("n4");
  if (tone > 0.8) return c("n2");
  return c(tone > 0.4 ? "s4" : "s5");
}

/** Mossgrove: losas irregulares cubiertas de musgo espeso, con hojas caídas. */
function plazaMoss(x, y, seed) {
  // Hojas sueltas: dos píxeles, colores de otoño.
  const leafCell = hash(x >> 2, y >> 2, seed + 81);
  if (leafCell < 0.035 && (x & 3) < 2 && (y & 3) === 1) return c(leafCell < 0.012 ? "r3" : leafCell < 0.024 ? "y2" : "o4");
  const moss = smoothNoise(x, y, 14, seed + 83) + (bayer(x, y) - 0.5) * 0.14;
  const { lx, ly, tone } = brick(x, y, seed + 17, 10, 13, 10);
  if (moss > 0.62) return c(moss > 0.75 ? "g2" : hash(x >> 1, y, seed) < 0.3 ? "g4" : "g3");
  if (ly === 0 || lx === 0) return c(moss > 0.45 ? "g1" : "s1");
  if (ly === 1 || lx === 1) return c("s4");
  if (ly === 9 || lx === 12) return c("s1");
  if (moss > 0.52 && bayer(x, y) < 0.5) return c("g2");
  return c(tone > 0.5 ? "s3" : "s2");
}

const PLAZAS = { road: cobble, warm: plazaWarm, mountain: plazaMountain, planks: plazaPlanks, mud: plazaMud, frost: plazaFrost, moss: plazaMoss };

/** Orilla helada: grava clara con escarcha (la "arena" de los mapas de nieve). */
function frostShore(x, y, seed) {
  const by = Math.floor(y / 3);
  const sx = x + ((by * 5) % 4);
  const bx = Math.floor(sx / 4);
  const lx = sx % 4;
  const ly = y % 3;
  const r = hash(bx, by, seed + 17);
  // Guijarros sueltos, claros, con su sombrita abajo; la escarcha los junta en manchas.
  const dense = smoothNoise(x, y, 16, seed + 19);
  if (r < 0.1 + dense * 0.3 && lx < 3) {
    if (ly === 2) return c(lx < 2 ? "n1" : "n2");
    if (ly === 0) return c(lx === 0 ? "n4" : "s5");
    return c(lx === 0 ? "s5" : "s4");
  }
  const p = patch(x, y, 12, seed + 23, 0.3, 0.7);
  return c(p > 0 ? "n3" : p < 0 ? "n1" : "n2");
}

function water(x, y, seed, wd) {
  if (wd <= 1) return c(hash(x, y >> 1, seed) < 0.75 ? "w6" : "w5");
  if (wd <= 2) return c(bayer(x, y) < 0.6 ? "w5" : "w4");
  if (wd <= 5) return c(bayer(x, y) < (5 - wd) / 3 ? "w4" : "w3");
  // Brillos horizontales sueltos (sólo en el agua horneada: la capa animada pone olas y destellos).
  const glint = hash(Math.floor(x / 5), y, seed + 41) < 0.018;
  if (glint) return c("w4");
  return deepWater(x, y, seed, wd);
}

function deepWater(x, y, seed, wd) {
  const deep = wd > 14 ? 1 : wd > 9 ? 0.5 : 0;
  if (deep && bayer(x, y) < deep) return c("w1");
  return c(patch(x, y, 18, seed + 43, 0.25, 0.8) > 0 ? "w3" : "w2");
}

// ---------- Agua animada (G4) ----------
//
// El suelo trae el agua horneada (sirve de respaldo). Encima, mapbuild.js pone una hoja de
// WATER_FRAMES cuadros por cada río, canal, estanque o golfo, recortada a su rectángulo: olas
// cortas que avanzan y se deshacen, espuma de orilla que late y destellos que titilan. Cada ola,
// cada tramo de costa y cada destello lleva su propio desfase, así que con una sola animación
// compartida (todas las hojas cambian de cuadro a la vez) el agua no se mueve en bloque.
// El hielo (estanque helado) no tiene olas: sólo destellos lentos sobre el suelo horneado.

export const WATER_FRAMES = 4;

/** Rectángulos (en píxeles, alineados a la rejilla) que cubren cada mancha conexa de `kind`. */
export function waterRegions(ter, W, H, kind = T.WATER) {
  const cols = Math.ceil(W / TILE);
  const rows = Math.ceil(H / TILE);
  const has = new Uint8Array(cols * rows);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (ter[y * W + x] === kind) has[(y >> 4) * cols + (x >> 4)] = 1;
  const seen = new Uint8Array(cols * rows);
  const out = [];
  for (let i = 0; i < has.length; i += 1) {
    if (!has[i] || seen[i]) continue;
    let x0 = cols;
    let y0 = rows;
    let x1 = -1;
    let y1 = -1;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const cx = j % cols;
      const cy = (j - cx) / cols;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const k = ny * cols + nx;
        if (has[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    out.push({ x: x0 * TILE, y: y0 * TILE, w: Math.min(W, (x1 + 1) * TILE) - x0 * TILE, h: Math.min(H, (y1 + 1) * TILE) - y0 * TILE });
  }
  return out;
}

/** Un píxel de agua en el cuadro `k`. */
function waterFrame(x, y, seed, wd, k) {
  // Espuma de orilla que late: la franja crece y se recoge; cada tramo de costa a su compás.
  const beat = (k + Math.floor(smoothNoise(x, y, 22, seed + 5) * 4)) & 3;
  const reach = [1, 2, 3, 2][beat];
  if (wd <= 1) return c(hash(x, y >> 1, seed) < 0.75 ? "w6" : "w5");
  if (wd <= reach) return c(bayer(x, y) < (wd >= 3 ? 0.35 : 0.65) ? "w6" : "w5");
  // Resaca: al recogerse la espuma queda una rayita clara un poco más adentro.
  if (beat === 0 && wd === 3 && bayer(x, y) < 0.5) return c("w5");
  if (wd <= 2) return c(bayer(x, y) < 0.6 ? "w5" : "w4");
  const base = wd <= 5 ? (bayer(x, y) < (5 - wd) / 3 ? "w4" : "w3") : null;
  const deep = base ?? (wd > 14 && bayer(x, y) < 1 ? "w1" : wd > 9 && bayer(x, y) < 0.5 ? "w1" : patch(x, y, 18, seed + 43, 0.25, 0.8) > 0 ? "w3" : "w2");
  if (wd > 3) {
    // Olas: crestas cortas en hileras corridas; cada una avanza 1 px por cuadro, crece y se deshace.
    const row = Math.floor(y / 6);
    const ly = y - row * 6;
    if (ly === 3 || ly === 4) {
      const off = (row * 7) % 13;
      const col = Math.floor((x + off) / 13);
      const lx = x + off - col * 13;
      const h1 = hash(col, row, seed + 91);
      if (h1 < 0.42 && smoothNoise(x, y, 28, seed + 93) > 0.28) {
        const p = (k + Math.floor(h1 * 97)) & 3;
        const len = [3, 5, 4, 0][p];
        const start = 1 + Math.floor(hash(col, row, seed + 92) * 3) + p;
        if (len && lx >= start && lx < start + len) {
          if (ly === 3) return c(p === 1 && lx > start && lx < start + len - 1 ? "w5" : "w4");
          if (lx > start) return c(deep === "w3" || deep === "w4" ? "w2" : "w1");
        }
      }
    }
  }
  if (wd > 5) {
    // Destellos en lo hondo: una crucecita que se prende y se apaga, cada una a su ritmo.
    const tx = x >> 3;
    const ty = y >> 3;
    const th = hash(tx, ty, seed + 97);
    if (th < 0.07) {
      const sx = (tx << 3) + 2 + Math.floor(hash(tx, ty, seed + 98) * 4);
      const sy = (ty << 3) + 2 + Math.floor(hash(tx, ty, seed + 99) * 4);
      const p = (k + Math.floor(th * 400)) & 3;
      if (p === 0 && ((x === sx && Math.abs(y - sy) <= 1) || (y === sy && Math.abs(x - sx) <= 1))) return c(x === sx && y === sy ? "w6" : "w5");
      if (p === 1 && x === sx && y === sy) return c("w5");
    }
  }
  return c(deep);
}

/** Destello lento sobre el hielo (0 = transparente: se ve el hielo horneado). */
function iceFrame(x, y, seed, k) {
  const tx = Math.floor(x / 12);
  const ty = Math.floor(y / 10);
  const th = hash(tx, ty, seed + 101);
  if (th >= 0.3) return 0;
  const sx = tx * 12 + 3 + Math.floor(hash(tx, ty, seed + 102) * 6);
  const sy = ty * 10 + 2 + Math.floor(hash(tx, ty, seed + 103) * 6);
  const p = (k + Math.floor(th * 300)) & 3;
  const dx = Math.abs(x - sx);
  const dy = Math.abs(y - sy);
  if (p === 1 && !dx && !dy) return c("n4");
  if (p === 2 && ((!dx && dy <= 1) || (!dy && dx <= 1))) return c(!dx && !dy ? "white" : "n4");
  if (p === 2 && !dx && dy === 2 && bayer(x, y) < 0.5) return c("n4");
  if (p === 3 && !dx && !dy) return c("white");
  return 0;
}

/**
 * Hoja animada de un rectángulo de agua (o de hielo): `frames` cuadros del tamaño del rectángulo,
 * en fila (o en columna si el rectángulo es más ancho que alto, para no pasar del tope de textura).
 * Sólo pinta los píxeles de ese terreno; lo demás queda transparente.
 */
export function paintWaterSheet(ter, wd, W, rect, { seed = 7, kind = T.WATER, frames = WATER_FRAMES } = {}) {
  const across = rect.w <= rect.h;
  const buf = new Buf(across ? rect.w * frames : rect.w, across ? rect.h : rect.h * frames);
  for (let k = 0; k < frames; k += 1) {
    const ox = across ? k * rect.w : 0;
    const oy = across ? 0 : k * rect.h;
    for (let y = 0; y < rect.h; y += 1) for (let x = 0; x < rect.w; x += 1) {
      const gx = rect.x + x;
      const gy = rect.y + y;
      const i = gy * W + gx;
      if (ter[i] !== kind) continue;
      const col = kind === T.ICE ? iceFrame(gx, gy, seed, k) : waterFrame(gx, gy, seed, wd[i], k);
      if (col) buf.data[(oy + y) * buf.w + ox + x] = col;
    }
  }
  return { buf, frames, across, frameWidth: rect.w, frameHeight: rect.h };
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

function decorate(buf, ter, W, H, seed, gpAt) {
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
      const gp = gpAt(x, y);
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
      } else if (t === T.SAND && gp.name === "snow") {
        // Orilla helada: alguna placa de hielo pegada a la grava.
        if (r < 0.06 && allGrass(x, y, 4, 2, T.SAND)) buf.stamp([".ll.", "lwwl"], { l: "n4", w: "w5" }, x, y);
      } else if (t === T.SAND && r < 0.08 && allGrass(x, y, 2, 2, T.SAND)) {
        buf.stamp(["l.", ".d"], { l: "c4", d: "d3" }, x, y);
      } else if (t === T.SAND && r > 0.72 && allGrass(x, y, 7, 3, T.SAND)) {
        // Ondas de duna: arco claro arriba, sombra abajo.
        buf.stamp(["..lll..", ".l...l.", "d.....d", ".d...d."].slice(0, 3), { l: "d6", d: "d4" }, x, y);
      } else if (t === T.SNOW && r < 0.12 && allGrass(x, y, 5, 3, T.SNOW)) {
        buf.stamp([".lll.", "lllll", ".sss."], { l: "n4", s: "n2" }, x, y);
      } else if (t === T.SNOW && r > 0.96 && allGrass(x, y, 3, 3, T.SNOW)) {
        buf.stamp(["g.g", ".g.", "..."], { g: gp.g1 }, x, y);
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
