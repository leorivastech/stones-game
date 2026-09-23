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

/** Caballo de carga 32×28 con silla roja y alforjas. 4 cuadros de trote. */
export function horseSheet() {
  const ramp = ["o1", "o2", "o3", "o4", "o5"];
  const legSets = [
    [[8, 0], [11, 2], [20, 2], [23, 0]],
    [[9, 1], [11, 0], [21, 0], [23, 2]],
    [[8, 2], [11, 0], [20, 0], [23, 2]],
    [[7, 1], [11, 2], [21, 2], [22, 0]],
  ];
  const frames = legSets.map((legs, f) => {
    const b = new Buf(32, 28);
    b.ellipse(16, 26, 12, 2, rgba("ink", 80));
    for (const [x, lift] of legs) {
      b.rect(x, 15, 2, 10 - lift, "o2");
      b.vline(x, 15, 10 - lift, "o3");
      b.rect(x, 24 - lift, 2, 1, "ink2");
    }
    const bob = f % 2;
    body(b, 15, 12 + bob, 10, 5.5, ramp, 4);
    // Cuello y cabeza
    for (let i = 0; i < 7; i += 1) body(b, 23 + i * 0.6, 10 + bob - i * 0.9, 2.8, 2.6, ramp, 6 + i);
    body(b, 28, 5 + bob, 3.6, 2.6, ramp, 12);
    b.rect(29, 5 + bob, 3, 3, "o3");
    b.set(31, 6 + bob, "ink2");
    b.set(27, 4 + bob, "ink");
    b.set(26, 1 + bob, "o2"); b.set(26, 2 + bob, "o2");
    // Crin
    for (let i = 0; i < 8; i += 1) b.set(22 + i * 0.6, 8 + bob - i, "ink2");
    for (let i = 0; i < 6; i += 1) b.set(23 + i * 0.6, 9 + bob - i, "o0");
    // Cola
    for (let i = 0; i < 6; i += 1) b.set(5 - (i > 2 ? 1 : 0) + (f % 2), 10 + bob + i, "ink2");
    // Silla y alforjas
    b.rect(12, 6 + bob, 8, 3, "e2");
    b.hline(12, 6 + bob, 8, "e3");
    b.rect(10, 9 + bob, 5, 6, "o4");
    b.hline(10, 9 + bob, 5, "o5");
    b.rect(11, 11 + bob, 3, 1, "y3");
    return outlined(b);
  });
  return strip(frames);
}
