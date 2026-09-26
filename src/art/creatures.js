/** Animales: jabalí (enemigo del monte) y caballo de carga (mejora). Vista de lado, mirando a la derecha. */

import { Buf, hash, strip } from "./pixel.js";
import { rgba } from "./palette.js";

const L = [-0.5, -0.75, 0.6];

function body(b, cx, cy, rx, ry, ramp, seed) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      let li = nx * L[0] + ny * L[1] + Math.sqrt(1 - d) * L[2];
      li += (hash(x, y >> 1, seed) - 0.5) * 0.25;
      const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(((li + 0.3) / 1.3) * ramp.length)));
      b.set(x, y, ramp[idx]);
    }
  }
}

function outlined(b, color = "ink") {
  const shadowless = b.clone();
  for (let i = 0; i < shadowless.data.length; i += 1) if ((shadowless.data[i] >>> 24) < 255) shadowless.data[i] = 0;
  shadowless.outline(color);
  for (let i = 0; i < b.data.length; i += 1) {
    if ((shadowless.data[i] >>> 24) === 255 && (b.data[i] >>> 24) < 255) b.data[i] = shadowless.data[i];
  }
  return b;
}

/**
 * Jabalí 24×18: 0-1 caminar de lado, 2 embestida (cabeza baja), 3 aturdido,
 * 4-5 caminar de frente (hacia abajo), 6-7 caminar de espalda (hacia arriba).
 */
export function boarSheet() {
  const ramp = ["d0", "d1", "d2", "d3"];
  const make = (pose) => {
    const b = new Buf(24, 18);
    b.ellipse(12, 16, 9, 1.8, rgba("ink", 80));
    const headDrop = pose === 2 ? 2 : 0;
    // Patas
    const legs = pose === 1 ? [[6, 1], [9, -1], [14, 1], [17, -1]] : [[6, -1], [9, 1], [14, -1], [17, 1]];
    for (const [x, s] of legs) {
      const len = pose === 3 ? 2 : 4;
      b.rect(x + (pose === 0 || pose === 1 ? (s > 0 ? 0 : 0) : 0), 12, 2, len + (s > 0 ? 0 : -1), "d0");
      b.set(x, 11 + len + (s > 0 ? 0 : -1), "ink2");
    }
    body(b, 11, 9, 8.5, 5, ramp, 3);
    // Lomo hirsuto
    for (let x = 5; x < 16; x += 1) if (hash(x, 1, 9) < 0.7) b.set(x, 4 - (x % 3 === 0 ? 1 : 0), "d0");
    // Cabeza
    body(b, 18, 9 + headDrop, 4.5, 3.5, ramp, 5);
    b.rect(21, 9 + headDrop, 3, 3, "k2");
    b.set(23, 10 + headDrop, "k0");
    b.set(21, 12 + headDrop, "c4");
    b.set(22, 11 + headDrop, "c4");
    b.set(19, 7 + headDrop, pose === 3 ? "y4" : "ink");
    b.set(16, 5 + headDrop, "d0");
    b.set(17, 5 + headDrop, "d1");
    // Cola
    b.set(2, 7, "d1");
    b.set(1, 6, "d1");
    return outlined(b);
  };
  const views = [0, 1].map((f) => boarFront(f, ramp)).concat([0, 1].map((f) => boarBack(f, ramp)));
  return strip([make(0), make(1), make(2), make(3), ...views]);
}

/** Cuatro patas vistas de frente o de espalda: las de adelante largas, las de atrás asoman. `f` alterna el paso. */
function stubLegs(b, xs, top, len, f, color, hoof) {
  xs.forEach((x, i) => {
    const l = len - ((i + f) % 2);
    b.rect(x, top, 2, l, color);
    b.rect(x, top + l - 1, 2, 1, hoof);
  });
}

/** Jabalí de frente: jeta con colmillos, orejas, cerdas del lomo detrás. */
function boarFront(f, ramp) {
  const b = new Buf(24, 18);
  b.ellipse(12, 16, 7, 1.8, rgba("ink", 80));
  const bob = f;
  stubLegs(b, [7, 15], 11 + bob, 5 - bob, f + 1, "d0", "ink2");
  body(b, 12, 8 + bob, 7, 5, ramp, 41);
  for (let x = 7; x < 18; x += 1) if (hash(x, 2, 9) < 0.7) b.set(x, 3 + bob - (x % 3 === 0 ? 1 : 0), "d0");
  stubLegs(b, [8, 14], 12 + bob, 4, f, "d1", "ink2");
  body(b, 12, 10 + bob, 4.5, 3.5, ramp, 42);
  b.set(8, 6 + bob, "d0"); b.set(7, 5 + bob, "d1"); b.set(16, 6 + bob, "d0"); b.set(17, 5 + bob, "d1");
  b.rect(10, 11 + bob, 4, 3, "k2");
  b.hline(10, 11 + bob, 4, "k3");
  b.set(11, 12 + bob, "k0"); b.set(12, 12 + bob, "k0");
  b.set(9, 12 + bob, "c4"); b.set(14, 12 + bob, "c4"); b.set(9, 11 + bob, "c4"); b.set(14, 11 + bob, "c4");
  b.set(10, 9 + bob, "ink"); b.set(13, 9 + bob, "ink");
  return outlined(b);
}

/** Jabalí de espalda: grupa redonda, colita, orejas asomando al frente. */
function boarBack(f, ramp) {
  const b = new Buf(24, 18);
  b.ellipse(12, 16, 7, 1.8, rgba("ink", 80));
  const bob = f;
  b.set(8, 3 + bob, "d0"); b.set(8, 2 + bob, "d1"); b.set(15, 3 + bob, "d0"); b.set(15, 2 + bob, "d1");
  body(b, 12, 6 + bob, 4.5, 3, ramp, 43);
  stubLegs(b, [8, 14], 11 + bob, 5 - bob, f, "d0", "ink2");
  body(b, 12, 9 + bob, 7, 5, ramp, 44);
  for (let y = 4; y < 12; y += 1) if (hash(12, y, 5) < 0.6) b.set(12, y + bob, "d0");
  b.set(12, 12 + bob, "d1"); b.set(13, 13 + bob, "d1"); b.set(12, 14 + bob, "d0");
  return outlined(b);
}

/** Una pata de caballo: caña de 2 px, rodilla marcada y casco. `lift` la acorta (pie en el aire). */
function horseLeg(b, x, top, len, lift, far) {
  const main = far ? "o1" : "o2";
  const lit = far ? "o2" : "o3";
  const h = len - lift;
  b.rect(x, top, 2, h, main);
  b.vline(x, top, h, lit);
  b.set(x, top + Math.floor(h / 2), far ? "o0" : "o1");
  b.rect(x, top + h - 1, 2, 1, "ink2");
}

/** Mancha de manta con borde claro arriba, pegada al lomo (sin joroba). */
function blanketOnBack(b, x0, x1, depth, minY = 0) {
  for (let x = x0; x <= x1; x += 1) {
    let top = -1;
    for (let y = minY; y < b.h; y += 1) if ((b.get(x, y) >>> 24) === 255) { top = y; break; }
    if (top < 0) continue;
    for (let d = 0; d < depth; d += 1) b.set(x, top + d, d === 0 ? "e3" : "e2");
  }
}

/**
 * Caballo de carga, 32×28. 12 cuadros: 0-3 de lado (mira a la derecha), 4-7 de frente, 8-11 de espalda.
 * Cuello corto y arqueado con crin, cabeza larga hacia abajo, manta y alforjas: caballo, no camello.
 */
export function horseSheet() {
  const ramp = ["o1", "o2", "o3", "o4", "o5"];
  const dark = ["o0", "o1", "o2", "o3", "o4"];
  const frames = [];

  // --- De lado ---
  // [x, lift] de: trasera lejana, trasera cercana, delantera lejana, delantera cercana.
  const sideLegs = [
    [[10, 0], [8, 2], [23, 2], [21, 0]],
    [[9, 1], [9, 0], [22, 0], [22, 1]],
    [[8, 2], [10, 0], [21, 0], [23, 2]],
    [[9, 0], [9, 1], [22, 1], [22, 0]],
  ];
  sideLegs.forEach((legs, f) => {
    const b = new Buf(32, 28);
    b.ellipse(16, 26, 12, 2, rgba("ink", 80));
    const bob = f % 2 ? 0 : 1;
    horseLeg(b, legs[0][0] + 2, 15 + bob, 10 - bob, legs[0][1], true);
    horseLeg(b, legs[2][0] + 2, 15 + bob, 10 - bob, legs[2][1], true);
    // Cola que se mece.
    const sway = f === 1 ? -1 : f === 3 ? 1 : 0;
    const tail = [[7, 9], [6, 10], [5, 11], [5, 12], [4, 13], [4, 14], [4, 15], [4 + sway, 16], [5 + sway, 17]];
    for (const [x, y] of tail) { b.set(x, y + bob, "ink2"); b.set(x + 1, y + bob, "o0"); }
    // Cuerpo: grupa, barriga, pecho.
    body(b, 9, 12 + bob, 4.2, 4, ramp, 3);
    body(b, 15.5, 12.5 + bob, 9, 4.2, ramp, 4);
    body(b, 22, 12.5 + bob, 3.6, 4, ramp, 5);
    // Cuello arqueado y cabeza larga que baja hacia el hocico.
    for (let i = 0; i < 5; i += 1) body(b, 22.6 + i * 0.9, 10.5 + bob - i * 1.5, 3.2 - i * 0.15, 3, ramp, 6 + i);
    for (let i = 0; i < 5; i += 1) body(b, 26.4 + i * 0.9, 4.2 + bob + i * 1.1, 2.4 - i * 0.15, 2.1 - i * 0.1, ramp, 12 + i);
    b.set(30, 8 + bob, "o1"); b.set(29, 9 + bob, "o1"); b.set(30, 9 + bob, "ink2");
    b.set(27, 4 + bob, "ink");
    // Orejas y crin.
    b.set(25, 1 + bob, "o2"); b.set(25, 2 + bob, "o3"); b.set(26, 2 + bob, "o2");
    for (let i = 0; i < 7; i += 1) {
      b.set(Math.round(21.5 + i * 0.75), Math.round(8.5 + bob - i * 1.2), "ink2");
      b.set(Math.round(22.2 + i * 0.75), Math.round(9 + bob - i * 1.2), "o0");
    }
    // Manta sobre el lomo y alforjas colgando del costado.
    blanketOnBack(b, 12, 18, 3);
    b.rect(11, 12 + bob, 5, 4, "o4");
    b.hline(11, 12 + bob, 5, "o5");
    b.vline(11, 12 + bob, 4, "o3");
    b.set(13, 14 + bob, "y3");
    // Patas cercanas, delante del cuerpo.
    horseLeg(b, legs[1][0], 15 + bob, 10 - bob, legs[1][1], false);
    horseLeg(b, legs[3][0], 15 + bob, 10 - bob, legs[3][1], false);
    frames.push(outlined(b));
  });

  // --- De frente ---
  for (let f = 0; f < 4; f += 1) {
    const b = new Buf(32, 28);
    b.ellipse(16, 26, 9, 2, rgba("ink", 80));
    const bob = f % 2 ? 0 : 1;
    const liftL = f === 0 ? 2 : 0;
    const liftR = f === 2 ? 2 : 0;
    horseLeg(b, 13, 17 + bob, 8 - bob, 0, true);
    horseLeg(b, 17, 17 + bob, 8 - bob, 0, true);
    // Alforjas colgando a los lados (redondas, pegadas al cuerpo).
    for (const x of [10, 22]) {
      b.ellipse(x, 14.5 + bob, 1.8, 2.6, "o4");
      b.set(x, 13 + bob, "o5");
      b.set(x, 15 + bob, "y3");
    }
    body(b, 16, 13.5 + bob, 6, 4.5, ramp, 21);
    body(b, 16, 8.5 + bob, 3.2, 3, ramp, 22);
    horseLeg(b, 11, 16 + bob, 10 - bob, liftL, false);
    horseLeg(b, 19, 16 + bob, 10 - bob, liftR, false);
    // Cabeza larga de frente, con lucero blanco.
    for (let i = 0; i < 6; i += 1) body(b, 16, 3.8 + bob + i * 1.5, 2.6 - i * 0.15, 2, ramp, 23 + i);
    for (let y = 3; y <= 9; y += 1) b.set(16, y + bob, "c3");
    b.rect(15, 11 + bob, 3, 2, "o1");
    b.set(15, 12 + bob, "ink2"); b.set(17, 12 + bob, "ink2");
    b.set(14, 4 + bob, "ink"); b.set(18, 4 + bob, "ink");
    b.set(13, 1 + bob, "o2"); b.set(14, 1 + bob, "o3");
    b.set(18, 1 + bob, "o3"); b.set(19, 1 + bob, "o2");
    b.set(16, 1 + bob, "ink2"); b.set(15, 2 + bob, "ink2"); b.set(17, 2 + bob, "ink2");
    frames.push(outlined(b));
  }

  // --- De espalda ---
  for (let f = 0; f < 4; f += 1) {
    const b = new Buf(32, 28);
    b.ellipse(16, 26, 9, 2, rgba("ink", 80));
    const bob = f % 2 ? 0 : 1;
    const liftL = f === 0 ? 2 : 0;
    const liftR = f === 2 ? 2 : 0;
    // Cabeza y cuello asoman detrás, más oscuros.
    body(b, 16, 6 + bob, 2.8, 3, dark, 31);
    b.set(14, 2 + bob, "o2"); b.set(18, 2 + bob, "o2");
    for (let y = 3; y <= 8; y += 1) b.set(16, y + bob, "ink2");
    horseLeg(b, 14, 17 + bob, 8 - bob, 0, true);
    horseLeg(b, 17, 17 + bob, 8 - bob, 0, true);
    for (const x of [10, 22]) {
      b.ellipse(x, 14.5 + bob, 1.8, 2.6, "o4");
      b.set(x, 13 + bob, "o5");
    }
    // Grupa redonda con la raya del medio.
    body(b, 13.2, 13.5 + bob, 3.8, 4.6, ramp, 32);
    body(b, 18.8, 13.5 + bob, 3.8, 4.6, ramp, 33);
    blanketOnBack(b, 12, 20, 2, 9);
    horseLeg(b, 11, 16 + bob, 10 - bob, liftL, false);
    horseLeg(b, 19, 16 + bob, 10 - bob, liftR, false);
    // Cola al centro, meciéndose.
    const sway = f === 1 ? -1 : f === 3 ? 1 : 0;
    for (let y = 11; y <= 20; y += 1) {
      const x = 15 + (y > 16 ? sway : 0);
      b.set(x, y + bob, "o0"); b.set(x + 1, y + bob, "ink2"); b.set(x + 2, y + bob, "o0");
    }
    frames.push(outlined(b));
  }
  return strip(frames);
}

/**
 * Lobo 26×18: 0-1 caminar de lado, 2 salto (patas estiradas), 3 aturdido, 4-5 de frente, 6-7 de espalda.
 * Gris con vientre claro.
 */
export function wolfSheet() {
  const ramp = ["s1", "s2", "s3", "s4"];
  const make = (pose) => {
    const b = new Buf(26, 18);
    b.ellipse(13, 16, 9, 1.8, rgba("ink", 80));
    const stretch = pose === 2;
    const legs = pose === 1 ? [[6, 1], [9, -1], [16, 1], [19, -1]] : [[6, -1], [9, 1], [16, -1], [19, 1]];
    for (const [x, s] of legs) {
      const len = pose === 3 ? 2 : 4;
      const dx = stretch ? (x < 12 ? -2 : 2) : 0;
      b.rect(x + dx, 12, 2, len + (s > 0 ? 0 : -1), "s1");
      b.set(x + dx, 11 + len + (s > 0 ? 0 : -1), "ink2");
    }
    body(b, 12, 9, 8.5, 4, ramp, 7);
    // Vientre claro y lomo oscuro.
    for (let x = 7; x < 18; x += 1) { b.set(x, 12, "n3"); b.set(x, 5, "s1"); }
    const hy = stretch ? 1 : 0;
    body(b, 20, 7 + hy, 4, 3.3, ramp, 9);
    b.rect(23, 8 + hy, 3, 2, "s3");
    b.set(25, 8 + hy, "ink");
    b.set(21, 6 + hy, pose === 3 ? "y4" : "y3");
    b.set(19, 3, "s2"); b.set(19, 4, "s2"); b.set(21, 3, "s2"); b.set(21, 4, "s3");
    for (let i = 0; i < 5; i += 1) b.set(4 - i, 7 + Math.floor(i / 2) - (stretch ? 1 : 0), i > 3 ? "n3" : "s2");
    return outlined(b);
  };
  const front = (f) => {
    const b = new Buf(26, 18);
    b.ellipse(13, 16, 6, 1.8, rgba("ink", 80));
    const bob = f;
    stubLegs(b, [9, 15], 11 + bob, 5 - bob, f + 1, "s1", "ink2");
    body(b, 13, 9 + bob, 5.5, 4, ramp, 51);
    stubLegs(b, [10, 14], 12 + bob, 4, f, "s2", "ink2");
    for (let y = 9; y < 14; y += 1) { b.set(12, y + bob, "n3"); b.set(13, y + bob, "n3"); }
    body(b, 13, 6 + bob, 4, 3.2, ramp, 52);
    // Orejas en punta, ojos amarillos, hocico claro.
    b.set(10, 2 + bob, "s2"); b.set(10, 3 + bob, "s3"); b.set(11, 3 + bob, "s2");
    b.set(16, 2 + bob, "s2"); b.set(16, 3 + bob, "s3"); b.set(15, 3 + bob, "s2");
    b.set(11, 6 + bob, "y3"); b.set(15, 6 + bob, "y3");
    b.rect(12, 7 + bob, 3, 2, "s4");
    b.set(13, 8 + bob, "ink");
    return outlined(b);
  };
  const back = (f) => {
    const b = new Buf(26, 18);
    b.ellipse(13, 16, 6, 1.8, rgba("ink", 80));
    const bob = f;
    body(b, 13, 5 + bob, 3.5, 2.8, ramp, 53);
    b.set(11, 2 + bob, "s2"); b.set(11, 1 + bob, "s3"); b.set(15, 2 + bob, "s2"); b.set(15, 1 + bob, "s3");
    stubLegs(b, [9, 15], 11 + bob, 5 - bob, f, "s1", "ink2");
    body(b, 13, 9 + bob, 5.5, 4, ramp, 54);
    for (let y = 6; y < 12; y += 1) b.set(13, y + bob, "s1");
    // Cola tupida colgando al centro, punta clara; se mece con el paso.
    const sw = f ? 1 : 0;
    for (let y = 11; y <= 15; y += 1) { b.set(12 + sw, y + bob, "s2"); b.set(13 + sw, y + bob, "s3"); }
    b.set(12 + sw, 15 + bob, "n3"); b.set(13 + sw, 15 + bob, "n3");
    return outlined(b);
  };
  return strip([make(0), make(1), make(2), make(3), front(0), front(1), back(0), back(1)]);
}

/**
 * Escorpión 20×14: 0-1 caminar de lado, 2 aguijón adelante, 3 escondido (sólo la arena removida y los
 * ojos), 4-5 de frente (pinzas abajo, cola arqueada atrás), 6-7 de espalda (cola hacia ti).
 */
export function scorpionSheet() {
  const make = (pose) => {
    const b = new Buf(20, 14);
    if (pose === 3) {
      b.ellipse(10, 10, 6, 2.5, "d4");
      b.ellipse(10, 9.5, 4, 1.5, "d5");
      b.set(8, 9, "ink"); b.set(11, 9, "ink");
      return b;
    }
    b.ellipse(10, 12, 7, 1.5, rgba("ink", 80));
    const step = pose === 1 ? 1 : 0;
    for (let k = 0; k < 3; k += 1) {
      b.set(6 + k * 3, 11 + ((k + step) % 2), "r0");
      b.set(6 + k * 3, 7 - ((k + step) % 2), "r0");
    }
    body(b, 10, 9, 5, 2.6, ["r0", "r1", "r2", "r3"], 3);
    b.ellipse(16, 7, 2, 1.5, "r2");
    b.ellipse(16, 11, 2, 1.5, "r2");
    b.set(18, 7, "r1"); b.set(18, 11, "r1");
    const tail = pose === 2 ? [[5, 8], [4, 6], [5, 4], [7, 3], [9, 3], [11, 4]] : [[5, 8], [3, 7], [2, 5], [3, 3], [5, 2], [6, 3]];
    tail.forEach(([x, y], i) => { b.set(x, y, i % 2 ? "r3" : "r2"); b.set(x, y + 1, "r1"); });
    const [sx, sy] = tail[tail.length - 1];
    b.set(sx + 1, sy, "y4");
    return outlined(b);
  };
  const ramp = ["r0", "r1", "r2", "r3"];
  const legsV = (b, cy, step) => {
    for (let k = 0; k < 3; k += 1) {
      const o = (k + step) % 2;
      b.set(5 - o, cy - 1 + k * 2, "r0"); b.set(6, cy - 1 + k * 2, "r0");
      b.set(14 + o, cy - 1 + k * 2, "r0"); b.set(13, cy - 1 + k * 2, "r0");
    }
  };
  const front = (f) => {
    const b = new Buf(20, 14);
    b.ellipse(10, 12, 6, 1.5, rgba("ink", 80));
    // Cola arqueada detrás del cuerpo (arriba), el aguijón apunta hacia ti.
    [[10, 4], [10, 3], [10, 2], [10, 1]].forEach(([x, y], i) => { b.set(x, y, i % 2 ? "r3" : "r2"); b.set(x + 1, y, "r1"); });
    b.set(10, 0, "y4"); b.set(11, 1, "r1");
    legsV(b, 6, f);
    body(b, 10, 7, 3.2, 3.5, ramp, 61);
    // Pinzas al frente.
    b.set(8, 10, "r1"); b.set(12, 10, "r1");
    b.ellipse(6.5, 11.5, 1.8, 1.4, "r2"); b.ellipse(13.5, 11.5, 1.8, 1.4, "r2");
    b.set(6, 13 - f, "r1"); b.set(14, 13 - (1 - f), "r1");
    b.set(9, 8, "ink"); b.set(11, 8, "ink");
    return outlined(b);
  };
  const back = (f) => {
    const b = new Buf(20, 14);
    b.ellipse(10, 12, 6, 1.5, rgba("ink", 80));
    b.ellipse(6.5, 2.5, 1.8, 1.4, "r2"); b.ellipse(13.5, 2.5, 1.8, 1.4, "r2");
    b.set(8, 4, "r1"); b.set(12, 4, "r1");
    legsV(b, 6, f);
    body(b, 10, 6, 3.2, 3.5, ramp, 62);
    // La cola viene hacia ti y se enrosca arriba del lomo.
    [[10, 9], [10, 10], [10, 11], [11, 12]].forEach(([x, y], i) => { b.set(x, y, i % 2 ? "r3" : "r2"); b.set(x - 1, y, "r1"); });
    b.set(12, 11, "y4");
    return outlined(b);
  };
  return strip([make(0), make(1), make(2), make(3), front(0), front(1), back(0), back(1)]);
}

// ---------------------------------------------------------------------------
// Carreta enganchada a la yegua (mejora de Nella). Tres tiras, una por vista, porque cada vista tiene
// su tamaño: de lado 56×30 (carreta atrás, a la izquierda), de frente y de espalda 32×46 (la carreta
// arriba, detrás de la yegua, o abajo, entre la yegua y tú). `CART_ANCHOR`: dónde pisa la yegua en
// cada cuadro (el punto del rastro), para el origen del sprite.
export const CART_ANCHOR = { side: [40, 30], down: [16, 46], up: [16, 28] };

/** Tablones de madera con luz arriba-izquierda: filas alternas y vetas. */
function planks(b, x, y, w, h, vertical = false) {
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const seam = vertical ? i % 4 === 3 : j % 3 === 2;
      const c = seam ? "o1" : j === 0 ? "o5" : i === 0 ? "o4" : hash(x + i, y + j, 77) < 0.15 ? "o2" : "o3";
      b.set(x + i, y + j, c);
    }
  }
}

/** Rueda de lado: aro oscuro, rayos que giran (+ o ×) y maza clara. */
function wheelSide(b, cx, cy, r, f) {
  b.ellipse(cx, cy, r + 0.6, r + 0.6, "ink");
  b.ellipse(cx, cy, r - 0.4, r - 0.4, "o2");
  b.ellipse(cx, cy, r - 1.4, r - 1.4, "o0");
  const diag = f % 2 === 1;
  for (let k = -(r - 1); k <= r - 1; k += 1) {
    if (diag) { b.set(cx + k * 0.7, cy + k * 0.7, "o4"); b.set(cx + k * 0.7, cy - k * 0.7, "o4"); }
    else { b.set(cx + k, cy, "o4"); b.set(cx, cy + k, "o4"); }
  }
  b.rect(cx - 1, cy - 1, 2, 2, "o5");
  b.set(cx - 1, cy - 1, "y3");
}

/** Rueda de canto (de frente o de espalda): una tira alta con el aro. */
function wheelEdge(b, x, y, h, f) {
  b.rect(x, y, 3, h, "ink");
  b.rect(x + 1, y + 1, 1, h - 2, "o3");
  for (let j = 1 + (f % 2); j < h - 1; j += 3) b.set(x + 1, y + j, "o2");
}

/** Carga: dos sacos y una caja. */
function load(b, x, y) {
  b.ellipse(x + 3, y + 2, 3.2, 2.4, "c2");
  b.ellipse(x + 2.4, y + 1.4, 1.6, 1, "c3");
  b.ellipse(x + 9, y + 1.5, 3, 2.3, "c1");
  b.ellipse(x + 8.4, y + 1, 1.5, 0.9, "c2");
  b.rect(x + 13, y - 1, 5, 4, "o4");
  b.hline(x + 13, y - 1, 5, "o5");
  b.vline(x + 15, y - 1, 4, "o2");
}

export function cartSheets() {
  const horse = horseSheet();
  const hf = (i) => {
    const f = new Buf(32, 28);
    for (let y = 0; y < 28; y += 1) for (let x = 0; x < 32; x += 1) f.data[y * 32 + x] = horse.buf.data[y * horse.buf.w + i * 32 + x];
    return f;
  };
  const side = [];
  const down = [];
  const up = [];
  for (let f = 0; f < 4; f += 1) {
    const bob = f % 2 ? 0 : 1;
    // --- De lado (yegua a la derecha, carreta atrás) ---
    {
      const b = new Buf(56, 30);
      b.ellipse(15, 28, 12, 1.8, rgba("ink", 80));
      // Vara lejana, detrás de todo.
      for (let x = 26; x <= 46; x += 1) b.set(x, 15 + bob, "o1");
      const cart = new Buf(56, 30);
      planks(cart, 3, 11, 24, 7);
      cart.rect(3, 18, 24, 2, "o1");
      load(cart, 5, 7);
      outlined(cart);
      b.blit(cart);
      wheelSide(b, 14, 22, 6, f);
      b.blit(hf(f), 24, 2);
      // Vara cercana: del frente de la caja al hombro de la yegua, por encima del costado.
      for (let x = 26; x <= 45; x += 1) { b.set(x, 17 + bob, x === 45 ? "o5" : "o4"); b.set(x, 18 + bob, "o1"); }
      b.set(46, 17 + bob, "ink");
      side.push(b);
    }
    // --- De frente (viene hacia ti: la carreta detrás, arriba) ---
    {
      const b = new Buf(32, 46);
      b.ellipse(16, 21, 13, 2, rgba("ink", 80));
      const cart = new Buf(32, 46);
      load(cart, 7, 3);
      planks(cart, 4, 7, 24, 10, true);
      cart.hline(4, 7, 24, "o5");
      outlined(cart);
      b.blit(cart);
      wheelEdge(b, 1, 9 + (f % 2), 12, f);
      wheelEdge(b, 28, 9 + ((f + 1) % 2), 12, f);
      // Varas que bajan a los lados de la yegua.
      for (let y = 17; y <= 32; y += 1) { b.set(9, y, "o4"); b.set(22, y, "o4"); b.set(10, y, "o1"); b.set(23, y, "o1"); }
      b.blit(hf(4 + f), 0, 18);
      down.push(b);
    }
    // --- De espalda (se aleja: la carreta entre la yegua y tú) ---
    {
      const b = new Buf(32, 46);
      b.blit(hf(8 + f), 0, 0);
      b.ellipse(16, 43, 14, 2, rgba("ink", 80));
      const cart = new Buf(32, 46);
      load(cart, 7, 19);
      planks(cart, 4, 23, 24, 12, true);
      cart.hline(4, 23, 24, "o5");
      cart.rect(4, 35, 24, 2, "o1");
      // Tabla trasera con dos refuerzos de hierro.
      cart.vline(9, 24, 11, "s2");
      cart.vline(22, 24, 11, "s2");
      outlined(cart);
      b.blit(cart);
      wheelEdge(b, 1, 27 + (f % 2), 14, f);
      wheelEdge(b, 28, 27 + ((f + 1) % 2), 14, f);
      up.push(b);
    }
  }
  return { side: strip(side), down: strip(down), up: strip(up) };
}
