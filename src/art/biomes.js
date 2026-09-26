/**
 * Objetos de selva, desierto y nieve, y los huecos de alijo. Misma luz y contornos que props.js.
 */

import { Buf, hash, rng, strip } from "./pixel.js";
import { rgba } from "./palette.js";
import { sphere, shadow, contact, withOutline } from "./props.js";

/** Trazo grueso por una curva: t ∈ [0,1] → punto; ancho y color por tramo. */
function stroke(b, pointAt, widthAt, colorAt, steps = 60) {
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const [x, y] = pointAt(t);
    const r = widthAt(t) / 2;
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy += 1) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx += 1) {
        const dx = xx + 0.5 - x;
        const dy = yy + 0.5 - y;
        if (dx * dx + dy * dy <= r * r + 0.2) b.set(xx, yy, colorAt(t, dx, dy));
      }
    }
  }
}

// ---------- Selva ----------

/**
 * Palmera. `sway` (0/1): las puntas de las pencas se corren 1 px (segundo cuadro del vaivén).
 * `small`: palmera joven (32×36), tronco corto y pencas más cortas.
 */
export function palm(variant = 0, sway = 0, small = false) {
  const k = small ? 0.68 : 1;
  const W = small ? 32 : 40;
  const H = small ? 36 : 48;
  const b = new Buf(W, H);
  const fx = W / 2;
  const fy = H - 2;
  contact(b, fx, fy - 1, small ? 3 : 4, 1.5);
  const lean = (variant % 2 ? -4 : 5) * k;
  // Tronco curvo en anillos.
  stroke(b, (t) => [fx + lean * t * t, fy - t * 30 * k], () => (small ? 3.4 : 4.2), (t, dx) => {
    const ring = Math.floor((1 - t) * 30) % 3 === 0;
    if (ring) return "o2";
    return dx < -0.8 ? "o5" : dx > 0.8 ? "o2" : "o4";
  });
  const cx = fx + lean;
  const cy = fy - 31 * k;
  const r = rng(51 + variant);
  const fronds = [200, 235, 270, 305, 340, 20, 160, 110].map((a) => a + (r() - 0.5) * 18);
  for (const deg of fronds) {
    const a = (deg * Math.PI) / 180;
    const len = (13 + r() * 5) * k;
    const droop = (7 + r() * 4) * k;
    const px = (t) => cx + Math.cos(a) * len * t + sway * t * t * 1.4;
    const py = (t) => cy + Math.sin(a) * len * t * 0.8 + droop * t * t;
    stroke(b, (t) => [px(t), py(t)], (t) => 1 + 3.2 * k * Math.sin(Math.PI * Math.min(1, t * 1.1)), (t, dx, dy) => {
      if (Math.abs(dy) < 0.5 && t < 0.8) return "f2";
      return dy < 0 ? (t < 0.5 ? "g4" : "g5") : t < 0.5 ? "g3" : "f4";
    });
  }
  // Cocos.
  if (!small) [[cx - 2, cy + 2], [cx + 1, cy + 3], [cx - 1, cy + 4]].forEach(([x, y]) => { b.ellipse(x, y, 1.6, 1.6, "o2"); b.set(Math.round(x - 0.5), Math.round(y - 1), "o4"); });
  return withOutline(b, "f0");
}

/** Árbol de selva. `sway` (0/1): los racimos de arriba corridos 1 px (vaivén). */
export function jungleTree(variant = 0, sway = 0) {
  const b = new Buf(44, 50);
  contact(b, 22, 46, 7, 2);
  // Tronco con raíces de contrafuerte.
  b.rect(18, 28, 8, 17, "o2");
  b.vline(18, 28, 17, "o3");
  b.vline(25, 28, 17, "o1");
  for (const [x, dir] of [[18, -1], [25, 1]]) {
    for (let i = 0; i < 5; i += 1) { b.set(x + dir * i, 44 - Math.floor(i / 2), "o2"); b.set(x + dir * i, 45 - Math.floor(i / 2), "o1"); }
  }
  const ramp = ["f0", "f1", "f2", "f3", "f4", "g4"];
  const rr = rng(31 + variant * 5);
  const clumps = [[22, 14, 14, 10], [11, 20, 9, 7], [33, 20, 9, 7], [22, 25, 12, 6], [15, 10, 8, 6], [29, 10, 8, 6], [22, 6, 9, 6]]
    .map(([x, y, rx, ry]) => [x + Math.round((rr() - 0.5) * 3) + (y < 15 ? sway : 0), y + Math.round((rr() - 0.5) * 2), rx, ry]);
  clumps.sort((a, c) => a[1] - c[1]).forEach(([x, y, rx, ry], i) => sphere(b, x, y, rx, ry, ramp, { seed: variant * 11 + i, grain: 0.26 }));
  // Lianas que cuelgan.
  for (let k = 0; k < 5; k += 1) {
    const x = 8 + Math.floor(rr() * 28);
    const len = 5 + Math.floor(rr() * 10);
    let y0 = 26;
    while (y0 > 0 && !b.alpha(x, y0)) y0 -= 1;
    for (let y = y0; y < y0 + len; y += 1) {
      b.set(x + (Math.floor(y / 4) % 2), y, "f2");
      if (y % 3 === 0) b.set(x + 1 + (Math.floor(y / 4) % 2), y, "g3");
    }
  }
  for (let i = 0; i < 7; i += 1) {
    const x = 6 + Math.floor(rr() * 32);
    const y = 3 + Math.floor(rr() * 16);
    if (b.alpha(x, y) === 255) b.set(x, y, "g5");
  }
  return withOutline(b, "f0");
}

export function fern() {
  const b = new Buf(18, 14);
  const r = rng(9);
  for (const deg of [200, 230, 260, 290, 320, 340]) {
    const a = (deg * Math.PI) / 180;
    const len = 7 + r() * 2;
    stroke(b, (t) => [9 + Math.cos(a) * len * t, 13 + Math.sin(a) * len * t + 3 * t * t], (t) => 1 + 2 * Math.sin(Math.PI * t), (t, dx, dy) => (dy < 0 ? "g4" : t > 0.6 ? "g2" : "g3"));
  }
  return withOutline(b, "f0");
}

// ---------- Desierto ----------

export function cactus(variant = 0) {
  const b = new Buf(22, 30);
  contact(b, 11, 27, 4, 1.5);
  const ramp = ["f1", "f2", "f3", "f4", "f5"];
  const col = (x, y0, y1, w) => {
    for (let y = y0; y <= y1; y += 1) {
      for (let dx = -w; dx <= w; dx += 1) {
        const u = dx / w;
        const tone = u < -0.4 ? 4 : u < 0.2 ? 3 : u < 0.6 ? 2 : 1;
        b.set(x + dx, y, ramp[tone]);
      }
    }
    b.ellipse(x, y0, w + 0.4, w * 0.8, ramp[4]);
  };
  col(11, 5, 26, 3);
  const arms = variant % 2 ? [[5, 10, 17, 18, -1]] : [[5, 12, 16, 19, -1], [17, 9, 12, 15, 1]];
  for (const [x, top, bend, bottom, dir] of arms) {
    col(x, top, bend, 2);
    for (let xx = Math.min(x, 11); xx <= Math.max(x, 11); xx += 1) for (let y = bend; y <= bend + 3; y += 1) b.set(xx, y, y === bend ? ramp[3] : ramp[2]);
    void bottom; void dir;
  }
  // Espinas.
  for (let i = 0; i < 14; i += 1) {
    const x = 5 + Math.floor(hash(i, 1, variant) * 13);
    const y = 6 + Math.floor(hash(i, 2, variant) * 19);
    if (b.alpha(x, y) === 255) b.set(x, y, "c4");
  }
  if (variant % 3 === 0) { b.set(11, 3, "e3"); b.set(10, 4, "e4"); b.set(12, 4, "e4"); }
  return withOutline(b, "f0");
}

export function dryBush() {
  const b = new Buf(16, 12);
  shadow(b, 8, 10, 6, 1.5);
  const r = rng(4);
  for (let k = 0; k < 9; k += 1) {
    const a = Math.PI + (k / 8) * Math.PI;
    const len = 4 + r() * 3;
    stroke(b, (t) => [8 + Math.cos(a) * len * t, 10 + Math.sin(a) * len * t], () => 1, (t) => (t > 0.6 ? "t3" : "o2"), 12);
  }
  return withOutline(b, "o0");
}

export function sandRock(big = false) {
  const w = big ? 30 : 18;
  const h = big ? 22 : 14;
  const b = new Buf(w, h);
  if (big) contact(b, w / 2, h - 2.5, w / 2 - 4, 2);
  else shadow(b, w / 2, h - 2.5, w / 2 - 1, 2.5);
  const ramp = ["d1", "d2", "d3", "d4", "d5"];
  if (big) {
    sphere(b, 11, 12, 10, 8, ramp, { seed: 3, grain: 0.12 });
    sphere(b, 20, 14, 8, 6, ramp, { seed: 4, grain: 0.12 });
    for (let x = 5; x < 26; x += 1) if (b.alpha(x, 12) === 255 && x % 3) b.set(x, 12, "d2");
  } else {
    sphere(b, 9, 8, 7, 5.5, ramp, { seed: 3, grain: 0.12 });
    b.hline(4, 8, 9, "d2");
  }
  return withOutline(b, "d0");
}

// ---------- Nieve ----------

/** Árbol pelado. `variant` cambia la forma: 0 = copa en V, 1 = torcido y bajo, 2 = alto y ralo. */
export function bareTree(snow = true, variant = 0) {
  const b = new Buf(30, 40);
  contact(b, 15, 37, 4, 1.5);
  const [spreadL, spreadR, first, shrink] = [[0.45, 0.4, 13, 0.68], [0.6, 0.35, 10, 0.74], [0.35, 0.5, 11, 0.75]][variant % 3];
  const branch = (x, y, a, len, w, depth) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    stroke(b, (t) => [x + (x2 - x) * t, y + (y2 - y) * t], () => w, (t, dx) => (dx < 0 ? "o2" : "o1"), 20);
    if (snow) for (let t = 0.2; t < 1; t += 0.15) {
      const sx = Math.round(x + (x2 - x) * t);
      const sy = Math.round(y + (y2 - y) * t - w / 2 - 0.5);
      if (Math.abs(Math.sin(a)) < 0.85) b.set(sx, sy, hash(sx, sy, 2) < 0.5 ? "n4" : "white");
    }
    if (depth > 0) {
      branch(x2, y2, a - spreadL, len * shrink, Math.max(1, w - 1), depth - 1);
      branch(x2, y2, a + spreadR, len * (shrink - 0.06), Math.max(1, w - 1), depth - 1);
    }
  };
  branch(15, 37, -Math.PI / 2 + (variant === 1 ? 0.18 : 0), first, 4, 3);
  return withOutline(b, "ink2");
}

/** Montículo de nieve blanda, con sombra azulada abajo a la derecha. 0 = largo, 1 = doble. 20×9. */
export function snowMound(variant = 0) {
  const b = new Buf(20, 9);
  shadow(b, 10, 7.5, 9, 1.5);
  const ramp = ["n1", "n2", "n3", "n4", "white"];
  if (variant) {
    sphere(b, 6, 6, 5, 3, ramp, { seed: 71, grain: 0.05, rim: false });
    sphere(b, 13, 5.5, 6, 3.4, ramp, { seed: 72, grain: 0.05, rim: false });
  } else sphere(b, 10, 5.5, 8.5, 3.2, ramp, { seed: 73, grain: 0.05, rim: false });
  // Pasto seco que asoma.
  b.set(4, 3, "t2"); b.set(5, 2, "t3"); b.set(15, 2, "t2");
  return withOutline(b, "n0");
}

/** Cactus bola chico con flor. 12×12. */
export function cactusSmall() {
  const b = new Buf(12, 12);
  contact(b, 6, 10, 4, 1.2);
  sphere(b, 6, 6.5, 4.2, 4, ["f1", "f2", "f3", "f4", "f5"], { seed: 81, grain: 0.1 });
  for (let x = 3; x < 10; x += 2) b.vline(x, 4, 5, "f2");
  [[3, 5], [8, 4], [5, 8], [9, 7]].forEach(([x, y]) => b.set(x, y, "c4"));
  b.set(6, 2, "e3"); b.set(5, 2, "e4"); b.set(7, 2, "e4"); b.set(6, 1, "y4");
  return withOutline(b, "f0");
}

/** Huesos al sol (calcomanía del desierto): costillas y un cráneo chico. 14×7. */
export function bones() {
  const b = new Buf(14, 7);
  for (let i = 0; i < 4; i += 1) {
    b.set(1 + i * 2, 2, "c3"); b.set(1 + i * 2, 3, "c4"); b.set(2 + i * 2, 4, "c2");
  }
  b.hline(1, 5, 8, "c2");
  b.rect(10, 2, 3, 3, "c4");
  b.set(10, 3, "d1"); b.set(12, 3, "d1");
  b.hline(10, 5, 3, "c2");
  return b;
}

export function snowRock(big = false) {
  const w = big ? 28 : 16;
  const h = big ? 22 : 14;
  const b = new Buf(w, h);
  if (big) contact(b, w / 2, h - 2.5, w / 2 - 4, 2);
  else shadow(b, w / 2, h - 2.5, w / 2 - 1, 2.5);
  const ramp = ["s1", "s2", "s3", "s4", "s5"];
  if (big) {
    sphere(b, 11, 11, 10, 8.5, ramp, { seed: 8, grain: 0.1 });
    sphere(b, 18, 13, 8, 6.5, ramp, { seed: 9, grain: 0.1 });
  } else sphere(b, 8, 7.5, 6.5, 5.5, ramp, { seed: 8, grain: 0.1 });
  // Capa de nieve arriba.
  for (let x = 0; x < w; x += 1) {
    let y = 0;
    while (y < h && b.alpha(x, y) < 255) y += 1;
    const depth = 2 + Math.floor(hash(x >> 1, 1, 3) * 3);
    for (let k = 0; k < depth && y + k < h; k += 1) if (b.alpha(x, y + k) === 255) b.set(x, y + k, k === depth - 1 ? "n2" : x < w / 3 ? "white" : "n4");
  }
  return withOutline(b, "s0");
}

export function iceBlock() {
  const b = new Buf(16, 16);
  shadow(b, 8, 14, 7, 1.5);
  b.rect(2, 3, 12, 10, "w4");
  b.rect(2, 3, 12, 3, "n4");
  b.vline(2, 3, 10, "w5");
  b.vline(13, 3, 10, "w3");
  b.hline(2, 12, 12, "w3");
  b.set(5, 7, "w6"); b.set(6, 8, "w6"); b.set(9, 5, "white");
  return withOutline(b, "w1");
}

// ---------- Alijos ----------

/**
 * Hueco natural para alijo. Cuadro 0: hueco vacío. Cuadro 1: alijo armado (tapa, soga y trapo rojo).
 * kind: tree | rock | snow
 */
export function stashSpot(kind = "tree") {
  const frames = [false, true].map((built) => {
    const b = new Buf(24, 26);
    shadow(b, 12, 23, 10, 2.5);
    if (kind === "tree") {
      // Tocón grueso y viejo, con raíces y un hueco.
      b.rect(4, 6, 16, 16, "o3");
      b.vline(4, 6, 16, "o4");
      b.vline(5, 6, 16, "o4");
      b.vline(19, 6, 16, "o1");
      b.vline(18, 6, 16, "o2");
      b.ellipse(12, 6, 8, 3, "o4");
      b.ellipse(12, 6, 6, 2, "o5");
      b.ellipse(12, 6, 3, 1, "o3");
      for (let y = 8; y < 22; y += 4) b.hline(7, y, 2, "o2");
      [[2, 21], [21, 21], [3, 20], [20, 20]].forEach(([x, y]) => b.set(x, y, "o2"));
      b.ellipse(12, 15, 3.5, 4.5, "ink2");
      b.ellipse(12, 16, 2.5, 3, "ink");
      sphere(b, 5, 5, 3, 2.5, ["f1", "f2", "f3", "f4"], { seed: 2 });
    } else {
      const ramp = kind === "snow" ? ["s1", "s2", "s3", "s4", "s5"] : ["d1", "d2", "d3", "d4", "d5"];
      if (kind === "rock") ramp.splice(0, 5, "s1", "s2", "s3", "s4", "s5");
      sphere(b, 9, 14, 8, 8, ramp, { seed: 5, grain: 0.1 });
      sphere(b, 16, 16, 7, 6, ramp, { seed: 6, grain: 0.1 });
      // Grieta oscura.
      for (let y = 9; y < 21; y += 1) { b.set(12 + (y % 3 === 0 ? 1 : 0), y, "ink"); if (y > 13) b.set(13 + (y % 3 === 0 ? 1 : 0), y, "ink2"); }
      if (kind === "snow") for (let x = 1; x < 23; x += 1) {
        let y = 0;
        while (y < 25 && b.alpha(x, y) < 255) y += 1;
        for (let k = 0; k < 3; k += 1) if (b.alpha(x, y + k) === 255) b.set(x, y + k, k === 2 ? "n2" : "n4");
      }
    }
    if (built) {
      // Tapa de tablas atada con soga y un trapo rojo: "esto es tuyo".
      const [cx, cy] = kind === "tree" ? [12, 15] : [12, 15];
      b.rect(cx - 4, cy - 3, 8, 7, "o4");
      b.hline(cx - 4, cy - 3, 8, "o5");
      b.hline(cx - 4, cy, 8, "o2");
      b.vline(cx + 3, cy - 3, 7, "o2");
      b.hline(cx - 5, cy + 1, 10, "t3");
      b.set(cx + 4, cy - 4, "e3"); b.set(cx + 5, cy - 4, "e2"); b.set(cx + 5, cy - 3, "e3");
    }
    return withOutline(b, "ink");
  });
  return strip(frames);
}

// ---------- Pueblos ----------

/** Barca en el muelle (vista 3/4). */
export function boat() {
  const b = new Buf(56, 30);
  b.ellipse(28, 24, 26, 4, rgba("w1", 160));
  // Casco
  for (let y = 10; y < 25; y += 1) {
    const t = (y - 10) / 15;
    const half = Math.round(25 - t * t * 10);
    for (let x = 28 - half; x <= 28 + half; x += 1) {
      const u = (x - (28 - half)) / (half * 2);
      b.set(x, y, y < 13 ? (u < 0.5 ? "o5" : "o4") : u < 0.25 ? "o4" : u > 0.8 ? "o1" : "o3");
    }
  }
  b.ellipse(28, 12, 20, 3, "o2");
  b.ellipse(28, 12.5, 18, 2, "o1");
  for (let x = 12; x < 45; x += 6) b.vline(x, 13, 10, "o2");
  b.hline(6, 17, 44, "e2");
  // Mástil y vela recogida
  b.rect(27, 0, 2, 12, "o2");
  b.rect(22, 3, 12, 3, "c3");
  b.hline(22, 5, 12, "c1");
  return withOutline(b, "ink");
}

/** Blanco de tiro de la arquera. */
export function targetDummy() {
  const b = new Buf(18, 26);
  shadow(b, 9, 24, 6, 1.5);
  b.rect(8, 12, 2, 12, "o2");
  b.ellipse(9, 9, 8, 8, "t3");
  b.ellipse(9, 9, 6, 6, "c4");
  b.ellipse(9, 9, 4, 4, "e2");
  b.ellipse(9, 9, 2, 2, "c4");
  b.set(9, 9, "e2");
  b.set(12, 7, "o3"); b.set(13, 6, "o3"); b.set(14, 5, "c3");
  return withOutline(b, "ink");
}
