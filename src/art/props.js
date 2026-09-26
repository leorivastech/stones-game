/**
 * Objetos del mundo. Luz desde arriba a la izquierda, contorno oscuro, 3-4 tonos por material.
 * Los volúmenes redondos (copas, rocas) se sombrean como esferas y se cuantizan a la rampa.
 */

import { Buf, bayer, hash, rng, strip } from "./pixel.js";
import { P, rgba } from "./palette.js";

const L = normalize([-0.55, -0.75, 0.62]);
function normalize(v) {
  const n = Math.hypot(...v);
  return v.map((a) => a / n);
}

/** Volumen redondo sombreado. ramp va de oscuro a claro. */
function sphere(buf, cx, cy, rx, ry, ramp, { seed = 1, grain = 0.18, rim = true } = {}) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d);
      let li = nx * L[0] + ny * L[1] + nz * L[2];
      li += (hash(x >> 1, y >> 1, seed) - 0.5) * grain * 2;
      li = Math.max(0, Math.min(0.999, (li + 0.35) / 1.35));
      let idx = Math.floor(li * ramp.length);
      if (rim && d > 0.8 && ny > 0.2) idx = Math.max(0, idx - 1);
      buf.set(x, y, ramp[Math.min(ramp.length - 1, idx)]);
    }
  }
}

function shadow(buf, cx, cy, rx, ry) {
  buf.ellipse(cx, cy, rx, ry, rgba("ink", 80));
}

/**
 * Sombra de contacto chiquita para lo que ya lleva sombra proyectada (mapbuild.js):
 * sólo oscurece el pie para que no flote; la silueta larga la pone el mapa.
 */
function contact(buf, cx, cy, rx, ry) {
  buf.ellipse(cx, cy, rx, ry, rgba("ink", 60));
}

// Contorno selectivo (G10): del lado de la luz (arriba-izquierda) el borde toma un tono medio del
// material que toca; del lado de la sombra (abajo-derecha) queda la tinta. Así el objeto no parece
// recortado con plumón y sigue leyéndose contra el pasto.
let midOf = null;
function midTone(c) {
  if (!midOf) {
    midOf = new Map();
    const ramps = {};
    for (const name of Object.keys(P)) {
      const m = /^([a-z]+)(\d)$/.exec(name);
      if (m && P[name]) (ramps[m[1]] ??= []).push(Number(m[2]));
    }
    for (const [ramp, idx] of Object.entries(ramps)) {
      const top = Math.max(...idx);
      const mid = Math.max(1, Math.floor(top / 2) - 1);
      for (const i of idx) if (i > mid) midOf.set(rgba(`${ramp}${i}`), rgba(`${ramp}${mid}`));
    }
  }
  return midOf.get(c);
}

function withOutline(buf, color = "ink") {
  // El contorno no debe tapar la sombra del piso (semi transparente).
  const ink = rgba(color);
  const { w, h, data } = buf;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (data[y * w + x] >>> 24) === 255;
  const out = data.slice();
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (solid(x, y)) continue;
      const r = solid(x + 1, y);
      const d = solid(x, y + 1);
      const l = solid(x - 1, y);
      const u = solid(x, y - 1);
      if (!(r || d || l || u)) continue;
      // Lado de la luz: sólo toca el objeto por la derecha o por abajo.
      let c = ink;
      if (!l && !u) c = midTone(data[r ? y * w + x + 1 : (y + 1) * w + x]) ?? ink;
      out[y * w + x] = c;
    }
  }
  data.set(out);
  return buf;
}

// ---------- Vegetación ----------

/**
 * Árbol de copa redonda. `sway` (0/1) corre 1 px los racimos de arriba: segundo cuadro del vaivén;
 * el tronco y los racimos bajos no se mueven.
 */
export function tree(variant = 0, { autumn = false, sway = 0 } = {}) {
  const b = new Buf(32, 38);
  contact(b, 16, 34, 5, 1.5);
  // Tronco
  b.rect(13, 23, 6, 11, "o2");
  b.vline(13, 23, 11, "o3");
  b.vline(18, 23, 11, "o1");
  b.set(12, 33, "o2"); b.set(19, 33, "o1"); b.set(14, 30, "o1"); b.set(16, 27, "o4");
  const ramp = autumn ? ["r0", "r1", "r2", "r3", "r4", "y3"] : ["f1", "f2", "f3", "f4", "f5", "f6"];
  const r = rng(11 + variant * 7);
  const clumps = [
    [16, 12, 10, 8], [9, 17, 7, 6], [23, 17, 7, 6], [16, 20, 9, 5], [11, 9, 6, 5], [21, 9, 6, 5], [16, 6, 7, 5],
  ].map(([x, y, rx, ry]) => [x + Math.round((r() - 0.5) * 2) + (y < 14 ? sway : 0), y + Math.round((r() - 0.5) * 2), rx, ry]);
  // De atrás (arriba) hacia adelante (abajo): cada racimo tapa al anterior.
  clumps.sort((a, b2) => a[1] - b2[1]).forEach(([x, y, rx, ry], i) => sphere(b, x, y, rx, ry, ramp, { seed: variant * 13 + i }));
  // Sombra del follaje sobre el tronco.
  b.hline(14, 26, 4, "o1");
  // Hojitas sueltas de luz.
  for (let i = 0; i < 6; i += 1) {
    const x0 = 7 + Math.floor(r() * 16);
    const y = 3 + Math.floor(r() * 12);
    const x = x0 + (y < 11 ? sway : 0);
    if (b.alpha(x, y) === 255) b.set(x, y, ramp[5]);
  }
  return withOutline(b, autumn ? "r0" : "f0");
}

/**
 * Más árboles para que las rutas no se vean clonadas (G6): cada forma con su tamaño, copa y tinte.
 * Todas con 2 cuadros de vaivén (los racimos de arriba se corren 1 px) y la misma luz que tree().
 *  - tall:  álamo, copa alta y angosta.
 *  - young: arbolito joven, chico y verde claro (rampa del pasto).
 *  - wide:  roble ancho de copa baja y oscura.
 *  - acacia: copa plana en olivo, tronco que se abre en horqueta (desierto y sabana).
 *  - jungle: árbol de selva chico, verde hondo con lianas.
 */
const TREE_KINDS = {
  tall: {
    w: 26, h: 46, foot: [13, 43, 4], trunk: [11, 32, 4, 11], swayAbove: 20, line: "f0",
    ramp: ["f1", "f2", "f3", "f4", "f5", "f6"],
    clumps: [[13, 11, 7, 8], [13, 20, 8, 8], [13, 28, 8, 5], [8, 16, 5, 6], [18, 15, 5, 6], [13, 5, 5, 4]],
  },
  young: {
    w: 22, h: 30, foot: [11, 27, 3.5], trunk: [10, 19, 3, 8], swayAbove: 10, line: "g0",
    ramp: ["g1", "g2", "g3", "g4", "g5", "g6"],
    clumps: [[11, 11, 7, 6], [6, 14, 4, 4], [16, 14, 4, 4], [11, 6, 5, 4]],
  },
  wide: {
    w: 44, h: 38, foot: [22, 34, 6], trunk: [19, 23, 6, 11], swayAbove: 13, line: "f0",
    ramp: ["f0", "f1", "f2", "f3", "f4", "f5"],
    clumps: [[22, 13, 12, 8], [10, 18, 8, 6], [34, 18, 8, 6], [22, 20, 12, 5], [14, 9, 7, 5], [30, 9, 7, 5], [22, 6, 7, 4]],
  },
  acacia: {
    w: 40, h: 34, foot: [20, 31, 4], trunk: null, swayAbove: 10, line: "l0",
    ramp: ["l0", "l1", "l2", "l3", "l4", "g4"],
    clumps: [[20, 9, 14, 4], [10, 11, 8, 3.5], [30, 11, 8, 3.5], [20, 6, 9, 3], [14, 12, 6, 3], [26, 12, 6, 3]],
  },
  jungle: {
    w: 34, h: 40, foot: [17, 37, 5], trunk: [14, 24, 6, 13], swayAbove: 12, line: "f0",
    ramp: ["f0", "f1", "f2", "g2", "g3", "g4"],
    clumps: [[17, 12, 11, 8], [8, 17, 7, 6], [26, 17, 7, 6], [17, 21, 9, 5], [12, 7, 7, 5], [23, 7, 7, 5]],
  },
};

export function treeKind(kind = "tall", sway = 0) {
  const K = TREE_KINDS[kind];
  const b = new Buf(K.w, K.h);
  const [fx, fy, fr] = K.foot;
  contact(b, fx, fy, fr, 1.5);
  if (K.trunk) {
    const [tx, ty, tw, th] = K.trunk;
    b.rect(tx, ty, tw, th, "o2");
    b.vline(tx, ty, th, "o3");
    b.vline(tx + tw - 1, ty, th, "o1");
    b.set(tx - 1, ty + th - 1, "o2"); b.set(tx + tw, ty + th - 1, "o1");
    b.set(tx + 1, ty + Math.floor(th / 2), "o1");
  } else {
    // Acacia: tronco delgado que se abre en dos ramas hacia la copa plana.
    for (let y = 0; y < 18; y += 1) {
      const t = y / 17;
      const spread = t > 0.45 ? Math.round((t - 0.45) * 16) : 0;
      const x = fx - 1 + Math.round(Math.sin(t * 3) * 1.2);
      b.rect(x - spread, fy - y, 2, 1, "o2");
      b.set(x - spread, fy - y, "o3");
      if (spread) { b.rect(x + spread, fy - y, 2, 1, "o1"); b.set(x + spread, fy - y, "o2"); }
    }
  }
  const r = rng(kind.length * 17 + 5);
  const clumps = K.clumps.map(([x, y, rx, ry]) => [
    x + Math.round((r() - 0.5) * 2) + (y < K.swayAbove ? sway : 0), y + Math.round((r() - 0.5) * 2), rx, ry,
  ]);
  clumps.sort((a, b2) => a[1] - b2[1]).forEach(([x, y, rx, ry], i) => sphere(b, x, y, rx, ry, K.ramp, { seed: kind.length * 7 + i, grain: kind === "jungle" ? 0.26 : 0.18 }));
  if (K.trunk) b.hline(K.trunk[0] + 1, K.trunk[1] + 2, K.trunk[2] - 2, "o1");
  if (kind === "jungle") {
    // Lianas cortas que cuelgan de la copa.
    for (let k = 0; k < 4; k += 1) {
      const x = 6 + Math.floor(r() * 22);
      let y0 = 26;
      while (y0 > 0 && !b.alpha(x, y0)) y0 -= 1;
      for (let y = y0; y < y0 + 4 + Math.floor(r() * 6); y += 1) b.set(x + (Math.floor(y / 4) % 2), y, y % 3 ? "f2" : "g3");
    }
  }
  // Hojitas sueltas de luz arriba a la izquierda.
  for (let i = 0; i < 6; i += 1) {
    const x0 = 3 + Math.floor(r() * (K.w - 6));
    const y = 2 + Math.floor(r() * (K.swayAbove + 2));
    const x = x0 + (y < K.swayAbove ? sway : 0);
    if (b.alpha(x, y) === 255) b.set(x, y, K.ramp[5]);
  }
  return withOutline(b, K.line);
}

/**
 * Pino. `sway` (0/1) corre 1 px los dos pisos de arriba (segundo cuadro del vaivén).
 * `size`: "normal" (24×40), "tall" (28×52, 5 pisos) o "small" (18×28, 3 pisos).
 * `dark`: rampa más honda (pinar viejo).
 */
export function pine(snow = false, sway = 0, { size = "normal", dark = false } = {}) {
  const S = {
    normal: { w: 24, h: 40, trunk: [10, 30, 4, 7], tiers: [[2, 5, 9], [8, 7, 12], [14, 9, 14], [20, 11, 12]] },
    tall: { w: 28, h: 52, trunk: [12, 42, 4, 7], tiers: [[2, 4, 8], [7, 6, 11], [13, 8, 13], [20, 10, 14], [28, 12, 14]] },
    small: { w: 18, h: 28, trunk: [7, 21, 3, 5], tiers: [[2, 4, 7], [7, 6, 9], [12, 8, 10]] },
  }[size];
  const b = new Buf(S.w, S.h);
  const cx0 = S.w / 2;
  const [tx, ty, tw, th] = S.trunk;
  contact(b, cx0, ty + th, Math.max(3, tw), 1.5);
  b.rect(tx, ty, tw, th, "o2");
  b.vline(tx, ty, th, "o3");
  b.vline(tx + tw - 1, ty, th, "o1");
  const ramp = dark ? ["f0", "f0", "f1", "f2", "f3"] : ["f0", "f1", "f2", "f3", "f4"];
  S.tiers.forEach(([top, half, h], i) => {
    const cx = cx0 + (i < 2 ? sway : 0);
    for (let y = 0; y < h; y += 1) {
      const w = Math.round(((y + 1) / h) * half);
      for (let x = -w; x <= w; x += 1) {
        const px = cx + x;
        const py = top + y;
        const side = x / Math.max(1, w);
        let tone = side < -0.35 ? 4 : side < 0.1 ? 3 : side < 0.55 ? 2 : 1;
        if (y >= h - 2) tone = Math.max(0, tone - 2);
        if (hash(px, py, size === "normal" ? 5 : 5 + S.w) < 0.12) tone = Math.max(0, tone - 1);
        b.set(px, py, ramp[tone]);
        if (snow && y < 3 + (x < 0 ? 1 : 0) && hash(px, py, 9) < 0.8) b.set(px, py, x < 0 ? "n4" : "n3");
      }
    }
  });
  return withOutline(b, dark ? "ink" : "f0");
}

export function bush(berries = false) {
  const b = new Buf(16, 16);
  shadow(b, 8, 13.5, 7, 2);
  const ramp = ["f1", "f2", "f3", "f4", "f5"];
  sphere(b, 5, 9, 4.5, 4, ramp, { seed: 3 });
  sphere(b, 11, 9, 4.5, 4, ramp, { seed: 4 });
  sphere(b, 8, 6, 5, 4.5, ramp, { seed: 5 });
  if (berries) [[5, 7], [10, 5], [12, 9], [7, 10]].forEach(([x, y]) => { b.set(x, y, "e3"); b.set(x + 1, y + 1, "e1"); });
  return withOutline(b, "f0");
}

/** Pasto alto: dos cuadros de vaivén. Se ve a través de las puntas. */
export function tallGrass(variant = 0) {
  const frames = [0, 1].map((f) => {
    const b = new Buf(16, 18);
    // Base tupida, sin borde duro abajo: así las celdas vecinas se funden.
    for (let y = 10; y < 18; y += 1) for (let x = 0; x < 16; x += 1) {
      const top = 10 + ((x * 5) % 3);
      if (y < top) continue;
      if (y === 17 && (x * 7) % 4 === 0) continue;
      b.set(x, y, (x + y * 2) % 5 === 0 ? "g1" : y > 14 ? "g2" : (x + y) % 3 === 0 ? "g2" : "g3");
    }
    // Hojas en matas; atrás oscuras, adelante claras. Cada variante con otra semilla.
    const r = rng(77 + variant * 131);
    const blades = [];
    for (let k = 0; k < 18; k += 1) blades.push({ x: 1 + Math.floor(r() * 14), h: 7 + Math.floor(r() * 10), lean: r() < 0.5 ? -1 : 1, front: k > 9 });
    blades.sort((a, c2) => Number(a.front) - Number(c2.front));
    for (const bl of blades) {
      for (let y = 0; y < bl.h; y += 1) {
        const t = y / bl.h;
        const sway = f ? bl.lean : 0;
        const px = bl.x + (t > 0.55 ? bl.lean : 0) + (t > 0.8 ? sway : 0);
        const ramp = bl.front ? ["g2", "g3", "g4", "g5"] : ["g1", "g2", "g3", "g4"];
        b.set(px, 17 - y, ramp[Math.min(3, Math.floor(t * 4))]);
      }
    }
    return b;
  });
  return strip(frames);
}

export function cutGrass() {
  const b = new Buf(16, 16);
  for (let x = 1; x < 15; x += 2) {
    b.set(x, 15, "g1");
    b.set(x, 14, "g3");
    if (x % 4 === 1) b.set(x + 1, 14, "g2");
  }
  return b;
}

export function rock(big = false) {
  const w = big ? 28 : 16;
  const h = big ? 22 : 14;
  const b = new Buf(w, h);
  // El peñasco lleva sombra proyectada (mapbuild.js); la roca chica, su mancha de siempre.
  if (big) contact(b, w / 2, h - 2.5, w / 2 - 4, 2);
  else shadow(b, w / 2, h - 2.5, w / 2 - 1, 2.5);
  const ramp = ["s1", "s2", "s3", "s4", "s5"];
  if (big) {
    sphere(b, 11, 11, 10, 8.5, ramp, { seed: 8, grain: 0.1 });
    sphere(b, 18, 13, 8, 6.5, ramp, { seed: 9, grain: 0.1 });
    b.set(12, 9, "s1"); b.set(13, 10, "s1"); b.set(14, 11, "s1");
    b.set(7, 5, "g4"); b.set(8, 5, "g3"); b.set(6, 6, "g3");
  } else {
    sphere(b, 8, 7.5, 6.5, 5.5, ramp, { seed: 8, grain: 0.1 });
    b.set(9, 6, "s2"); b.set(10, 7, "s2");
  }
  return withOutline(b, "s0");
}

/** Tocón: corte redondo con anillos, corteza en vetas y raíces que se abren al pie. 16×12. */
export function stump() {
  const b = new Buf(16, 12);
  stumpBody(b);
  return withOutline(b, "o0");
}

function stumpBody(b) {
  shadow(b, 8, 10.5, 7, 1.6);
  // Tronco corto que se ensancha abajo.
  for (let y = 4; y < 10; y += 1) {
    const flare = y > 7 ? y - 7 : 0;
    for (let x = 3 - flare; x <= 12 + flare; x += 1) {
      const u = (x - 3) / 9;
      b.set(x, y, u < 0.2 ? "o4" : u < 0.55 ? "o3" : u < 0.85 ? "o2" : "o1");
    }
  }
  // Vetas de la corteza.
  for (const x of [5, 8, 11]) b.vline(x, 6, 3, x > 9 ? "o0" : "o1");
  // Raíces.
  b.hline(0, 10, 3, "o2"); b.set(1, 9, "o3");
  b.hline(13, 10, 3, "o1");
  // Corte: anillos claros con el centro oscuro.
  b.ellipse(7.5, 4, 5.5, 2.4, "o4");
  b.ellipse(7.5, 4, 4, 1.6, "o5");
  b.ellipse(7.5, 4, 2, 0.9, "o4");
  b.set(7, 4, "o3");
}

// ---------- Capa de detalle de las rutas (G6) ----------
// Cosas chicas que se reparten por las rutas con ruido (claros y zonas densas). Las que se paran
// (hongos, arbustos, tocones, columnas) son sprites ordenados por y; las planas (piedritas, charcos,
// huellas, hojarasca) se hornean en el suelo (mapbuild.js → paintDecals).

/** Tocón viejo con musgo encima y un retoño. 16×12. */
export function stumpMoss() {
  const b = new Buf(16, 12);
  stumpBody(b);
  // Musgo que cae por la izquierda (lado de la luz) y cubre medio corte.
  [[2, 3], [3, 3], [4, 2], [5, 2], [2, 4], [3, 5], [3, 6], [4, 7], [2, 8], [3, 4], [4, 3]].forEach(([x, y], i) => b.set(x, y, i % 3 ? "g3" : "g4"));
  b.set(6, 2, "g2"); b.set(12, 3, "g3");
  // Retoño.
  b.set(11, 1, "g4"); b.set(10, 0, "g5"); b.set(11, 2, "g2");
  return withOutline(b, "o0");
}

/** Racimo de hongos: 0 = sombrero rojo con pintas, 1 = pardos. 12×10. */
export function mushrooms(variant = 0) {
  const b = new Buf(12, 10);
  shadow(b, 6, 8.5, 5, 1.3);
  const caps = variant ? ["o2", "o3", "o4", "o5"] : ["e1", "e2", "e3", "e4"];
  const heads = variant ? [[3, 5, 2.6], [8, 4, 3], [6, 7, 2]] : [[4, 4, 3.2], [9, 6, 2.2]];
  for (const [x, y, r] of heads) {
    b.rect(Math.round(x) - 1, y, 2, 8 - y + (r > 2.5 ? 1 : 0), "c3");
    b.set(Math.round(x), y + 1, "c1");
  }
  for (const [x, y, r] of heads) {
    b.ellipse(x, y, r, r * 0.65, caps[1]);
    b.ellipse(x - 0.5, y - 0.5, r * 0.7, r * 0.4, caps[2]);
    b.set(Math.round(x - r * 0.5), Math.round(y - 1), caps[3]);
    b.hline(Math.round(x - r) + 1, Math.round(y + r * 0.5), Math.round(r * 2) - 1, caps[0]);
    if (!variant) { b.set(Math.round(x + 0.5), Math.round(y - 1), "c4"); b.set(Math.round(x - 1), Math.round(y), "c4"); }
  }
  return withOutline(b, variant ? "o0" : "e0");
}

/** Arbusto bajo con flores. 0 = rojas, 1 = violetas, 2 = amarillas. 16×12. */
export function flowerBush(variant = 0) {
  const b = new Buf(16, 12);
  shadow(b, 8, 10, 7, 1.6);
  const ramp = ["g1", "g2", "g3", "g4", "g5"];
  sphere(b, 5, 7, 4, 3.2, ramp, { seed: 21 + variant });
  sphere(b, 11, 7, 4, 3.2, ramp, { seed: 22 + variant });
  sphere(b, 8, 5, 4.5, 3.4, ramp, { seed: 23 + variant });
  const petal = [["e3", "e4"], ["v3", "v4"], ["y3", "y4"]][variant % 3];
  const r = rng(40 + variant);
  for (let i = 0; i < 7; i += 1) {
    const x = 2 + Math.floor(r() * 12);
    const y = 2 + Math.floor(r() * 6);
    if (b.alpha(x, y) !== 255) continue;
    b.set(x, y, petal[1]);
    if (b.alpha(x + 1, y + 1) === 255) b.set(x + 1, y + 1, petal[0]);
  }
  return withOutline(b, "g0");
}

/** Tronco caído con musgo y un hongo. 30×13. */
export function mossLog() {
  const b = new Buf(30, 13);
  shadow(b, 15, 11, 14, 1.6);
  b.rect(4, 3, 22, 7, "o3");
  b.hline(4, 3, 22, "o4");
  b.hline(4, 4, 22, "o4");
  b.hline(4, 9, 22, "o1");
  for (let x = 7; x < 25; x += 5) b.hline(x, 6, 3, "o2");
  // Corte del tronco a la izquierda, anillos.
  b.ellipse(4, 6, 2.6, 3.6, "o4");
  b.ellipse(4, 6, 1.6, 2.2, "o5");
  b.set(4, 6, "o3");
  // Musgo encima.
  for (let x = 8; x < 25; x += 1) {
    const n = hash(x, 1, 33);
    if (n < 0.7) b.set(x, 3, n < 0.35 ? "g4" : "g3");
    if (n < 0.3) b.set(x, 2, "g3");
  }
  // Rama rota.
  b.set(19, 1, "o3"); b.set(20, 0, "o3"); b.set(19, 2, "o2");
  // Hongo chiquito al pie.
  b.set(26, 8, "c3"); b.set(26, 7, "o4"); b.set(25, 7, "o4"); b.set(27, 7, "o3");
  return withOutline(b, "o0");
}

/** Columna rota de una ruina vieja: 0 = alta, 1 = muñón bajo con hiedra. 16×30. */
export function ruinColumn(variant = 0) {
  const b = new Buf(16, 30);
  contact(b, 8, 27, 7, 1.6);
  const top = variant ? 14 : 4;
  // Basa
  b.rect(1, 24, 14, 4, "s3");
  b.hline(1, 24, 14, "s5");
  b.vline(14, 24, 4, "s1");
  b.hline(1, 27, 14, "s1");
  // Fuste acanalado, luz a la izquierda.
  for (let y = top; y < 24; y += 1) for (let x = 3; x < 13; x += 1) {
    const flute = (x - 3) % 3 === 2;
    const tone = x < 5 ? "s5" : x < 8 ? "s4" : x < 11 ? "s3" : "s2";
    b.set(x, y, flute ? (x < 7 ? "s3" : "s1") : tone);
  }
  // Rotura dentada arriba.
  for (let x = 3; x < 13; x += 1) {
    const cut = Math.floor(hash(x, variant, 41) * 4);
    for (let y = top; y < top + cut; y += 1) b.data[y * b.w + x] = 0;
    b.set(x, top + cut, x < 7 ? "s5" : "s4");
  }
  // Grieta y liquen.
  for (let y = top + 5; y < 22; y += 3) b.set(8 + (y % 2), y, "s1");
  b.set(4, 20, "l3"); b.set(5, 21, "l2"); b.set(11, 17, "t2");
  if (variant) {
    // Hiedra que trepa.
    for (let y = top + 2; y < 24; y += 1) if (hash(1, y, 43) < 0.7) b.set(3 + (y % 3 === 0 ? 1 : 0), y, y % 2 ? "g3" : "g2");
    b.set(4, top + 3, "g4"); b.set(5, top + 5, "g4");
  }
  return withOutline(b, "s0");
}

/** Bloques caídos de una ruina, medio enterrados. 24×12. */
export function ruinBlocks() {
  const b = new Buf(24, 12);
  shadow(b, 12, 10, 11, 1.6);
  const block = (x, y, w, h) => {
    b.rect(x, y, w, h, "s3");
    b.hline(x, y, w, "s5");
    b.vline(x, y, h, "s4");
    b.vline(x + w - 1, y, h, "s2");
    b.hline(x, y + h - 1, w, "s1");
  };
  block(2, 5, 9, 5);
  block(12, 3, 8, 7);
  block(9, 8, 6, 3);
  b.set(14, 5, "s1"); b.set(15, 6, "s1");
  b.set(3, 4, "g3"); b.set(4, 4, "g4"); b.set(19, 9, "g3"); b.set(20, 9, "g2");
  return withOutline(b, "s0");
}

/** Mojón de piedra en los cruces de camino, con una marca tallada. 12×16. */
export function milestone() {
  const b = new Buf(12, 16);
  contact(b, 6, 14, 5, 1.3);
  for (let y = 2; y < 14; y += 1) for (let x = 2; x < 10; x += 1) {
    if (y < 4 && (x === 2 || x === 9)) continue;
    if (y === 2 && (x === 3 || x === 8)) continue;
    b.set(x, y, x < 4 ? "s5" : x < 7 ? "s4" : x < 9 ? "s3" : "s2");
  }
  b.hline(2, 13, 8, "s1");
  // Marca: flecha tallada y un número.
  b.vline(6, 5, 5, "s1"); b.set(6, 4, "s1"); b.set(5, 5, "s1"); b.set(7, 5, "s1"); b.set(4, 6, "s2"); b.set(8, 6, "s2");
  b.hline(4, 11, 4, "s2");
  b.set(3, 12, "g3"); b.set(2, 12, "g4"); b.set(9, 12, "g2");
  return withOutline(b, "s0");
}

// ---------- Calcomanías planas (se hornean en el suelo) ----------

/** Piedritas sueltas. tone: "stone" | "sand" | "snow". 3 variantes. ~9×5. */
export function pebbles(variant = 0, tone = "stone") {
  const R = { stone: ["s1", "s3", "s4", "s5"], sand: ["d2", "d3", "d5", "d6"], snow: ["s2", "s4", "n3", "n4"] }[tone];
  const b = new Buf(10, 6);
  const layouts = [
    [[1, 2, 2], [5, 1, 3], [7, 4, 1]],
    [[2, 3, 3], [6, 3, 1], [4, 0, 1]],
    [[1, 1, 1], [4, 2, 2], [7, 1, 2], [3, 4, 1]],
  ][variant % 3];
  for (const [x, y, w] of layouts) {
    b.hline(x, y + 1, w, R[0]);
    b.hline(x, y, w, R[2]);
    b.set(x, y, R[3]);
    if (w > 2) b.set(x + w - 1, y, R[1]);
  }
  return b;
}

/** Charco con reflejo del cielo. 0 = alargado, 1 = redondo. */
export function puddle(variant = 0) {
  const [w, h, rx, ry] = variant ? [14, 8, 6, 3] : [20, 7, 9, 2.6];
  const b = new Buf(w, h);
  b.ellipse(w / 2, h / 2, rx + 1, ry + 1, "d2");
  b.ellipse(w / 2, h / 2, rx, ry, "w2");
  b.ellipse(w / 2 + 1, h / 2 + 0.5, rx - 1.5, ry - 0.8, "w3");
  // Reflejo: una raya clara arriba a la izquierda.
  b.hline(Math.round(w / 2 - rx / 2), Math.floor(h / 2 - ry / 2), Math.max(2, Math.round(rx / 2)), "w5");
  b.set(Math.round(w / 2 + rx / 2), Math.floor(h / 2), "w4");
  // Canto de lodo abajo.
  for (let x = 0; x < w; x += 1) {
    let y = h - 1;
    while (y > 0 && !b.alpha(x, y)) y -= 1;
    if (b.alpha(x, y)) b.set(x, y, "d1");
  }
  return b;
}

/**
 * Huellas en el camino. kind: "boot" (pisadas que suben), "hoof" (herraduras), "cart" (rodadas cortas).
 * `soil`: "dirt" | "snow" | "sand" elige el tono de la huella.
 */
export function footprints(kind = "boot", soil = "dirt") {
  const T2 = { dirt: ["d1", "d2"], snow: ["n1", "n2"], sand: ["d3", "d4"] }[soil];
  if (kind === "cart") {
    const b = new Buf(12, 16);
    for (let y = 0; y < 16; y += 1) {
      const dx = Math.round(Math.sin(y * 0.3) * 0.6);
      if (hash(0, y, 51) < 0.85) b.set(1 + dx, y, T2[0]);
      if (hash(1, y, 51) < 0.85) b.set(10 + dx, y, T2[0]);
      if (y % 3 === 0) { b.set(2 + dx, y, T2[1]); b.set(11 + dx, y, T2[1]); }
    }
    return b;
  }
  const b = new Buf(10, 16);
  const steps = kind === "hoof" ? [[1, 12], [6, 8], [2, 3]] : [[1, 11], [5, 6], [1, 1]];
  for (const [x, y] of steps) {
    if (kind === "hoof") {
      // Herradura: una U abierta hacia arriba.
      b.set(x, y, T2[0]); b.set(x + 2, y, T2[0]);
      b.set(x, y + 1, T2[0]); b.set(x + 2, y + 1, T2[0]);
      b.hline(x, y + 2, 3, T2[0]);
      b.set(x + 1, y + 1, T2[1]);
    } else {
      // Bota: suela de 2×3 y tacón separado.
      b.rect(x, y, 2, 3, T2[1]);
      b.hline(x, y + 2, 2, T2[0]);
      b.hline(x, y + 4, 2, T2[0]);
    }
  }
  return b;
}

/** Hojarasca: hojas sueltas del piso del bosque (se hornea entre los árboles). */
export function leafLitter(variant = 0, autumn = false) {
  const b = new Buf(12, 8);
  const cols = autumn ? ["r3", "y2", "o4", "r2"] : ["o3", "o4", "t2", "f2"];
  const r = rng(61 + variant);
  for (let i = 0; i < 6; i += 1) {
    const x = Math.floor(r() * 10);
    const y = Math.floor(r() * 7);
    const c2 = cols[Math.floor(r() * cols.length)];
    b.set(x, y, c2);
    if (r() < 0.6) b.set(x + 1, y, c2);
  }
  return b;
}

// ---------- Construcciones pequeñas ----------

export function fence(vertical = false) {
  const b = new Buf(16, 16);
  if (vertical) {
    b.rect(6, 0, 4, 16, "o3");
    b.vline(6, 0, 16, "o4");
    b.vline(9, 0, 16, "o2");
    for (let y = 3; y < 16; y += 8) b.hline(6, y, 4, "o1");
    return withOutline(b, "o0");
  }
  b.rect(0, 5, 16, 2, "o4");
  b.rect(0, 10, 16, 2, "o3");
  b.hline(0, 7, 16, "o1");
  b.hline(0, 12, 16, "o1");
  b.rect(1, 2, 3, 13, "o3");
  b.vline(1, 2, 13, "o4");
  b.vline(3, 2, 13, "o2");
  b.set(2, 2, "o5");
  b.hline(0, 15, 16, rgba("ink", 70));
  return withOutline(b, "o0");
}

export function sign() {
  const b = new Buf(16, 18);
  contact(b, 8, 16, 2.5, 1);
  b.rect(7, 9, 2, 8, "o2");
  b.rect(1, 2, 14, 8, "o4");
  b.hline(1, 2, 14, "o5");
  b.hline(1, 9, 14, "o2");
  b.hline(3, 4, 9, "o2");
  b.hline(3, 6, 7, "o2");
  b.hline(11, 6, 2, "o2");
  return withOutline(b, "o0");
}

/** Letrero de salida: poste con una tabla en punta de flecha (apunta a la derecha; se voltea). 18×20. */
export function waySign() {
  const b = new Buf(18, 20);
  contact(b, 6, 18, 2.5, 1);
  b.rect(5, 8, 2, 11, "o2");
  b.set(5, 8, "o3");
  // Tabla en flecha
  b.rect(1, 2, 12, 7, "o4");
  for (let i = 0; i < 4; i += 1) b.rect(13 + i, 2 + i, 1, 7 - i * 2, "o4");
  b.hline(1, 2, 12, "o5");
  b.hline(1, 8, 12, "o2");
  // Flecha pintada en rojo sobre la tabla
  b.hline(3, 5, 8, "r3");
  b.rect(9, 4, 1, 3, "r3");
  b.set(10, 5, "r3");
  b.set(8, 3, "r2");
  b.set(8, 7, "r2");
  return withOutline(b, "o0");
}

export function barrel() {
  const b = new Buf(12, 16);
  shadow(b, 6, 14, 5, 1.5);
  for (let y = 2; y < 14; y += 1) {
    const bulge = y > 4 && y < 12 ? 1 : 0;
    for (let x = 1 - bulge; x < 11 + bulge; x += 1) {
      const t = (x + 1) / 12;
      b.set(x, y, t < 0.25 ? "o4" : t < 0.6 ? "o3" : t < 0.85 ? "o2" : "o1");
    }
  }
  b.ellipse(6, 2.5, 5, 2, "o4");
  b.ellipse(6, 2.5, 3.5, 1.2, "o2");
  [4, 11].forEach((y) => { for (let x = 0; x < 12; x += 1) if (b.alpha(x, y)) b.set(x, y, x < 5 ? "s4" : "s2"); });
  return withOutline(b, "o0");
}

export function crate() {
  const b = new Buf(14, 15);
  shadow(b, 7, 13, 6, 1.5);
  b.rect(1, 1, 12, 11, "o4");
  b.rect(1, 1, 12, 3, "o5");
  b.rect(1, 4, 12, 8, "o3");
  b.hline(1, 4, 12, "o2");
  for (let x = 1; x < 13; x += 1) b.set(x, 4 + Math.round(((x - 1) / 11) * 7), "o2");
  b.vline(12, 4, 8, "o1");
  return withOutline(b, "o0");
}

export function hay() {
  const b = new Buf(18, 13);
  shadow(b, 9, 11, 8, 1.5);
  for (let y = 1; y < 11; y += 1) for (let x = 1; x < 17; x += 1) {
    const top = y < 4;
    const n = hash(x, y, 3);
    b.set(x, y, top ? (n < 0.5 ? "t4" : "t5") : x > 13 ? "t1" : n < 0.3 ? "t2" : "t3");
  }
  b.vline(5, 4, 7, "o2");
  b.vline(12, 4, 7, "o2");
  return withOutline(b, "t0");
}

export function lamp() {
  const b = new Buf(10, 28);
  contact(b, 5, 26, 3, 1);
  b.rect(4, 8, 2, 18, "s1");
  b.vline(4, 8, 18, "s3");
  b.rect(2, 24, 6, 2, "s1");
  b.rect(2, 2, 6, 6, "y3");
  b.rect(3, 3, 4, 4, "y5");
  b.hline(1, 1, 8, "s1");
  b.hline(2, 8, 6, "s1");
  b.vline(2, 2, 6, "s1");
  b.vline(7, 2, 6, "s1");
  return withOutline(b, "ink");
}

export function well() {
  const b = new Buf(28, 30);
  contact(b, 14, 27, 11, 2);
  // Aro de piedra
  for (let y = 14; y < 26; y += 1) for (let x = 2; x < 26; x += 1) {
    const brick = Math.floor((x + (Math.floor(y / 3) % 2) * 2) / 4);
    const edge = (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0 || y % 3 === 0;
    b.set(x, y, edge ? "s1" : x < 8 ? "s4" : x > 20 ? "s2" : hash(brick, y, 2) < 0.3 ? "s4" : "s3");
  }
  b.ellipse(14, 14, 12, 4, "s4");
  b.ellipse(14, 14, 10, 3, "w1");
  b.ellipse(13, 13.6, 6, 1.4, "w3");
  // Postes y techito
  b.rect(3, 3, 2, 12, "o2");
  b.rect(23, 3, 2, 12, "o1");
  for (let y = 0; y < 5; y += 1) b.hline(1 + y, 1 + y, 26 - y * 2, y < 2 ? "r3" : "r2");
  b.hline(1, 6, 26, "r1");
  b.rect(12, 7, 4, 2, "o3");
  b.vline(14, 9, 4, "c2");
  b.rect(13, 12, 3, 2, "o3");
  return withOutline(b, "ink");
}

/** Puesto de mercado. `sway` (0/1): el fleco del toldo corrido 1 px (segundo cuadro del vaivén). */
export function stall(awning = ["e2", "c4"], goods = ["y3", "e3", "g4"], sway = 0) {
  const b = new Buf(48, 44);
  contact(b, 24, 41, 21, 2);
  // Postes
  b.rect(3, 12, 3, 28, "o2");
  b.rect(42, 12, 3, 28, "o1");
  // Mostrador
  b.rect(1, 26, 46, 13, "o3");
  b.rect(1, 26, 46, 2, "o5");
  b.hline(1, 28, 46, "o2");
  for (let x = 4; x < 46; x += 6) b.vline(x, 29, 10, "o2");
  b.hline(1, 38, 46, "o1");
  // Mercancía sobre el mostrador
  for (let i = 0; i < 7; i += 1) {
    const x = 5 + i * 6;
    const color = goods[i % goods.length];
    b.ellipse(x + 2, 24, 2.5, 2, color);
    b.set(x + 1, 23, "c4");
  }
  // Toldo a rayas con caída ondulada
  for (let y = 0; y < 14; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const stripe = Math.floor(x / 6) % 2;
      let col = awning[stripe];
      if (y < 2) col = stripe ? "c3" : awning[0].replace(/\d$/, (d) => String(Math.max(0, Number(d) - 1)));
      if (y > 10) col = stripe ? "c2" : awning[0].replace(/\d$/, (d) => String(Math.max(0, Number(d) - 1)));
      b.set(x, y + 2, col);
    }
  }
  for (let x = 0; x < 48; x += 1) {
    // El fleco se mece: en el segundo cuadro las puntas se corren un píxel.
    const scallop = Math.floor((((x - sway) % 6) + 6) % 6 / 3);
    b.set(x, 16, scallop ? null : awning[Math.floor(x / 6) % 2]);
    b.set(x, 17, rgba("ink", 90));
  }
  return withOutline(b, "ink");
}

export function chest() {
  const make = (open) => {
    const b = new Buf(16, 16);
    shadow(b, 8, 14, 7, 1.5);
    b.rect(1, 7, 14, 7, "o3");
    b.hline(1, 7, 14, "o4");
    b.vline(14, 7, 7, "o2");
    b.rect(1, 9, 14, 1, "y2");
    if (open) {
      b.rect(1, 2, 14, 4, "o2");
      b.hline(1, 2, 14, "o3");
      b.rect(3, 6, 10, 2, "ink2");
      b.set(6, 6, "y4"); b.set(9, 6, "y3");
    } else {
      b.rect(1, 3, 14, 4, "o4");
      b.hline(1, 3, 14, "o5");
      b.hline(1, 6, 14, "o2");
      b.rect(7, 6, 2, 3, "y3");
      b.set(7, 6, "y5");
    }
    return withOutline(b, "o0");
  };
  return strip([make(false), make(true)]);
}

export function gate() {
  const make = (open) => {
    const b = new Buf(48, 24);
    // Postes de piedra
    [0, 40].forEach((x) => {
      b.rect(x, 2, 8, 20, "s3");
      b.vline(x, 2, 20, "s4");
      b.vline(x + 7, 2, 20, "s1");
      b.rect(x, 1, 8, 2, "s5");
      b.hline(x, 21, 8, "s1");
    });
    if (!open) {
      for (let x = 8; x < 40; x += 1) {
        const plank = (x - 8) % 4;
        b.vline(x, 5, 16, plank === 0 ? "o1" : plank === 1 ? "o4" : "o3");
      }
      b.rect(8, 8, 32, 2, "o2");
      b.rect(8, 16, 32, 2, "o2");
      b.rect(22, 11, 4, 3, "s2");
    } else {
      b.rect(8, 5, 3, 16, "o3");
      b.vline(10, 5, 16, "o1");
      b.rect(37, 5, 3, 16, "o3");
      b.vline(37, 5, 16, "o4");
    }
    return withOutline(b, "ink");
  };
  return strip([make(false), make(true)]);
}

export function lever() {
  const make = (on) => {
    const b = new Buf(12, 14);
    shadow(b, 6, 12, 5, 1.5);
    b.rect(2, 8, 8, 4, "s2");
    b.hline(2, 8, 8, "s4");
    const tip = on ? [9, 1] : [2, 1];
    for (let i = 0; i <= 6; i += 1) {
      const x = Math.round(6 + ((tip[0] - 6) * i) / 6);
      const y = Math.round(8 + ((tip[1] - 8) * i) / 6);
      b.set(x, y, "o3");
    }
    b.rect(tip[0] - 1, tip[1] - 1, 3, 3, on ? "g5" : "e3");
    return withOutline(b, "ink");
  };
  return strip([make(false), make(true)]);
}

/** Barrera del retén de la Corona: pluma a rayas y dos soportes. */
export function barrier() {
  const make = (raised) => {
    const b = new Buf(64, 24);
    shadow(b, 32, 21, 30, 2);
    [2, 58].forEach((x) => {
      b.rect(x, 8, 4, 13, "o3");
      b.vline(x, 8, 13, "o4");
      b.vline(x + 3, 8, 13, "o1");
    });
    if (!raised) {
      for (let x = 2; x < 62; x += 1) {
        const stripe = Math.floor(x / 5) % 2;
        b.set(x, 10, stripe ? "c4" : "b3");
        b.set(x, 11, stripe ? "c2" : "b2");
        b.set(x, 12, "ink2");
      }
    } else {
      for (let y = 0; y < 10; y += 1) {
        const stripe = Math.floor(y / 3) % 2;
        b.set(4, y, stripe ? "c4" : "b3");
        b.set(5, y, stripe ? "c2" : "b2");
      }
    }
    b.rect(28, 14, 8, 6, "b2");
    b.rect(31, 15, 2, 4, "y3");
    return withOutline(b, "ink");
  };
  return strip([make(false), make(true)]);
}

export function tent() {
  const b = new Buf(34, 28);
  shadow(b, 17, 25, 16, 3);
  for (let y = 0; y < 22; y += 1) {
    const half = Math.round(2 + (y / 21) * 14);
    for (let x = -half; x <= half; x += 1) {
      const side = x / half;
      let col = side < -0.3 ? "l3" : side < 0.4 ? "l2" : "l1";
      if (Math.abs(x) < 3 && y > 12) col = "ink2";
      if (y % 6 === 5 && Math.abs(x) >= 3) col = "l1";
      b.set(17 + x, 3 + y, col);
    }
  }
  b.vline(17, 0, 4, "o3");
  b.rect(18, 0, 4, 3, "e2");
  return withOutline(b, "l0");
}

export function campfire() {
  const frames = [0, 1, 2].map((f) => {
    const b = new Buf(16, 18);
    b.ellipse(8, 14, 7, 3, "s2");
    b.ellipse(8, 14, 7, 3, "s3");
    b.ellipse(8, 13.5, 6, 2.5, "s2");
    b.ellipse(8, 14, 5, 2, "ink2");
    b.rect(3, 13, 10, 2, "o2");
    b.hline(4, 12, 8, "o3");
    // Llama en capas: roja por fuera, amarilla, casi blanca en el centro.
    const lean = [0, 1, -1][f];
    const tall = [0, 1, 0.5][f];
    const flame = (rx, top, color) => {
      for (let y = top; y <= 12; y += 1) {
        const t = (y - top) / (12 - top);
        const w = Math.round(rx * Math.sqrt(t));
        const shift = Math.round(lean * (1 - t) * 1.5);
        for (let x = -w; x <= w; x += 1) b.set(8 + x + shift, y, color);
      }
    };
    flame(4, Math.round(2 - tall), "e2");
    flame(3, Math.round(4 - tall), "e3");
    flame(2, Math.round(6 - tall), "y3");
    flame(1, 8, "y5");
    b.set(8 + lean * 2, 0, f === 1 ? "y4" : null);
    b.set(4 - lean, 3, f === 2 ? "e4" : null);
    return b;
  });
  return strip(frames);
}

export function rubble() {
  const b = new Buf(56, 36);
  shadow(b, 28, 32, 26, 4);
  const ramp = ["s1", "s2", "s3", "s4", "s5"];
  const r = rng(91);
  const rocks = [];
  for (let i = 0; i < 14; i += 1) rocks.push([6 + r() * 44, 8 + r() * 20, 4 + r() * 6, 3 + r() * 4]);
  rocks.sort((a, c2) => a[1] - c2[1]).forEach(([x, y, rx, ry], i) => sphere(b, x, y, rx, ry, ramp, { seed: i, grain: 0.1 }));
  b.rect(10, 22, 3, 8, "o2");
  b.rect(38, 18, 14, 3, "o3");
  return withOutline(b, "s0");
}

export function anvil() {
  const b = new Buf(16, 12);
  shadow(b, 8, 10, 7, 1.5);
  b.rect(1, 2, 14, 3, "s3");
  b.hline(1, 2, 14, "s5");
  b.rect(5, 5, 6, 3, "s2");
  b.rect(3, 8, 10, 2, "s1");
  b.set(0, 3, "s3");
  return withOutline(b, "ink");
}

export function forge() {
  const frames = [0, 1].map((f) => {
    const b = new Buf(32, 30);
    shadow(b, 16, 27, 15, 3);
    for (let y = 4; y < 26; y += 1) for (let x = 2; x < 30; x += 1) {
      const edge = (x + (Math.floor(y / 4) % 2) * 3) % 6 === 0 || y % 4 === 0;
      b.set(x, y, edge ? "s1" : x < 8 ? "s4" : x > 24 ? "s2" : "s3");
    }
    b.rect(9, 12, 14, 10, "ink");
    b.rect(10, 14, 12, 8, f ? "e2" : "e3");
    b.rect(12, 17, 8, 5, f ? "y3" : "y4");
    b.rect(14, 19, 4, 3, "y5");
    b.rect(12, 0, 8, 5, "s2");
    b.hline(12, 0, 8, "s4");
    return withOutline(b, "ink");
  });
  return strip(frames);
}

/** Estandarte de la Corona. `sway` (0/1): la punta de la tela se corre 1 px (vaivén). */
export function banner(sway = 0) {
  const b = new Buf(12, 32);
  contact(b, 2, 30, 2, 1);
  b.rect(1, 0, 2, 30, "o2");
  b.set(1, 0, "y4");
  // Tela: la parte de arriba va cosida al asta; de la mitad para abajo se mece.
  for (let y = 2; y < 16; y += 1) {
    const dx = sway && y >= 10 ? 1 : 0;
    b.hline(3 + dx, y, 8, "b2");
    b.set(3 + dx, y, "b3");
    b.set(10 + dx, y, "b1");
  }
  const dx = sway;
  b.set(3 + dx, 16, "b2"); b.set(4 + dx, 17, "b2"); b.set(9 + dx, 16, "b1"); b.set(10 + dx, 17, "b1");
  b.rect(6, 6, 2, 4, "y3");
  b.hline(5, 7, 4, "y3");
  return withOutline(b, "ink");
}

export function log() {
  const b = new Buf(26, 12);
  shadow(b, 13, 10, 12, 1.5);
  b.rect(3, 2, 20, 7, "o3");
  b.hline(3, 2, 20, "o4");
  b.hline(3, 8, 20, "o1");
  for (let x = 6; x < 22; x += 5) b.hline(x, 5, 3, "o2");
  b.ellipse(3, 5.5, 2.5, 3.5, "o4");
  b.ellipse(3, 5.5, 1.5, 2, "o5");
  return withOutline(b, "o0");
}

/** Borde de un escalón de tierra: se baja de un salto, no se sube. */
export function ledge() {
  const b = new Buf(16, 16);
  for (let x = 0; x < 16; x += 1) {
    const dip = (x * 7) % 5 === 0 ? 1 : 0;
    b.set(x, 8 + dip, "g5");
    b.set(x, 9 + dip, "g4");
    for (let y = 10 + dip; y < 14; y += 1) b.set(x, y, y < 12 ? "d3" : "d2");
    b.set(x, 14, "d1");
    b.set(x, 15, rgba("ink", 70));
    if (x % 4 === 2) b.set(x, 12, "d1");
  }
  return b;
}

export function bridgeRail() {
  const b = new Buf(16, 16);
  b.rect(6, 0, 4, 16, "o2");
  b.vline(6, 0, 16, "o4");
  b.vline(9, 0, 16, "o1");
  b.rect(5, 2, 6, 3, "o3");
  b.hline(5, 2, 6, "o5");
  return withOutline(b, "o0");
}

// ---------- Casas ----------

const ROOFS = {
  thatch: { ramp: ["t0", "t1", "t2", "t3", "t4", "t5"], line: "t1" },
  red: { ramp: ["r0", "r1", "r2", "r3", "r4", "r5"], line: "r1" },
  slate: { ramp: ["b0", "s1", "s2", "s3", "s4", "s5"], line: "s1" },
  moss: { ramp: ["f0", "f1", "f2", "f3", "f4", "f5"], line: "f1" },
  // Selva: hojas de palma trenzadas.
  palm: { ramp: ["f1", "l2", "l3", "l4", "t4", "t5"], line: "l1", thatch: true },
  // Desierto: teja de barro clara.
  clay: { ramp: ["r1", "r3", "r4", "d5", "r5", "d6"], line: "r2" },
};

const WALLS = {
  plaster: { base: "c3", shade: "c2", light: "c4", beam: "o2" },
  stone: { base: "s3", shade: "s2", light: "s4", beam: "s1" },
  timber: { base: "o4", shade: "o3", light: "o5", beam: "o1" },
  adobe: { base: "d5", shade: "d4", light: "d6", beam: "d3" },
};

/**
 * Casa en vista 3/4. w×h en píxeles. El techo ocupa ~55 % del alto.
 * Devuelve { buf, door: {x,y} } — la puerta en coordenadas del sprite.
 */
export function house({ w = 64, h = 64, roof = "thatch", wall = "plaster", chimney = true, seed = 1, windows = 2, lit = true, snowRoof = false } = {}) {
  const b = new Buf(w, h);
  const R = ROOFS[roof];
  const Wl = WALLS[wall];
  const roofH = Math.round(h * 0.56);
  const wallTop = roofH - 2;
  const base = h - 3;
  // Sin mancha horneada: la sombra de la casa la pone el mapa (mapbuild.js), corta a la derecha y abajo.
  contact(b, w / 2, h - 2, w / 2 - 3, 1.5);

  // Muros
  for (let y = wallTop; y < base; y += 1) {
    for (let x = 3; x < w - 3; x += 1) {
      let col = x > w - 12 ? Wl.shade : Wl.base;
      if (wall === "stone") {
        const bx = (x + (Math.floor(y / 4) % 2) * 3) % 7;
        if (bx === 0 || y % 4 === 0) col = "s1";
        else if (hash(Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 7), Math.floor(y / 4), seed) < 0.3) col = Wl.light;
      }
      b.set(x, y, col);
    }
  }
  if (wall !== "stone") {
    [3, w - 4].forEach((x) => b.vline(x, wallTop, base - wallTop, Wl.beam));
    b.hline(3, wallTop + Math.floor((base - wallTop) / 2), w - 6, Wl.beam);
  }
  // Zócalo de piedra
  for (let x = 3; x < w - 3; x += 1) {
    b.set(x, base, x % 5 === 0 ? "s1" : "s3");
    b.set(x, base + 1, "s2");
  }
  // Sombra del alero sobre el muro
  b.hline(3, wallTop, w - 6, "ink2");
  b.hline(3, wallTop + 1, w - 6, rgba("ink", 110));

  // Puerta
  const dw = 10;
  const dx = Math.round(w / 2 - dw / 2 + (seed % 2 ? 8 : -8) * (w > 60 ? 1 : 0));
  const dh = 14;
  const dy = base - dh + 1;
  b.rect(dx - 1, dy - 1, dw + 2, dh + 1, "o1");
  for (let x = 0; x < dw; x += 1) b.vline(dx + x, dy, dh, x % 3 === 0 ? "o2" : x < dw / 2 ? "o4" : "o3");
  b.set(dx + dw - 3, dy + 7, "y3");
  b.hline(dx - 1, base + 1, dw + 2, "s4");

  // Ventanas
  const slots = [];
  const winY = wallTop + 5;
  if (windows >= 1) slots.push(dx - 14 > 5 ? dx - 14 : dx + dw + 4);
  if (windows >= 2) slots.push(dx + dw + 6 < w - 13 ? dx + dw + 6 : 6);
  for (const wx of slots) {
    b.rect(wx - 1, winY - 1, 10, 9, "o1");
    b.rect(wx, winY, 8, 7, lit ? "y3" : "w2");
    b.rect(wx, winY, 4, 3, lit ? "y5" : "w4");
    b.vline(wx + 4, winY, 7, "o2");
    b.hline(wx, winY + 3, 8, "o2");
    // Jardinera con flores
    b.rect(wx - 1, winY + 8, 10, 2, "o3");
    for (let k = 0; k < 4; k += 1) b.set(wx + k * 2 + 1, winY + 7, k % 2 ? "e3" : "y4");
  }

  // Techo: trapecio a cuatro aguas visto de frente.
  const top = 3;
  for (let y = top; y < roofH; y += 1) {
    const t = (y - top) / (roofH - top);
    const inset = Math.round((1 - t) * 7);
    for (let x = inset; x < w - inset; x += 1) {
      const u = (x - inset) / Math.max(1, w - inset * 2);
      let tone = u < 0.2 ? 4 : u < 0.72 ? 3 : 2;
      if (y < top + 3) tone = 5;
      if (y > roofH - 3) tone = 1;
      let col = R.ramp[tone];
      if (roof === "thatch" || R.thatch) {
        const streak = hash(x, Math.floor(y / 3), seed) < 0.2;
        if (streak) col = R.ramp[Math.max(0, tone - 1)];
        if ((y - top) % 6 === 5 && bayer(x, y) < 0.7) col = R.line;
      } else {
        const row = Math.floor((y - top) / 4);
        const lx = (x + (row % 2) * 3) % 6;
        if ((y - top) % 4 === 3) col = R.line;
        else if (lx === 0) col = R.ramp[Math.max(0, tone - 1)];
        else if ((y - top) % 4 === 0 && tone < 5) col = R.ramp[Math.min(5, tone + 1)];
      }
      b.set(x, y, col);
    }
  }
  // Canto del alero
  for (let x = 0; x < w; x += 1) {
    if (b.alpha(x, roofH - 1)) b.set(x, roofH - 1, R.ramp[0]);
  }
  // Nieve acumulada: manto arriba que baja en goterones irregulares, y carámbanos en el alero.
  if (snowRoof) {
    for (let x = 0; x < w; x += 1) {
      const depth = 6 + Math.floor(hash(x >> 2, 3, seed) * 7) + (hash(x, 5, seed) < 0.3 ? 2 : 0);
      for (let y = top; y < top + depth; y += 1) {
        if (!b.alpha(x, y)) continue;
        b.set(x, y, y === top + depth - 1 ? "n2" : x < w * 0.25 ? "n4" : x > w * 0.75 ? "n3" : "white");
      }
      if (x % 5 === 2 && b.alpha(x, roofH - 1)) { b.set(x, roofH, "n4"); if (x % 10 === 2) b.set(x, roofH + 1, "n3"); }
    }
  }
  // Chimenea
  if (chimney) {
    const cx = w - 18;
    b.rect(cx, 0, 7, 10, "s3");
    b.vline(cx, 0, 10, "s4");
    b.vline(cx + 6, 0, 10, "s1");
    b.hline(cx - 1, 0, 9, "s4");
    b.hline(cx, 10, 7, R.ramp[0]);
  }
  withOutline(b, "ink");
  return { buf: b, door: { x: dx + dw / 2, y: base + 1 }, roofH };
}

/** Humo de chimenea: bolita que se deshace. */
export function smoke() {
  const frames = [0, 1, 2, 3].map((f) => {
    const b = new Buf(8, 8);
    const r = 1.5 + f * 0.7;
    b.ellipse(4, 4, r, r, f < 2 ? "c3" : "c2");
    if (f < 3) b.ellipse(3.4, 3.4, r * 0.5, r * 0.5, "c4");
    return b;
  });
  return strip(frames);
}

export { sphere, shadow, contact, withOutline };
