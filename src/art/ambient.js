/**
 * Ambiente: texturas chiquitas para las partículas de cada bioma (nieve, arena, hojas, polen,
 * luciérnagas, chispas, motas) y la sombra de nube que se desliza sobre el suelo.
 * Todo con la paleta; las nubes llevan borde en trama Bayer, nada de degradados suaves.
 */

import { Buf, bayer, rng, smoothNoise, strip } from "./pixel.js";
import { rgba } from "./palette.js";

/** Copos: 0 chico (1 px), 1 mediano (2 px), 2 grande (cruz 3×3, para el primer plano). */
function snowSheet() {
  const f0 = new Buf(3, 3);
  f0.set(1, 1, "n4");
  const f1 = new Buf(3, 3);
  f1.set(1, 1, "white"); f1.set(2, 1, "n4"); f1.set(1, 2, "n3");
  const f2 = new Buf(3, 3);
  f2.set(1, 0, "n3"); f2.set(0, 1, "n3"); f2.set(1, 1, "white"); f2.set(2, 1, "n4"); f2.set(1, 2, "n3");
  return strip([f0, f1, f2]);
}

/** Arena: grano de 1 px y estela de 2 px. */
function sandSheet() {
  const f0 = new Buf(2, 1);
  f0.set(0, 0, "d6");
  const f1 = new Buf(2, 1);
  f1.set(0, 0, "d4"); f1.set(1, 0, "d6");
  const f2 = new Buf(2, 1);
  f2.set(0, 0, "d5");
  return strip([f0, f1, f2]);
}

/**
 * Hojas de 3×3 en dos tonos; cada una con dos cuadros (de cara y de canto) para que
 * "giren" al caer sin rotar píxeles. 0-1 verde, 2-3 ámbar.
 */
function leafSheet() {
  const face = (a, b) => {
    const f = new Buf(3, 3);
    f.stamp(["aa.", "abb", ".b."], { a, b });
    return f;
  };
  const edge = (a, b) => {
    const f = new Buf(3, 3);
    f.stamp(["...", "abb", "..."], { a, b });
    return f;
  };
  return strip([face("f5", "f3"), edge("f5", "f3"), face("y3", "o4"), edge("y3", "o4")]);
}

/** Polen y pétalos: 0 polen (1 px), 1 pétalo claro (2 px), 2 pétalo rosado (2 px). */
function pollenSheet() {
  const f0 = new Buf(2, 2);
  f0.set(0, 0, "y4");
  const f1 = new Buf(2, 2);
  f1.set(0, 0, "c4"); f1.set(1, 1, "c3");
  const f2 = new Buf(2, 2);
  f2.set(0, 0, "e4"); f2.set(1, 0, "r5");
  return strip([f0, f1, f2]);
}

/** Luciérnaga: punto de 2 px amarillo-verde con un halo tenue. */
function firefly() {
  const b = new Buf(4, 4);
  const halo = rgba("g6", 90);
  b.set(1, 0, halo); b.set(2, 0, halo); b.set(0, 1, halo); b.set(3, 1, halo);
  b.set(0, 2, halo); b.set(3, 2, halo); b.set(1, 3, halo); b.set(2, 3, halo);
  b.set(1, 1, "y5"); b.set(2, 1, "g6"); b.set(1, 2, "g6"); b.set(2, 2, "g5");
  return b;
}

/** Chispa de fogata: 0 amarilla, 1 naranja, 2 roja (1 px cada una). */
function emberSheet() {
  return strip(["y5", "y4", "r4"].map((c) => {
    const f = new Buf(1, 1);
    f.set(0, 0, c);
    return f;
  }));
}

/** Mota de polvo flotando (cuevas): 1 px crema. */
function mote() {
  const b = new Buf(1, 1);
  b.set(0, 0, "c4");
  return b;
}

/** Polvo que levantan los pies: 0 tierra, 1 arena, 2 piedra, 3 nieve. */
function kickSheet() {
  return strip([["d4", "d5"], ["d5", "d6"], ["s4", "s5"], ["n3", "white"]].map(([lo, hi]) => {
    const f = new Buf(2, 2);
    f.set(0, 0, hi); f.set(1, 0, lo); f.set(0, 1, lo);
    return f;
  }));
}

/**
 * Sombra de nube: mancha orgánica hecha con varios óvalos y ruido, borde tramado con Bayer.
 * Tinta sólida; la transparencia la pone el sprite (α ≈ 0.2).
 */
export function cloudShadow(w = 96, h = 64, seed = 3) {
  const b = new Buf(w, h);
  const r = rng(seed);
  const lobes = [];
  for (let i = 0; i < 5; i += 1) {
    const cx = w * (0.26 + r() * 0.48);
    const cy = h * (0.36 + r() * 0.28);
    lobes.push({ cx, cy, rx: w * (0.16 + r() * 0.12), ry: h * (0.2 + r() * 0.14) });
  }
  lobes.push({ cx: w / 2, cy: h / 2, rx: w * 0.34, ry: h * 0.3 });
  const ink = rgba("ink");
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let d = 0;
      for (const l of lobes) {
        const dx = (x + 0.5 - l.cx) / l.rx;
        const dy = (y + 0.5 - l.cy) / l.ry;
        d = Math.max(d, 1 - (dx * dx + dy * dy));
      }
      d += (smoothNoise(x, y, 9, seed) - 0.5) * 0.5;
      // Núcleo lleno; en el borde, trama ordenada que se va abriendo.
      const edge = (d - 0.02) / 0.3;
      if (edge >= 1 || (edge > 0 && bayer(x, y) < edge)) b.set(x, y, ink);
    }
  }
  return b;
}

/** Todo lo del ambiente, listo para `buildArt()`. */
export function ambientArt() {
  return [
    { key: "amb-snow", ...snowSheet() },
    { key: "amb-sand", ...sandSheet() },
    { key: "amb-leaf", ...leafSheet() },
    { key: "amb-pollen", ...pollenSheet() },
    { key: "amb-firefly", buf: firefly() },
    { key: "amb-ember", ...emberSheet() },
    { key: "amb-mote", buf: mote() },
    { key: "amb-kick", ...kickSheet() },
    { key: "amb-cloud-0", buf: cloudShadow(96, 64, 3) },
    { key: "amb-cloud-1", buf: cloudShadow(112, 60, 11) },
  ];
}
