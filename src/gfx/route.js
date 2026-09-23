/** Pintado de rutas: terreno, cinta de camino con textura y orillas vivas. */

import { PATH_HALF } from "../routes.js";

const PALETTE = {
  temperate: {
    shoulder: 0x3c4a2b, road: 0x6f5137, rut: 0x5f4630, wear: 0x82613f,
    mottle: [0x2b3a21, 0x56693d], tint: 0xffffff,
    props: ["tree", "tree", "bush", "tree-pine", "tree", "flowers"],
    under: ["bush", "flowers", "tuft", "tuft"],
  },
  mountain: {
    shoulder: 0x3a4038, road: 0x6d655c, rut: 0x5e574f, wear: 0x7d7468,
    mottle: [0x2c332b, 0x4f5a4a], tint: 0x9dab9f,
    props: ["boulder", "tree-pine", "rock", "tree-pine", "ore-pile", "tree-pine", "boulder"],
    under: ["rock", "tuft", "rock"],
  },
  tropical: {
    shoulder: 0x1d3a26, road: 0x6b5236, rut: 0x5b452d, wear: 0x7c5f40,
    mottle: [0x16301f, 0x2f5a37], tint: 0x8ecf78,
    props: ["tree-palm", "tree", "tree-palm", "tree", "bigleaf", "tree", "fern"],
    under: ["fern", "bigleaf", "fern", "tuft"],
  },
  desert: {
    shoulder: 0x8c6739, road: 0xb28a55, rut: 0x9f7a49, wear: 0xc39c63,
    mottle: [0x9a743f, 0xc9a165], tint: 0xe4c68d,
    props: ["cactus", "rock", "tuft", "bones", "hay", "rock", "cactus", "tuft"],
    under: ["tuft", "rock", "tuft"],
  },
  snow: {
    shoulder: 0x94a9af, road: 0xc3d1d4, rut: 0xb0bfc3, wear: 0xd8e4e5,
    mottle: [0xa9bcc0, 0xdfeaea], tint: 0xc3d6da,
    props: ["tree-pine-snow", "tree-pine-snow", "boulder", "tree-bare", "tree-pine-snow", "rock"],
    under: ["rock", "tuft"],
  },
};

/** Bioma de cada piso, para que la cola de la ruta cambie también sus props. */
const BIOME_OF_GROUND = {
  grass: "temperate", moss: "mountain", highland: "mountain", jungle: "tropical", sand: "desert", snow: "snow",
};

const TINT_OF = {
  tuft: { temperate: 0xf0ffd0, mountain: 0xc8d8b0, tropical: 0x8ee080, desert: 0xd8c080, snow: 0xb8c8b0 },
  boulder: { snow: 0xd0dde0 },
  rock: { snow: 0xd0dde0, desert: 0xd8b080 },
};

function noise(i, salt = 0) {
  const x = Math.sin((i + 1) * 91.73 + salt * 37.19) * 43758.5453;
  return x - Math.floor(x);
}

export function palette(biome) {
  return PALETTE[biome] ?? PALETTE.temperate;
}

/** Ancho del camino en el punto i. Ondas largas: orilla natural, no serrucho. */
export function halfAt(i, base = PATH_HALF) {
  return base + Math.sin(i * 0.06) * 7 + Math.sin(i * 0.17 + 1.7) * 4;
}

/** Tangente suavizada con ventana, para que la normal no tiemble en las curvas. */
export function smoothTangent(points, index, window = 4) {
  const a = points[Math.max(0, index - window)];
  const b = points[Math.min(points.length - 1, index + window)];
  const x = b.x - a.x;
  const y = b.y - a.y;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len, nx: -y / len, ny: x / len };
}

/**
 * Banda por tramos: un cuadrilátero entre cada par de puntos y un disco en la
 * junta. Así el borde nunca se dobla sobre sí mismo en las curvas cerradas.
 */
export function fillBand(g, points, halfFn, color) {
  g.fillStyle(color, 1);
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const ta = smoothTangent(points, i);
    const tb = smoothTangent(points, i + 1);
    const ha = halfFn(i);
    const hb = halfFn(i + 1);
    g.fillPoints([
      { x: a.x + ta.nx * ha, y: a.y + ta.ny * ha },
      { x: b.x + tb.nx * hb, y: b.y + tb.ny * hb },
      { x: b.x - tb.nx * hb, y: b.y - tb.ny * hb },
      { x: a.x - ta.nx * ha, y: a.y - ta.ny * ha },
    ], true);
    g.fillCircle(a.x, a.y, ha);
  }
  const last = points.length - 1;
  g.fillCircle(points[last].x, points[last].y, halfFn(last));
}

/** Rodada: hilo opaco que después la textura del camino vela por encima. */
function fillRut(g, points, share, color) {
  g.fillStyle(color, 1);
  for (let i = 0; i < points.length; i += 1) {
    const t = smoothTangent(points, i);
    const off = halfAt(i) * share + Math.sin(i * 0.31) * 4;
    g.fillCircle(points[i].x + t.nx * off, points[i].y + t.ny * off, 8);
  }
}

export function paintRouteGround(scene, worldW, worldH, groundKey, biome, topPad = 0) {
  const pal = palette(biome);
  scene.add.tileSprite(worldW / 2, (worldH - topPad) / 2, worldW, worldH + topPad, groundKey).setDepth(-6);

  const mottle = scene.add.graphics().setDepth(-5.6);
  for (let i = 0; i < 30; i += 1) {
    const x = noise(i, 11) * worldW;
    const y = noise(i, 12) * (worldH + topPad) - topPad;
    const rw = 160 + noise(i, 13) * 240;
    const rh = 120 + noise(i, 14) * 180;
    mottle.fillStyle(pal.mottle[i % 2], 0.09 + noise(i, 15) * 0.08);
    mottle.fillEllipse(x, y, rw, rh);
  }
}

/** Colores base de cada piso, para pintar transiciones sin máscaras. */
export const GROUND_COLORS = {
  grass: [0x3f5332, 0x35482a, 0x51663d],
  moss: [0x263a34, 0x1b3029, 0x395047],
  highland: [0x4a5a42, 0x394a35, 0x5b6a4c],
  jungle: [0x1d4229, 0x102c1c, 0x2c6038],
  sand: [0xb88a50, 0x9f7040, 0xd0aa68],
  snow: [0xbccfd3, 0x91afb7, 0xe6eff0],
  water: [0x2a5f6e, 0x1d4a56, 0x3e7a86],
  dirt: [0x76543b, 0x593d2d, 0x8b6748],
  cobble: [0x6e6a62, 0x55524b, 0x858077],
  // Barro de selva: tierra húmeda y oscura que sí se lee sobre el verde.
  mud: [0x5a4432, 0x453224, 0x74593f],
  // Nieve pisada: gris azulado claro, con huella y piedra asomando.
  packed: [0x9aa5aa, 0x86929a, 0xb4bfc3],
};

/**
 * El bioma del pueblo destino entra por manchas de color, no por una banda
 * recta. Sin máscaras: solo elipses, así se ve igual en cualquier navegador.
 */
export function blendDestinationGround(scene, worldW, worldH, destKey, points, biome, atHead = false) {
  if (!destKey) return;
  const colors = GROUND_COLORS[destKey] ?? GROUND_COLORS.grass;
  const ordered = atHead ? [...points].reverse() : points;
  const tail = ordered.slice(Math.floor(ordered.length * 0.55));
  const blend = scene.add.graphics().setDepth(-5.8);
  // Tres capas: la grande apenas se insinúa, la chica ya es el otro bioma.
  [[1.35, 0.3], [1, 0.55], [0.68, 0.9]].forEach(([reach, alpha], layer) => {
    tail.forEach((point, i) => {
      const grow = i / tail.length;
      blend.fillStyle(colors[layer % colors.length], alpha * (0.55 + grow * 0.45));
      blend.fillEllipse(
        point.x + (noise(i, 31 + layer) - 0.5) * 140,
        point.y + (noise(i, 32 + layer) - 0.5) * 140,
        (170 + grow * 380 + noise(i, 33) * 110) * reach,
        (150 + grow * 320 + noise(i, 34) * 100) * reach,
      );
    });
  });
  // Grano fino del piso nuevo, para que no sea una mancha lisa.
  const grain = scene.add.graphics().setDepth(-5.7);
  tail.forEach((point, i) => {
    const grow = i / tail.length;
    for (let k = 0; k < 14; k += 1) {
      const seed = i * 17 + k;
      const r = (120 + grow * 330) * noise(seed, 61);
      const a = noise(seed, 62) * Math.PI * 2;
      grain.fillStyle(colors[k % colors.length], 0.35 + noise(seed, 63) * 0.3);
      grain.fillCircle(point.x + Math.cos(a) * r, point.y + Math.sin(a) * r * 0.8, 1 + noise(seed, 64) * 2.5);
    }
  });

  const seam = scene.add.graphics().setDepth(-5.5);
  const pal = palette(biome);
  tail.forEach((point, i) => {
    if (i % 4) return;
    const t = smoothTangent(tail, i);
    seam.fillStyle(pal.mottle[i % 2], 0.13);
    seam.fillEllipse(point.x + t.nx * 170, point.y + t.ny * 170, 160, 120);
    seam.fillEllipse(point.x - t.nx * 160, point.y - t.ny * 160, 140, 110);
  });
}

/**
 * Textura de tierra dentro de una banda: manchas y granos a distintas
 * distancias del eje. Reemplaza al tileSprite enmascarado.
 */
export function sprinkleBand(g, points, halfFn, colors, density = 5) {
  for (let i = 0; i < points.length; i += 1) {
    const t = smoothTangent(points, i);
    const half = halfFn(i);
    for (let k = 0; k < density; k += 1) {
      const seed = i * 31 + k * 7;
      const off = (noise(seed, 71) - 0.5) * 2 * half * 0.92;
      const along = (noise(seed, 72) - 0.5) * 14;
      const x = points[i].x + t.nx * off + t.x * along;
      const y = points[i].y + t.ny * off + t.y * along;
      const big = noise(seed, 73) > 0.8;
      g.fillStyle(colors[Math.floor(noise(seed, 74) * colors.length)], big ? 0.16 : 0.32 + noise(seed, 75) * 0.3);
      if (big) g.fillEllipse(x, y, 14 + noise(seed, 76) * 22, 8 + noise(seed, 77) * 12);
      else g.fillCircle(x, y, 1 + noise(seed, 78) * 2.2);
    }
  }
}

export function paintRouteRibbon(scene, points, biome, paveKey, worldW, worldH, ends = null) {
  const pal = palette(biome);
  const pave = GROUND_COLORS[paveKey] ?? GROUND_COLORS.dirt;

  const shoulder = scene.add.graphics().setDepth(-4.2);
  fillBand(shoulder, points, (i) => halfAt(i) + 18, pal.shoulder);

  const base = scene.add.graphics().setDepth(-4);
  fillBand(base, points, (i) => halfAt(i), pal.road);

  const marks = scene.add.graphics().setDepth(-3.95);
  fillRut(marks, points, 0.44, pal.rut);
  fillRut(marks, points, -0.44, pal.rut);

  const surface = scene.add.graphics().setDepth(-3.8);
  sprinkleBand(surface, points, (i) => halfAt(i), [pave[1], pave[2], pal.wear, pal.rut], 6);

  // En el tramo nevado el camino se vuelve nieve pisada: la tierra desaparece bajo el hielo.
  const zones = endsOf(ends);
  for (const [which, list] of [["tail", points], ["head", [...points].reverse()]]) {
    if (zones[which] !== "snow") continue;
    const snowPal = palette("snow");
    const packed = GROUND_COLORS.packed;
    const from = Math.floor(list.length * 0.6);
    // Cuatro bandas cada vez más cortas y translúcidas: la nieve gana poco a poco.
    for (let step = 0; step < 4; step += 1) {
      const start = from + Math.floor((list.length - from) * step * 0.14);
      const chunk = list.slice(start);
      if (chunk.length < 3) continue;
      const cover = scene.add.graphics().setDepth(-3.7 + step * 0.01).setAlpha(step === 3 ? 1 : 0.4);
      fillBand(cover, chunk, (i) => halfAt(i + start) + 16, snowPal.shoulder);
      fillBand(cover, chunk, (i) => halfAt(i + start), packed[0]);
    }
    const tailSurface = scene.add.graphics().setDepth(-3.65);
    const chunk = list.slice(from + Math.floor((list.length - from) * 0.3));
    sprinkleBand(tailSurface, chunk, (i) => halfAt(i), [packed[1], packed[2], 0xffffff, snowPal.rut], 5);
  }

  const grit = scene.add.graphics().setDepth(-3.5);
  for (let i = 0; i < points.length; i += 2) {
    const t = smoothTangent(points, i);
    const spread = (noise(i, 41) - 0.5) * halfAt(i) * 1.6;
    const x = points[i].x + t.nx * spread;
    const y = points[i].y + t.ny * spread;
    grit.fillStyle(noise(i, 42) > 0.5 ? pal.wear : pal.rut, 0.2);
    grit.fillCircle(x, y, 2 + noise(i, 43) * 3);
  }
}

const FOLIAGE = new Set(["tree", "tree-pine", "tree-palm", "bush", "fern"]);

function tintFor(key, biome, pal) {
  if (FOLIAGE.has(key)) return pal.tint;
  return TINT_OF[key]?.[biome] ?? null;
}

function placeProp(scene, biome, x, y, seed, worldW, worldH) {
  if (x < 28 || y < 28 || x > worldW - 28 || y > worldH - 28) return;
  const pal = palette(biome);
  const key = pal.props[Math.floor(noise(seed, 51) * pal.props.length)];
  const prop = scene.add
    .image(x, y, key)
    .setOrigin(0.5, 0.88)
    .setDepth(y)
    .setScale(0.84 + noise(seed, 52) * 0.44)
    .setFlipX(noise(seed, 58) > 0.5);
  const tint = tintFor(key, biome, pal);
  if (tint) prop.setTint(tint);
  if (noise(seed, 53) < 0.45) return;
  const under = pal.under[Math.floor(noise(seed, 57) * pal.under.length)];
  const bx = x + (noise(seed, 54) - 0.5) * 68;
  const by = y + 12 + noise(seed, 55) * 28;
  const small = scene.add
    .image(bx, by, under)
    .setOrigin(0.5, 0.88)
    .setDepth(by)
    .setScale(0.58 + noise(seed, 56) * 0.4);
  const smallTint = tintFor(under, biome, pal);
  if (smallTint) small.setTint(smallTint);
}

/**
 * Bioma que manda en el punto i: el propio en el medio, el de origen en la
 * cabeza y el de destino en la cola (cuando son distintos al de la ruta).
 */
function biomeAt(i, total, biome, ends) {
  const grow = i / total;
  const tail = ends?.tail && ends.tail !== biome ? ends.tail : null;
  const head = ends?.head && ends.head !== biome ? ends.head : null;
  if (tail) {
    if (grow > 0.8) return tail;
    if (grow > 0.62 && noise(i, 59) < (grow - 0.62) / 0.18) return tail;
  }
  if (head) {
    if (grow < 0.2) return head;
    if (grow < 0.38 && noise(i, 59) < (0.38 - grow) / 0.18) return head;
  }
  return biome;
}

/** Traduce {headKey, tailKey} de piso a biomas. */
function endsOf(ends) {
  return {
    head: BIOME_OF_GROUND[ends?.head] ?? null,
    tail: BIOME_OF_GROUND[ends?.tail] ?? null,
  };
}

/** El desierto y la nieve van más pelones; la selva, tupida. */
const DENSITY = { desert: 0.4, snow: 0.62, mountain: 0.85, temperate: 1, tropical: 1.15 };

/** Orilla en grupos, con claros de por medio: nada de dos filas parejas. */
export function addRouteEdges(scene, points, biome, worldW, worldH, ends = null) {
  const zones = endsOf(ends);
  for (let i = 2; i < points.length - 2; i += 2) {
    const t = smoothTangent(points, i);
    const here = biomeAt(i, points.length, biome, zones);
    for (const side of [1, -1]) {
      const roll = noise(i * 2 + (side > 0 ? 0 : 1), 61);
      if (roll < 0.3 || noise(i * 3 + side, 65) > (DENSITY[here] ?? 1)) continue;
      const clump = roll > 0.84 ? 3 : roll > 0.56 ? 2 : 1;
      for (let k = 0; k < clump; k += 1) {
        const seed = i * 7 + k * 3 + (side > 0 ? 0 : 91);
        const away = halfAt(i) + 28 + noise(seed, 62) * 90 + k * 32;
        const along = (noise(seed, 63) - 0.5) * 60;
        placeProp(
          scene, here,
          points[i].x + t.nx * away * side + t.x * along,
          points[i].y + t.ny * away * side + t.y * along,
          seed, worldW, worldH,
        );
      }
    }
  }
}

/** Rellena el campo lejos del camino para que el mundo no se vea pelón. */
export function scatterField(scene, points, biome, worldW, worldH, keepClear = 120, ends = null) {
  const zones = endsOf(ends);
  let seed = 500;
  for (let x = 48; x < worldW - 36; x += 88) {
    for (let y = 64; y < worldH - 36; y += 88) {
      seed += 1;
      const px = x + (noise(seed, 82) - 0.5) * 78;
      const py = y + (noise(seed, 83) - 0.5) * 78;
      const near = nearPath(px, py, points);
      if (near.dist < keepClear) continue;
      const here = biomeAt(near.index, points.length, biome, zones);
      if (noise(seed, 81) < 0.42 || noise(seed, 84) > (DENSITY[here] ?? 1)) continue;
      placeProp(scene, here, px, py, seed, worldW, worldH);
    }
  }
}

function nearPath(x, y, points) {
  let best = Infinity;
  let index = 0;
  for (let i = 0; i < points.length; i += 2) {
    const d = Math.hypot(points[i].x - x, points[i].y - y);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { dist: best, index };
}

/**
 * Detalle de piso de la ruta, fuera del camino: matas y flores, grava y lajas,
 * charcos y hojarasca, rizos de duna, montículos. Y en la montaña, riscos por
 * los bordes lejanos para sentir que el camino va entre paredes.
 */
export function paintRouteDetail(scene, points, biome, worldW, worldH, ends = null) {
  const zones = endsOf(ends);
  const clear = (x, y, pad = 0) => {
    if (x < 30 || y < 30 || x > worldW - 30 || y > worldH - 30) return null;
    const near = nearPath(x, y, points);
    if (near.dist < PATH_HALF + 26 + pad) return null;
    return biomeAt(near.index, points.length, biome, zones);
  };
  const spots = (count, salt, pad = 0) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const x = noise(i, salt) * worldW;
      const y = noise(i, salt + 1) * worldH;
      const here = clear(x, y, pad);
      if (here) out.push({ x, y, i, here });
    }
    return out;
  };
  const stamp = (key, list, scale, tintBy = null, alpha = 1) => {
    list.forEach(({ x, y, i, here }) => {
      const img = scene.add.image(x, y, key).setOrigin(0.5, 0.88).setDepth(-2.5).setAlpha(alpha)
        .setScale(scale[0] + noise(i, 9) * scale[1]).setFlipX(noise(i, 8) > 0.5);
      const tint = tintBy?.[here] ?? TINT_OF[key]?.[here];
      if (tint) img.setTint(tint);
    });
  };
  const g = scene.add.graphics().setDepth(-2.6);
  const only = (list, which) => list.filter((s) => s.here === which);

  const all = spots(160, 401);
  const tufts = spots(90, 411);

  // Templado y montaña: pasto, flores, grava y lajas.
  only(all, "temperate").forEach(({ x, y, i }) => {
    g.fillStyle(i % 2 ? 0x5e7a3e : 0x32452a, 0.16);
    g.fillEllipse(x, y, 30 + noise(i, 3) * 40, 16 + noise(i, 4) * 22);
  });
  stamp("tuft", only(tufts, "temperate"), [0.8, 0.6]);
  stamp("flowers", only(spots(40, 421), "temperate"), [0.9, 0.5]);

  only(all, "mountain").forEach(({ x, y, i }) => {
    if (i % 2) {
      g.fillStyle(i % 4 === 1 ? 0x6c7168 : 0x4c534a, 0.42);
      g.fillRoundedRect(x - 10 - noise(i, 3) * 12, y - 5 - noise(i, 4) * 4, 20 + noise(i, 3) * 24, 10 + noise(i, 4) * 8, 4);
    } else {
      g.fillStyle(0x7b7f74, 0.5);
      for (let k = 0; k < 6; k += 1) g.fillCircle(x + (noise(i + k, 5) - 0.5) * 30, y + (noise(i + k, 6) - 0.5) * 18, 1.2 + noise(i + k, 7) * 2);
    }
  });
  stamp("tuft", only(tufts, "mountain"), [0.7, 0.5]);
  if (biome === "mountain") {
    // Riscos por las dos orillas del mundo, lejos del camino.
    for (let k = 0; k < 14; k += 1) {
      const t = k / 13;
      const x = 60 + t * (worldW - 120);
      for (const y of [46 + (k % 2) * 8, worldH - 20 - (k % 3) * 6]) {
        if (nearPath(x, y, points).dist < 150) continue;
        scene.add.image(x, y, "cliff").setOrigin(0.5, 0.88).setDepth(y).setScale(0.8 + noise(k, 411) * 0.3).setFlipX(k % 2 === 1);
      }
    }
    for (const [x, yStart] of [[36, 160], [worldW - 36, 200]]) {
      for (let y = yStart; y < worldH - 60; y += 150) {
        if (nearPath(x, y, points).dist < 150) continue;
        scene.add.image(x, y, "cliff").setOrigin(0.5, 0.88).setDepth(y).setScale(0.7).setFlipX(x > worldW / 2);
      }
    }
  }

  // Selva: charcos con reflejo, hojarasca y raíces.
  only(spots(16, 431, 20), "tropical").forEach(({ x, y, i }) => {
    const w = 40 + noise(i, 3) * 60;
    const h = 16 + noise(i, 4) * 22;
    g.fillStyle(0x0f2a25, 0.7);
    g.fillEllipse(x, y + 2, w + 6, h + 4);
    g.fillStyle(0x23575d, 0.9);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(0x7fc5c0, 0.35);
    g.fillEllipse(x - w * 0.15, y - h * 0.15, w * 0.45, h * 0.3);
    g.fillStyle(0xbfe6dc, 0.5);
    g.fillEllipse(x - w * 0.2, y - h * 0.2, w * 0.14, 2.5);
  });
  only(all, "tropical").forEach(({ x, y, i }) => {
    g.fillStyle([0xc98a3a, 0xa86a2c, 0xd8b04a, 0x6f8a3a][i % 4], 0.75);
    g.fillEllipse(x, y, 5 + noise(i, 5) * 5, 3 + noise(i, 6) * 2);
  });
  g.lineStyle(3, 0x3a2a1c, 0.55);
  only(spots(18, 441), "tropical").forEach(({ x, y, i }) => {
    const len = 30 + noise(i, 7) * 40;
    const a = noise(i, 8) * Math.PI;
    g.lineBetween(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4);
  });
  stamp("tuft", only(tufts, "tropical"), [0.8, 0.6]);

  // Desierto: rizos de duna, grietas y huesos.
  only(spots(48, 451, 10), "desert").forEach(({ x, y, i }) => {
    const len = 60 + noise(i, 3) * 120;
    g.fillStyle(0xe0c184, 0.32);
    g.fillEllipse(x, y, len, 7 + noise(i, 4) * 5);
    g.fillStyle(0x8f6a3a, 0.22);
    g.fillEllipse(x + 4, y + 7, len * 0.9, 5 + noise(i, 5) * 4);
  });
  g.lineStyle(1, 0x7a5528, 0.4);
  only(spots(40, 461), "desert").forEach(({ x, y, i }) => {
    const len = 10 + noise(i, 263) * 16;
    const dir = noise(i, 264) * Math.PI;
    g.lineBetween(x, y, x + Math.cos(dir) * len, y + Math.sin(dir) * len);
    g.lineBetween(x + Math.cos(dir) * len, y + Math.sin(dir) * len, x + Math.cos(dir + 1.1) * len * 0.6, y + Math.sin(dir + 1.1) * len * 0.6);
  });
  stamp("tuft", only(tufts, "desert"), [0.7, 0.5]);

  // Nieve: montículos con sombra azul y placas de hielo.
  only(spots(44, 471), "snow").forEach(({ x, y, i }) => {
    const w = 40 + noise(i, 3) * 70;
    const h = 14 + noise(i, 4) * 18;
    g.fillStyle(0x8fa9b3, 0.35);
    g.fillEllipse(x + 4, y + 5, w, h);
    g.fillStyle(0xf3f8f9, 0.75);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(x - w * 0.15, y - h * 0.2, w * 0.4, h * 0.35);
  });
  only(spots(14, 481), "snow").forEach(({ x, y, i }) => {
    const w = 34 + noise(i, 5) * 40;
    const h = 12 + noise(i, 6) * 14;
    g.fillStyle(0xb9d8e2, 0.6);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(x - w * 0.2, y - h * 0.2, w * 0.3, 2.5);
  });
  stamp("tuft", only(tufts, "snow"), [0.6, 0.4], null, 0.8);
}

/** Marco suave: oscurece las orillas y deja la ruta como zona de luz. */
export function addRouteFrame(scene, worldW, worldH, biome, topPad = 0) {
  const dark = biome === "snow" ? 0x5e7a82 : biome === "desert" ? 0x5f3d22 : biome === "tropical" ? 0x0d2a1c : biome === "mountain" ? 0x232a26 : 0x14211a;
  const frame = scene.add.graphics().setDepth(-2);
  const band = Math.min(72, Math.round(Math.min(worldW, worldH) * 0.1));
  const top = -topPad;
  const tall = worldH + topPad;
  frame.fillGradientStyle(dark, dark, dark, dark, 0.62, 0.62, 0, 0);
  frame.fillRect(0, top, worldW, band);
  frame.fillGradientStyle(dark, dark, dark, dark, 0, 0, 0.62, 0.62);
  frame.fillRect(0, worldH - band, worldW, band);
  frame.fillGradientStyle(dark, dark, dark, dark, 0.58, 0, 0.58, 0);
  frame.fillRect(0, top, band, tall);
  frame.fillGradientStyle(dark, dark, dark, dark, 0, 0.58, 0, 0.58);
  frame.fillRect(worldW - band, top, band, tall);
}

export function addRouteMotes(scene, worldW, worldH, biome) {
  const particle = biome === "snow"
    ? "snowflake"
    : biome === "tropical" ? "leaf" : "dust";
  scene.add.particles(0, 0, particle, {
    x: { min: 40, max: worldW - 40 },
    y: { min: 80, max: worldH - 80 },
    speedX: { min: 8, max: 22 },
    speedY: biome === "snow" ? { min: 12, max: 28 } : { min: 2, max: 12 },
    lifespan: { min: 3800, max: 6600 },
    scale: { start: 0.36, end: 0.07 },
    alpha: { start: 0.24, end: 0 },
    rotate: { min: 0, max: 240 },
    frequency: 700,
    maxAliveParticles: 14,
  }).setDepth(940);
}
