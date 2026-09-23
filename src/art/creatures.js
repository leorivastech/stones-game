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

/** Jabalí 24×18: 0-1 caminar, 2 embestida (cabeza baja), 3 aturdido. */
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
  return strip([make(0), make(1), make(2), make(3)]);
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

/** Lobo 26×18: 0-1 caminar, 2 salto (patas estiradas), 3 aturdido. Gris con vientre claro. */
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
  return strip([make(0), make(1), make(2), make(3)]);
}

/** Escorpión 20×14: 0-1 caminar, 2 aguijón adelante, 3 escondido (sólo la arena removida y los ojos). */
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
  return strip([make(0), make(1), make(2), make(3)]);
}
