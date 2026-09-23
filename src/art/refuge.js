/**
 * Refugios secretos: entrada de cueva, estante, catre, mesa de trabajo, cerrojo.
 * Misma luz (arriba a la izquierda) y contorno que props.js.
 */

import { Buf, hash, strip } from "./pixel.js";
import { sphere, shadow, withOutline } from "./props.js";

/**
 * Entrada de cueva, 36×32. Cuadro 0: boca oscura (sin forjar). Cuadro 1: con puerta de tablas y herrajes.
 * `snow`: roca con nieve encima (Ruta 4).
 */
export function caveDoor(snow = false) {
  const ramp = snow ? ["s1", "s2", "s3", "s4", "n3"] : ["s1", "s2", "s3", "s4", "s5"];
  const make = (door) => {
    const b = new Buf(36, 32);
    shadow(b, 18, 30, 16, 2.5);
    sphere(b, 11, 18, 10, 11, ramp, { seed: 11 });
    sphere(b, 25, 17, 10, 12, ramp, { seed: 12 });
    sphere(b, 18, 12, 11, 10, ramp, { seed: 13 });
    if (snow) {
      for (let x = 8; x < 29; x += 1) {
        const top = [...Array(32).keys()].find((y) => (b.get(x, y) >>> 24) === 255);
        if (top === undefined) continue;
        b.set(x, top, "n4");
        if (hash(x, 1, 5) < 0.6) b.set(x, top + 1, "n3");
      }
    }
    // Boca de la cueva: arco oscuro.
    for (let y = 14; y <= 30; y += 1) {
      const half = y < 18 ? 3 + (y - 14) : 7;
      for (let x = 18 - half; x <= 17 + half; x += 1) b.set(x, y, y < 16 ? "ink2" : "ink");
    }
    if (door) {
      // Puerta de tablas con dos bandas de hierro y un cerrojo.
      for (let y = 16; y <= 30; y += 1) {
        const half = y < 18 ? 2 + (y - 16) : 6;
        for (let x = 18 - half; x <= 17 + half; x += 1) {
          const plank = (x - 12) % 3 === 0;
          b.set(x, y, plank ? "o1" : (x + y) % 7 === 0 ? "o2" : "o3");
        }
      }
      for (const y of [20, 27]) for (let x = 12; x <= 23; x += 1) b.set(x, y, x % 3 ? "s2" : "s4");
      b.rect(20, 23, 2, 2, "y3");
      b.set(20, 23, "y5");
      // Farol colgado.
      b.set(26, 14, "ink2");
      b.rect(25, 15, 3, 3, "y3");
      b.set(26, 16, "y5");
    }
    return withOutline(b);
  };
  return strip([make(false), make(true)]);
}

/** Estante, 24×28. Cuadro 0 vacío, 1 con piedras y sacos. */
export function shelf() {
  const make = (full) => {
    const b = new Buf(24, 28);
    shadow(b, 12, 26, 11, 2);
    b.rect(1, 2, 22, 24, "o2");
    b.rect(3, 4, 18, 20, "o0");
    for (const y of [9, 16, 23]) {
      b.hline(2, y, 20, "o4");
      b.hline(2, y + 1, 20, "o1");
    }
    b.vline(1, 2, 24, "o3");
    b.hline(1, 2, 22, "o4");
    if (full) {
      const gems = [["y3", "y5"], ["v3", "v5"], ["w4", "w6"], ["r3", "r5"], ["n3", "n4"]];
      [5, 12].forEach((y, row) => {
        for (let i = 0; i < 4; i += 1) {
          const [c, lit] = gems[(i + row * 2) % gems.length];
          const x = 4 + i * 4;
          b.rect(x, y + 1, 3, 3, c);
          b.set(x, y + 1, lit);
        }
      });
      // Sacos abajo.
      sphere(b, 8, 20, 3.5, 3, ["t1", "t2", "t3", "t4"], { seed: 3, rim: false });
      sphere(b, 15, 20, 3.5, 3, ["t1", "t2", "t3", "t4"], { seed: 4, rim: false });
    }
    return withOutline(b);
  };
  return strip([make(false), make(true)]);
}

/** Catre de paja con manta, 28×16. */
export function cot() {
  const b = new Buf(28, 16);
  shadow(b, 14, 14, 13, 2);
  b.rect(1, 5, 26, 8, "o2");
  b.rect(2, 4, 24, 7, "t3");
  b.hline(2, 4, 24, "t4");
  b.rect(12, 4, 14, 7, "e2");
  b.hline(12, 4, 14, "e3");
  for (let x = 13; x < 26; x += 3) b.vline(x, 5, 6, "e1");
  sphere(b, 6, 6, 4, 2.5, ["c1", "c2", "c3", "c4"], { seed: 2, rim: false });
  b.vline(1, 12, 2, "o1");
  b.vline(26, 12, 2, "o1");
  return withOutline(b);
}

/** Mesa de trabajo con herramientas, 28×20. */
export function workbench() {
  const b = new Buf(28, 20);
  shadow(b, 14, 18, 13, 2);
  b.rect(1, 6, 26, 5, "o3");
  b.hline(1, 6, 26, "o4");
  b.hline(1, 10, 26, "o1");
  b.rect(3, 11, 2, 7, "o2");
  b.rect(23, 11, 2, 7, "o2");
  // Martillo, tenazas, un lingote.
  b.rect(5, 3, 6, 2, "s3"); b.set(5, 3, "s5"); b.vline(8, 5, 2, "o1");
  b.rect(15, 4, 5, 2, "y2"); b.hline(15, 4, 5, "y4");
  b.set(22, 3, "s4"); b.set(23, 4, "s4"); b.set(24, 5, "s3"); b.set(21, 5, "s3");
  return withOutline(b);
}
