/**
 * Suelo del pueblo: calles con orilla suave, plaza de adoquín con bordillo,
 * detalle de piso según bioma y costa (arena o hielo).
 * Todo con relleno + detalle dibujado; el recorte es matemático, no máscara,
 * para que se vea igual en cualquier navegador.
 */

import { GROUND_COLORS, fillBand, palette, sprinkleBand } from "./route.js";

export const PLAZA = { rx: 132, ry: 92 };
const STREET_HALF = { ns: 50, ew: 44 };

function noise(i, salt = 0) {
  const x = Math.sin((i + 1) * 91.73 + salt * 37.19) * 43758.5453;
  return x - Math.floor(x);
}

/** Recta con vaivén, muestreada cada ~12 px: una calle no es una regla. */
function wavyLine(x1, y1, x2, y2, amp, seed = 0) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const steps = Math.max(8, Math.round(len / 12));
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const push = Math.sin(t * Math.PI * 1.6 + seed) * amp + Math.sin(t * Math.PI * 4.3 + seed * 2) * amp * 0.25;
    points.push({ x: x1 + dx * t + nx * push, y: y1 + dy * t + ny * push });
  }
  return points;
}

function paintStreet(scene, points, half, pathKey, pal) {
  const wobble = (i) => half + Math.sin(i * 0.11) * 4 + Math.sin(i * 0.29 + 1.3) * 3;
  const pave = GROUND_COLORS[pathKey] ?? GROUND_COLORS.dirt;

  const shoulder = scene.add.graphics().setDepth(-4.4);
  fillBand(shoulder, points, (i) => wobble(i) + 12, pal.shoulder);

  const base = scene.add.graphics().setDepth(-4.2);
  fillBand(base, points, wobble, pave[0]);

  const surface = scene.add.graphics().setDepth(-4);
  sprinkleBand(surface, points, wobble, [pave[1], pave[2], pal.wear], 5);
}

/** Plaza: disco irregular de adoquín con bordillo oscuro y orilla comida por el bioma. */
function paintPlaza(scene, cx, cy, rx, ry, biome, pal) {
  const lobes = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    lobes.push({
      x: cx + Math.cos(a) * rx * 0.8,
      y: cy + Math.sin(a) * ry * 0.8,
      rx: 40 + noise(i, 21) * 34,
      ry: 30 + noise(i, 22) * 26,
    });
  }
  const inside = (x, y, shrink = 0) => {
    const ex = (x - cx) / (rx - shrink);
    const ey = (y - cy) / (ry - shrink);
    if (ex * ex + ey * ey <= 1) return true;
    return lobes.some((l) => {
      const lx = (x - l.x) / Math.max(4, l.rx - shrink);
      const ly = (y - l.y) / Math.max(4, l.ry - shrink);
      return lx * lx + ly * ly <= 1;
    });
  };
  const blob = (g, grow) => {
    g.fillEllipse(cx, cy, (rx + grow) * 2, (ry + grow) * 2);
    lobes.forEach((l) => g.fillEllipse(l.x, l.y, (l.rx + grow) * 2, (l.ry + grow) * 2));
  };

  const rim = scene.add.graphics().setDepth(-3.8);
  rim.fillStyle(pal.shoulder, 0.85);
  blob(rim, 16);

  // Bordillo: piedra oscura que asoma 6 px alrededor del adoquín.
  const curb = scene.add.graphics().setDepth(-3.75);
  curb.fillStyle(0x2f2d29, 1);
  blob(curb, 3);

  const base = scene.add.graphics().setDepth(-3.7);
  base.fillStyle(0x45423c, 1);
  blob(base, -3);

  // Adoquines reales: rejilla alternada, solo donde cae dentro de la plaza.
  const cobbles = scene.add.graphics().setDepth(-3.6);
  const fills = [0x7d766c, 0x6e6a60, 0x8b857a, 0x63685f, 0x776c60, 0x928778, 0x84796a];
  let id = 0;
  for (let row = 0, y = cy - ry - 70; y < cy + ry + 70; row += 1, y += 14) {
    for (let x = cx - rx - 90 + (row % 2) * 10; x < cx + rx + 90; x += 20) {
      id += 1;
      const jx = x + (noise(id, 23) - 0.5) * 3;
      const jy = y + (noise(id, 24) - 0.5) * 3;
      if (!inside(jx, jy, 8)) continue;
      const w = 15 + noise(id, 25) * 4;
      const h = 10 + noise(id, 26) * 3;
      cobbles.fillStyle(fills[id % fills.length], 1);
      cobbles.fillRoundedRect(jx - w / 2, jy - h / 2, w, h, 4);
      cobbles.fillStyle(0xe6d8bd, 0.16);
      cobbles.fillRoundedRect(jx - w / 2 + 2, jy - h / 2 + 1, w * 0.5, 2, 1);
      cobbles.fillStyle(0x24221f, 0.22);
      cobbles.fillRoundedRect(jx - w / 2 + 1, jy + h / 2 - 2, w - 2, 1.5, 1);
    }
  }

  // Desgaste: el centro brilla por el paso; el borde lo muerde el bioma.
  const wear = scene.add.graphics().setDepth(-3.5);
  for (let i = 0; i < 14; i += 1) {
    wear.fillStyle(pal.wear, 0.09);
    wear.fillEllipse(
      cx + (noise(i, 31) - 0.5) * rx * 1.5,
      cy + (noise(i, 32) - 0.5) * ry * 1.5,
      40 + noise(i, 33) * 60,
      28 + noise(i, 34) * 44,
    );
  }
  wear.fillStyle(0xfff2d0, 0.06);
  wear.fillEllipse(cx, cy + 12, rx * 1.1, ry * 0.9);

  const bite = {
    temperate: [0x51663d, 0x3f5332],
    mountain: [0x5b6a4c, 0x4a5a42],
    tropical: [0x2c6038, 0x1d4229],
    desert: [0xd0aa68, 0xb88a50],
    snow: [0xe6eff0, 0xbccfd3],
  }[biome] ?? [0x51663d, 0x3f5332];
  const edge = scene.add.graphics().setDepth(-3.45);
  for (let i = 0; i < 36; i += 1) {
    const a = noise(i, 35) * Math.PI * 2;
    const r = 0.94 + noise(i, 36) * 0.16;
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    if (Math.abs(x - cx) < 58 && Math.abs(y - cy) > ry - 20) continue;
    if (Math.abs(y - cy) < 50 && Math.abs(x - cx) > rx - 20) continue;
    edge.fillStyle(bite[i % 2], 0.55 + noise(i, 37) * 0.3);
    edge.fillEllipse(x, y, 8 + noise(i, 38) * 12, 5 + noise(i, 39) * 7);
  }
}

/** Altura de la orilla en x. La usa el dibujo y también la colisión del agua. */
export function shoreEdgeAt(worldH, x) {
  const top = worldH - 128;
  return top + Math.sin(x * 0.012) * 22 + Math.sin(x * 0.037 + 2) * 12;
}

/** Costa del golfo: arena o hielo, agua con textura, espuma que respira. */
function paintShore(scene, worldW, worldH, biome) {
  const frozen = biome === "snow";
  const top = worldH - 128;
  const edgeAt = (x) => shoreEdgeAt(worldH, x);
  const edge = [];
  for (let x = -20; x <= worldW + 20; x += 40) edge.push({ x, y: edgeAt(x) });
  const shape = (g, lift) => {
    g.beginPath();
    g.moveTo(edge[0].x, edge[0].y - lift);
    edge.forEach((p) => g.lineTo(p.x, p.y - lift));
    g.lineTo(worldW + 20, worldH + 20);
    g.lineTo(-20, worldH + 20);
    g.closePath();
    g.fillPath();
  };

  const strand = scene.add.graphics().setDepth(-3.2);
  if (frozen) {
    // Banco de hielo: blanco azulado con grietas y un labio azul sobre el agua.
    strand.fillStyle(0xd9e8ec, 0.95);
    shape(strand, 34);
    strand.fillStyle(0x9fc0cc, 0.85);
    shape(strand, 6);
    strand.lineStyle(1, 0x7fa3b2, 0.55);
    for (let i = 0; i < 26; i += 1) {
      const x = noise(i, 51) * worldW;
      const y = edgeAt(x) - 8 - noise(i, 52) * 22;
      const len = 14 + noise(i, 53) * 26;
      const dir = (noise(i, 54) - 0.5) * 0.9;
      strand.lineBetween(x, y, x + len, y + len * dir);
    }
    strand.fillStyle(0xffffff, 0.45);
    for (let i = 0; i < 18; i += 1) {
      const x = noise(i, 55) * worldW;
      strand.fillEllipse(x, edgeAt(x) - 22 - noise(i, 56) * 10, 24 + noise(i, 57) * 30, 5);
    }
  } else {
    strand.fillStyle(0xbfa070, 0.75);
    shape(strand, 26);
    strand.fillStyle(0xd9bb85, 0.5);
    shape(strand, 14);
    // Marca de la marea: línea de algas y conchitas.
    for (let i = 0; i < 30; i += 1) {
      const x = noise(i, 58) * worldW;
      strand.fillStyle(i % 3 ? 0x8a7a4e : 0xe8dcc4, 0.7);
      strand.fillEllipse(x, edgeAt(x) - 8 - noise(i, 59) * 8, 6 + noise(i, 60) * 8, 2.5);
    }
  }

  const water = frozen ? [0x274c5c, 0x1b3a48, 0x35667a] : GROUND_COLORS.water;
  const sea = scene.add.graphics().setDepth(-3);
  sea.fillStyle(water[0], 1);
  shape(sea, 0);

  // Textura del agua: manchas y crestas, solo por debajo de la orilla.
  const ripple = scene.add.graphics().setDepth(-2.95);
  for (let i = 0; i < 90; i += 1) {
    const x = noise(i, 41) * worldW;
    const y = top - 10 + noise(i, 42) * (worldH - top + 30);
    if (y < edgeAt(x) + 8) continue;
    ripple.fillStyle(water[1 + (i % 2)], 0.28 + noise(i, 43) * 0.2);
    ripple.fillEllipse(x, y, 40 + noise(i, 44) * 70, 10 + noise(i, 45) * 12);
  }
  ripple.lineStyle(1, frozen ? 0xbfe2ea : 0x9fd4d2, 0.28);
  for (let y = top + 24; y < worldH; y += 16) {
    for (let x = 0; x < worldW; x += 90) {
      if (y < edgeAt(x + 20) + 10) continue;
      const len = 26 + noise(x + y, 46) * 30;
      ripple.lineBetween(x + noise(y, 47) * 40, y, x + noise(y, 47) * 40 + len, y + 1);
    }
  }
  if (frozen) {
    // Témpanos sueltos flotando cerca de la orilla.
    for (let i = 0; i < 9; i += 1) {
      const x = noise(i, 61) * worldW;
      const y = edgeAt(x) + 26 + noise(i, 62) * 50;
      ripple.fillStyle(0xdcecf0, 0.9);
      ripple.fillEllipse(x, y, 18 + noise(i, 63) * 26, 7 + noise(i, 64) * 6);
      ripple.fillStyle(0xffffff, 0.5);
      ripple.fillEllipse(x - 3, y - 2, 8 + noise(i, 65) * 10, 3);
    }
  }
  scene.tweens.add({ targets: ripple, x: 7, duration: 3400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

  const foam = scene.add.graphics().setDepth(-2.9);
  edge.forEach((p, i) => {
    foam.fillStyle(0xd8eef0, 0.38);
    foam.fillEllipse(p.x + 12, p.y + 4 + Math.sin(i) * 3, 46, 11);
    foam.fillStyle(0xffffff, 0.3);
    foam.fillEllipse(p.x + 6, p.y + 2 + Math.sin(i) * 3, 22, 4);
  });
  scene.tweens.add({ targets: foam, alpha: 0.45, y: 4, duration: 1900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
}

/**
 * Detalle de piso por bioma, fuera de calles, plaza y agua: matas y flores,
 * grava y lajas, charcos y hojarasca, rizos de duna, montículos y hielo.
 */
function paintTownDetail(scene, biome, worldW, worldH, cx, cy, gulf) {
  const clear = (x, y, pad = 0) => {
    if (Math.abs(x - cx) < STREET_HALF.ns + 22 + pad) return false;
    if (Math.abs(y - cy) < STREET_HALF.ew + 22 + pad) return false;
    const ex = (x - cx) / (PLAZA.rx + 60 + pad);
    const ey = (y - cy) / (PLAZA.ry + 56 + pad);
    if (ex * ex + ey * ey <= 1) return false;
    if (gulf && y > shoreEdgeAt(worldH, x) - 48 - pad) return false;
    return x > 30 && y > 30 && x < worldW - 30 && y < worldH - 30;
  };
  const spots = (count, salt) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const x = noise(i, salt) * worldW;
      const y = noise(i, salt + 1) * worldH;
      if (clear(x, y)) out.push({ x, y, i });
    }
    return out;
  };
  const stamp = (key, list, scale, tint, alpha = 1) => {
    list.forEach(({ x, y, i }) => {
      const img = scene.add.image(x, y, key).setOrigin(0.5, 0.88).setDepth(-2.5).setAlpha(alpha)
        .setScale(scale[0] + noise(i, 9) * scale[1]).setFlipX(noise(i, 8) > 0.5);
      if (tint) img.setTint(tint);
    });
  };
  const g = scene.add.graphics().setDepth(-2.6);

  if (biome === "temperate") {
    spots(70, 101).forEach(({ x, y, i }) => {
      g.fillStyle(i % 2 ? 0x5e7a3e : 0x32452a, 0.16);
      g.fillEllipse(x, y, 30 + noise(i, 3) * 40, 16 + noise(i, 4) * 22);
    });
    stamp("tuft", spots(90, 111), [0.8, 0.6], 0xf0ffd0);
    stamp("flowers", spots(34, 121), [0.9, 0.5]);
    stamp("bush", spots(10, 131), [0.5, 0.3]);
  } else if (biome === "mountain") {
    spots(60, 141).forEach(({ x, y, i }) => {
      g.fillStyle(i % 2 ? 0x6c7168 : 0x4c534a, 0.42);
      g.fillRoundedRect(x - 10 - noise(i, 3) * 12, y - 5 - noise(i, 4) * 4, 20 + noise(i, 3) * 24, 10 + noise(i, 4) * 8, 4);
      g.fillStyle(0x9aa49a, 0.18);
      g.fillRoundedRect(x - 8 - noise(i, 3) * 12, y - 6 - noise(i, 4) * 4, 14 + noise(i, 3) * 14, 3, 2);
    });
    spots(120, 151).forEach(({ x, y, i }) => {
      g.fillStyle(i % 3 ? 0x7b7f74 : 0x55594f, 0.5);
      g.fillCircle(x, y, 1.2 + noise(i, 5) * 2.4);
    });
    stamp("tuft", spots(50, 161), [0.7, 0.5], 0xc8d8b0);
    stamp("rock", spots(14, 171), [0.5, 0.4]);
  } else if (biome === "tropical") {
    spots(14, 181).forEach(({ x, y, i }) => {
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
    spots(110, 191).forEach(({ x, y, i }) => {
      g.fillStyle([0xc98a3a, 0xa86a2c, 0xd8b04a, 0x6f8a3a][i % 4], 0.75);
      g.fillEllipse(x, y, 5 + noise(i, 5) * 5, 3 + noise(i, 6) * 2);
    });
    g.lineStyle(3, 0x3a2a1c, 0.55);
    spots(16, 201).forEach(({ x, y, i }) => {
      const len = 30 + noise(i, 7) * 40;
      const a = noise(i, 8) * Math.PI;
      g.lineBetween(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4);
    });
    stamp("fern", spots(40, 211), [0.7, 0.5], 0x9ad080);
    stamp("bigleaf", spots(26, 221), [0.7, 0.5]);
    stamp("tuft", spots(50, 231), [0.8, 0.6], 0x8ee080);
  } else if (biome === "desert") {
    // Rizos de duna: crestas largas en diagonal, luz arriba y sombra abajo.
    for (let i = 0; i < 46; i += 1) {
      const x = noise(i, 241) * worldW;
      const y = noise(i, 242) * worldH;
      if (!clear(x, y, 10)) continue;
      const len = 60 + noise(i, 3) * 120;
      g.fillStyle(0xe0c184, 0.32);
      g.fillEllipse(x, y, len, 7 + noise(i, 4) * 5);
      g.fillStyle(0x8f6a3a, 0.22);
      g.fillEllipse(x + 4, y + 7, len * 0.9, 5 + noise(i, 5) * 4);
    }
    spots(80, 251).forEach(({ x, y, i }) => {
      g.fillStyle(0x7f5a30, 0.2);
      g.fillCircle(x, y, 1 + noise(i, 6) * 2);
    });
    // Tierra agrietada alrededor de la plaza.
    g.lineStyle(1, 0x7a5528, 0.4);
    for (let i = 0; i < 40; i += 1) {
      const a = noise(i, 261) * Math.PI * 2;
      const r = PLAZA.rx + 80 + noise(i, 262) * 60;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.8;
      if (!clear(x, y)) continue;
      const len = 10 + noise(i, 263) * 16;
      const dir = noise(i, 264) * Math.PI;
      g.lineBetween(x, y, x + Math.cos(dir) * len, y + Math.sin(dir) * len);
      g.lineBetween(x + Math.cos(dir) * len, y + Math.sin(dir) * len, x + Math.cos(dir + 1.1) * len * 0.6, y + Math.sin(dir + 1.1) * len * 0.6);
    }
    stamp("tuft", spots(40, 271), [0.7, 0.5], 0xd8c080);
    stamp("rock", spots(14, 281), [0.5, 0.4], 0xd8b080);
  } else if (biome === "snow") {
    // Montículos: nieve iluminada arriba, sombra azul debajo.
    spots(40, 291).forEach(({ x, y, i }) => {
      const w = 40 + noise(i, 3) * 70;
      const h = 14 + noise(i, 4) * 18;
      g.fillStyle(0x8fa9b3, 0.35);
      g.fillEllipse(x + 4, y + 5, w, h);
      g.fillStyle(0xf3f8f9, 0.75);
      g.fillEllipse(x, y, w, h);
      g.fillStyle(0xffffff, 0.6);
      g.fillEllipse(x - w * 0.15, y - h * 0.2, w * 0.4, h * 0.35);
    });
    // Placas de hielo con brillo.
    spots(14, 301).forEach(({ x, y, i }) => {
      const w = 34 + noise(i, 5) * 40;
      const h = 12 + noise(i, 6) * 14;
      g.fillStyle(0xb9d8e2, 0.6);
      g.fillEllipse(x, y, w, h);
      g.fillStyle(0xffffff, 0.45);
      g.fillEllipse(x - w * 0.2, y - h * 0.2, w * 0.3, 2.5);
    });
    // Huellas junto a las calles.
    g.fillStyle(0x7c95a0, 0.5);
    for (let i = 0; i < 46; i += 1) {
      const along = noise(i, 311);
      const side = noise(i, 312) > 0.5 ? 1 : -1;
      const x = i % 2 ? cx + side * (STREET_HALF.ns + 14 + noise(i, 313) * 10) : 60 + along * (worldW - 120);
      const y = i % 2 ? 60 + along * (worldH - 120) : cy + side * (STREET_HALF.ew + 12 + noise(i, 313) * 10);
      if (!clear(x, y, -40)) continue;
      g.fillEllipse(x, y, 3, 5);
      g.fillEllipse(x + 6, y + 4, 3, 5);
    }
    stamp("tuft", spots(24, 321), [0.6, 0.4], 0xb8c8b0, 0.8);
  }
}

export function paintTownGround(scene, town, worldW, worldH, cx, cy, topPad = 0) {
  const biome = ["temperate", "mountain", "tropical", "desert", "snow"].includes(town.biome)
    ? town.biome
    : "temperate";
  const pal = palette(biome);

  // El piso sube topPad px por encima del mundo: es lo que la cámara enseña bajo el HUD.
  scene.add.tileSprite(worldW / 2, (worldH - topPad) / 2, worldW, worldH + topPad, town.ground).setDepth(-6);
  const mottle = scene.add.graphics().setDepth(-5.6);
  for (let i = 0; i < 24; i += 1) {
    mottle.fillStyle(pal.mottle[i % 2], 0.09 + noise(i, 15) * 0.08);
    mottle.fillEllipse(
      noise(i, 11) * worldW,
      noise(i, 12) * (worldH + topPad) - topPad,
      150 + noise(i, 13) * 220,
      110 + noise(i, 14) * 170,
    );
  }

  const gulf = Boolean(town.blocked?.south?.includes("GOLFO"));
  const southEnd = gulf ? worldH - 150 : worldH + 30;
  paintStreet(scene, wavyLine(cx, -30 - topPad, cx, southEnd, 12, 0.7), STREET_HALF.ns, town.path, pal);
  paintStreet(scene, wavyLine(-30, cy, worldW + 30, cy, 10, 2.1), STREET_HALF.ew, town.path, pal);
  paintPlaza(scene, cx, cy, PLAZA.rx, PLAZA.ry, biome, pal);
  paintTownDetail(scene, biome, worldW, worldH, cx, cy, gulf);
  if (gulf) paintShore(scene, worldW, worldH, biome);
}
