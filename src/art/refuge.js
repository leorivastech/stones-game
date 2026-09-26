/**
 * Refugios secretos: entrada de cueva, estante, catre, mesa de trabajo, cerrojo.
 * Misma luz (arriba a la izquierda) y contorno que props.js.
 */

import { Buf, hash, strip } from "./pixel.js";
import { sphere, shadow, contact, withOutline } from "./props.js";

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

// ---------- Refugios escondidos (26-sep): sótano, grieta, choza del manglar, derrumbe y pistas ----------

/** Bloques de piedra con junta: muro viejo de ruina. Luz arriba-izquierda. */
function stoneBlocks(b, x0, y0, w, h, seed) {
  for (let y = y0; y < y0 + h; y += 1) {
    const row = Math.floor((y - y0) / 4);
    const off = row % 2 ? 3 : 0;
    for (let x = x0; x < x0 + w; x += 1) {
      const bx = (x - x0 + off) % 6;
      const by = (y - y0) % 4;
      let c = hash(Math.floor((x - x0 + off) / 6), row, seed) < 0.3 ? "s2" : "s3";
      if (by === 0) c = "s4";
      if (bx === 0) c = "s4";
      if (by === 3 || bx === 5) c = "s1";
      if (x < x0 + 2 && by !== 3) c = "s4";
      b.set(x, y, c);
    }
  }
}

/**
 * Sótano bajo las ruinas del bosque (Ruta 1), 40×34. Cuadro 0: escalones que bajan a lo oscuro entre un
 * muro roto con hiedra. Cuadro 1: trampilla de tablas con herrajes y farol.
 */
export function cellarDoor() {
  const make = (door) => {
    const b = new Buf(40, 34);
    shadow(b, 20, 31, 19, 2.5);
    // Muro roto: la orilla de arriba dentada.
    stoneBlocks(b, 2, 8, 36, 23, 71);
    for (let x = 2; x < 38; x += 1) {
      const bite = Math.floor(hash(x >> 1, 3, 72) * 7) + (x > 28 ? 5 : x < 8 ? 3 : 0);
      for (let y = 8; y < 8 + bite; y += 1) b.data[y * b.w + x] = 0;
      if (b.alpha(x, 8 + bite) === 255) b.set(x, 8 + bite, "s5");
    }
    // Arco de la bajada.
    for (let y = 13; y <= 30; y += 1) {
      const half = y < 17 ? 3 + (y - 13) : 7;
      for (let x = 20 - half; x < 20 + half; x += 1) b.set(x, y, "ink");
    }
    // Dovelas del arco.
    for (let y = 12; y <= 17; y += 1) {
      const half = y < 17 ? 4 + (y - 13) : 8;
      b.set(20 - half, y, "s5");
      b.set(19 + half, y, "s2");
    }
    b.hline(17, 12, 6, "s5");
    if (!door) {
      // Escalones que se pierden en lo oscuro.
      for (const [y, c] of [[29, "s3"], [26, "s2"], [23, "s1"], [20, "ink2"]]) {
        const inset = (29 - y) / 3;
        b.hline(13 + inset, y, 14 - inset * 2, c);
        b.hline(13 + inset, y + 1, 14 - inset * 2, "s1");
      }
      // Hojas secas en el primer escalón.
      b.set(15, 29, "o3"); b.set(22, 29, "t2"); b.set(24, 28, "o2");
    } else {
      // Trampilla de tablas con dos bandas de hierro y candado.
      for (let y = 15; y <= 30; y += 1) {
        const half = y < 17 ? 2 + (y - 15) : 6;
        for (let x = 20 - half; x < 20 + half; x += 1) b.set(x, y, (x - 14) % 3 === 0 ? "o1" : (x + y) % 7 === 0 ? "o2" : "o3");
      }
      for (const y of [19, 26]) for (let x = 14; x < 26; x += 1) b.set(x, y, x % 3 ? "s2" : "s4");
      b.rect(19, 22, 2, 2, "y3");
      b.set(19, 22, "y5");
      // Farol colgado de una grapa.
      b.set(29, 15, "ink2");
      b.rect(28, 16, 3, 3, "y3");
      b.set(29, 17, "y5");
    }
    // Hiedra que cuelga del muro.
    for (const x0 of [4, 9, 33]) {
      const len = 6 + Math.floor(hash(x0, 1, 73) * 9);
      for (let k = 0; k < len; k += 1) {
        const x = x0 + (k % 4 === 3 ? 1 : 0);
        const y = 13 + k;
        if (b.alpha(x, y) === 255) b.set(x, y, k % 3 ? "g2" : "g3");
      }
      b.set(x0, 13, "g4");
    }
    // Musgo al pie.
    for (let x = 3; x < 37; x += 1) if (hash(x, 9, 74) < 0.45 && (x < 12 || x > 27)) b.set(x, 30, "g3");
    return withOutline(b, "s0");
  };
  return strip([make(false), make(true)]);
}

/**
 * Grieta entre rocas del cañón (Ruta 5), 36×34. Cuadro 0: una rendija oscura entre dos peñas de arena.
 * Cuadro 1: la rendija con una cortina de cuero, soga y farol.
 */
export function creviceDoor() {
  const make = (door) => {
    const b = new Buf(36, 34);
    shadow(b, 18, 31, 17, 2.5);
    const ramp = ["d1", "d2", "d3", "d4", "d5"];
    sphere(b, 9, 20, 9, 12, ramp, { seed: 31, grain: 0.12 });
    sphere(b, 27, 19, 9, 13, ramp, { seed: 32, grain: 0.12 });
    sphere(b, 17, 9, 7, 7, ramp, { seed: 33, grain: 0.12 });
    // Vetas de la roca.
    for (const [x, y, w] of [[3, 16, 6], [24, 12, 7], [5, 25, 5], [28, 24, 5], [13, 6, 5]]) b.hline(x, y, w, "d2");
    // La rendija: angosta, de arriba abajo, apenas más ancha al pie (de lejos parece una raja).
    for (let y = 8; y <= 31; y += 1) {
      const half = y < 16 ? 1 : y < 26 ? 1.5 : 2.5;
      const cx = 18 + (y % 5 === 0 ? 1 : 0);
      for (let x = cx - half; x < cx + half; x += 1) b.set(x, y, y < 12 ? "ink2" : "ink");
      b.set(cx - half - 1, y, "d1");
    }
    if (door) {
      // Cortina de cuero colgada de un palo, con soga.
      b.hline(13, 13, 11, "o2");
      b.hline(13, 12, 11, "o4");
      for (let y = 14; y <= 30; y += 1) {
        const half = y < 22 ? 2 : 3;
        for (let x = 18 - half; x < 18 + half; x += 1) b.set(x, y, (x + (y >> 2)) % 3 === 0 ? "t1" : y % 6 === 0 ? "t3" : "t2");
      }
      b.vline(21, 14, 9, "c2");
      b.set(21, 23, "c1");
      // Farol en una estaca.
      b.vline(27, 22, 9, "o2");
      b.set(27, 21, "ink2");
      b.rect(26, 18, 3, 3, "y3");
      b.set(27, 19, "y5");
    } else {
      // Arena que se metió a la grieta y unas huellas de lagartija.
      b.hline(15, 30, 6, "d4");
      b.set(16, 29, "d3"); b.set(19, 28, "d3");
    }
    return withOutline(b, "d0");
  };
  return strip([make(false), make(true)]);
}

/**
 * Choza del manglar sobre pilotes (Ruta 3), 44×40. Cuadro 0: puerta clavada con tablas en cruz.
 * Cuadro 1: puerta arreglada, con cerrojo y farol.
 */
export function hutDoor() {
  const make = (door) => {
    const b = new Buf(44, 40);
    shadow(b, 22, 37, 20, 2.5);
    // Pilotes y plataforma.
    for (const x of [6, 16, 27, 37]) { b.rect(x, 30, 2, 8, "o1"); b.set(x, 30, "o3"); }
    b.rect(3, 28, 38, 3, "o3");
    b.hline(3, 28, 38, "o4");
    b.hline(3, 30, 38, "o1");
    for (let x = 5; x < 41; x += 5) b.vline(x, 28, 3, "o2");
    // Muro de tablas.
    for (let y = 14; y < 28; y += 1) for (let x = 7; x < 37; x += 1) {
      const plank = (x - 7) % 4;
      b.set(x, y, plank === 0 ? "o1" : plank === 1 ? "o4" : hash(x, y >> 2, 81) < 0.2 ? "o2" : "o3");
    }
    // Techo de palma, a dos aguas en 3/4.
    for (let y = 2; y < 16; y += 1) {
      const half = 7 + Math.round((y - 2) * 1.15);
      for (let x = 22 - half; x < 22 + half; x += 1) {
        const n = hash(x >> 1, y, 82);
        const c = y === 15 ? "t1" : (x + y * 2) % 5 === 0 ? "t2" : x < 22 - half + 3 ? "t4" : n < 0.3 ? "t2" : "t3";
        b.set(x, y, c);
      }
    }
    b.hline(15, 2, 14, "t5");
    // Puerta.
    b.rect(18, 18, 8, 10, "ink2");
    if (door) {
      for (let y = 18; y < 28; y += 1) for (let x = 18; x < 26; x += 1) b.set(x, y, (x - 18) % 3 === 0 ? "o1" : "o3");
      b.hline(18, 21, 8, "s2");
      b.hline(18, 25, 8, "s2");
      b.rect(24, 22, 1, 2, "y3");
      b.set(29, 17, "ink2");
      b.rect(28, 18, 3, 3, "y3");
      b.set(29, 19, "y5");
    } else {
      b.rect(19, 19, 6, 9, "ink");
      // Tablas en cruz clavadas.
      for (let i = 0; i < 8; i += 1) { b.set(18 + i, 19 + i, "o4"); b.set(18 + i, 20 + i, "o2"); b.set(25 - i, 19 + i, "o4"); b.set(25 - i, 20 + i, "o2"); }
      // Una tabla del muro se cayó.
      b.rect(31, 20, 4, 3, "ink2");
    }
    // Ventanita.
    b.rect(10, 19, 5, 4, door ? "y2" : "ink2");
    if (door) b.set(11, 20, "y4");
    // Juncos al pie de los pilotes.
    for (const x of [2, 4, 12, 21, 33, 41]) { b.vline(x, 32, 5, "g3"); b.set(x, 31, "g4"); }
    return withOutline(b, "o0");
  };
  return strip([make(false), make(true)]);
}

/**
 * Derrumbe que tapa un paso (Ruta 2), 48×24 como la reja. Cuadro 0: peñas y un tronco atravesado.
 * Cuadro 1: la palanca movió las peñas a los lados; queda el paso libre.
 */
export function rockfall() {
  const ramp = ["s1", "s2", "s3", "s4", "s5"];
  const make = (open) => {
    const b = new Buf(48, 24);
    shadow(b, 24, 21, 23, 2.5);
    const rocks = open
      ? [[5, 15, 5, 6], [9, 18, 4, 4], [42, 14, 5, 7], [38, 18, 4, 4]]
      : [[7, 14, 7, 7], [19, 12, 8, 8], [31, 13, 8, 7], [41, 15, 6, 6], [13, 18, 5, 4], [26, 18, 6, 4], [36, 19, 5, 3]];
    rocks.forEach(([x, y, rx, ry], i) => sphere(b, x, y, rx, ry, ramp, { seed: 60 + i, grain: 0.12 }));
    if (!open) {
      // Tronco atravesado, astillado.
      b.rect(10, 9, 26, 3, "o3");
      b.hline(10, 9, 26, "o4");
      b.hline(10, 11, 26, "o1");
      b.set(36, 9, "o4"); b.set(37, 10, "o3");
      // Tierra suelta.
      for (let x = 4; x < 44; x += 1) if (hash(x, 1, 64) < 0.4) b.set(x, 21, "d2");
    } else {
      // Guijarros en el paso.
      for (const [x, y] of [[20, 20], [27, 19], [24, 21], [17, 21]]) b.set(x, y, "s3");
    }
    return withOutline(b, "s0");
  };
  return strip([make(false), make(true)]);
}

/** Flor de luna: flores blancas y azules que casi no se ven en otro lado. Pista de un refugio. 12×9. */
export function rareFlowers() {
  const b = new Buf(12, 9);
  for (const [x, h] of [[2, 4], [5, 6], [8, 5], [10, 3]]) b.vline(x, 8 - h, h, "g2");
  for (const [x, y, c] of [[2, 3, "w5"], [5, 1, "c4"], [8, 2, "w5"], [10, 4, "c4"]]) {
    b.set(x, y, "y4");
    b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y - 1, c); b.set(x, y + 1, "w4");
  }
  return withOutline(b, "g0");
}

/** Piedra con una marca rayada (un círculo con una raya): así se avisan los contrabandistas. 14×12. */
export function markedStone() {
  const b = new Buf(14, 12);
  contact(b, 7, 10, 6, 1.4);
  sphere(b, 7, 6, 6, 5, ["s1", "s2", "s3", "s4", "s5"], { seed: 91, grain: 0.1 });
  // Marca: aro y raya en tono claro.
  for (const [x, y] of [[6, 4], [7, 4], [8, 5], [8, 6], [7, 7], [6, 7], [5, 6], [5, 5], [9, 3], [4, 8]]) b.set(x, y, "c3");
  return withOutline(b, "s0");
}
