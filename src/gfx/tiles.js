/** Pisos orgánicos y deterministas. Evitan la rejilla de píxeles del primer proto. */

function noise(i, salt = 0) {
  const x = Math.sin((i + 1) * 91.73 + salt * 37.19) * 43758.5453;
  return x - Math.floor(x);
}

export function dither(g, w, h, colors, amount = 80) {
  for (let i = 0; i < amount; i += 1) {
    const x = Math.floor(noise(i, 1) * w);
    const y = Math.floor(noise(i, 2) * h);
    const size = noise(i, 3) > 0.82 ? 2 : 1;
    g.fillStyle(colors[i % colors.length], 0.36 + noise(i, 4) * 0.28);
    g.fillRect(x, y, size, size);
  }
}

function patch(g, x, y, w, h, color, alpha = 0.3) {
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y, w, h);
}

export function paintGrass(g, w = 96, h = 96) {
  g.fillStyle(0x3f5332, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0x273a20, 0x66804a, 0x35482a, 0x7b8b54], 210);

  for (let i = 0; i < 38; i += 1) {
    const x = 3 + noise(i, 5) * (w - 6);
    const y = 5 + noise(i, 6) * (h - 10);
    const tall = 2 + noise(i, 7) * 5;
    const lean = noise(i, 8) * 3 - 1.5;
    g.lineStyle(1, i % 4 === 0 ? 0x78905a : 0x2b4022, 0.55);
    g.lineBetween(x, y, x + lean, y - tall);
  }
}

export function paintMoss(g, w = 96, h = 96) {
  g.fillStyle(0x263a34, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0x506158, 0x172822, 0x314941, 0x6b7460], 190);

  for (let i = 0; i < 26; i += 1) {
    const x = 4 + noise(i, 9) * (w - 8);
    const y = 7 + noise(i, 10) * (h - 12);
    g.lineStyle(1, 0x4d6758, 0.42);
    g.lineBetween(x, y, x + noise(i, 11) * 2, y - 2 - noise(i, 12) * 3);
  }
}

/** Altiplano: pasto corto y frío con roca asomando. El piso de Valkeep. */
export function paintHighland(g, w = 96, h = 96) {
  g.fillStyle(0x4a5a42, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0x33422e, 0x6d7a58, 0x475639, 0x8a927a], 200);

  for (let i = 0; i < 26; i += 1) {
    const x = 3 + noise(i, 41) * (w - 6);
    const y = 6 + noise(i, 42) * (h - 10);
    g.lineStyle(1, i % 3 === 0 ? 0x7f8a63 : 0x35442c, 0.5);
    g.lineBetween(x, y, x + noise(i, 43) * 2 - 1, y - 2 - noise(i, 44) * 3);
  }
}

export function paintJungle(g, w = 96, h = 96) {
  g.fillStyle(0x1d4229, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0x0f2a1a, 0x4a8050, 0x86b16a, 0x1b3d27], 260);

  // Hojarasca: hojas anchas en vez de pelusa de pasto.
  for (let i = 0; i < 26; i += 1) {
    const x = 6 + noise(i, 31) * (w - 12);
    const y = 8 + noise(i, 32) * (h - 14);
    const long = 5 + noise(i, 33) * 7;
    const lean = noise(i, 34) * 2 - 1;
    g.fillStyle(i % 3 === 0 ? 0x74a45f : i % 3 === 1 ? 0x2c5c35 : 0x16351f, 0.75);
    g.fillEllipse(x, y, long, long * 0.42);
    g.lineStyle(1, 0x0e2416, 0.4);
    g.lineBetween(x - long / 2, y, x + long / 2 + lean, y);
  }

  // Raíces y lianas sueltas.
  for (let i = 0; i < 7; i += 1) {
    const x = noise(i, 35) * w;
    const y = noise(i, 36) * h;
    g.lineStyle(2, 0x123021, 0.45);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 14 + noise(i, 37) * 12, y + 6 - noise(i, 38) * 12);
    g.lineTo(x + 30 + noise(i, 39) * 14, y + 14 - noise(i, 40) * 10);
    g.strokePath();
  }
}

export function paintSand(g, w = 96, h = 96) {
  g.fillStyle(0xb88a50, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0xe3bd79, 0x8c623b, 0xc79b5d, 0x725039], 200);
  g.lineStyle(1, 0x7d5533, 0.28);
  for (let i = 0; i < 5; i += 1) {
    const y = 12 + i * 19;
    g.beginPath();
    g.moveTo(-4, y);
    g.lineTo(28, y + 3);
    g.lineTo(62, y - 2);
    g.lineTo(100, y + 2);
    g.strokePath();
  }
}

export function paintSnow(g, w = 96, h = 96) {
  g.fillStyle(0xbccfd3, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0xf5fbfa, 0x789ba5, 0xd5e4e5, 0x9bb7bd], 190);
}

export function paintWater(g, w = 96, h = 96) {
  g.fillStyle(0x2a5f6e, 1);
  g.fillRect(0, 0, w, h);
  dither(g, w, h, [0x1a4450, 0x6aa8ad, 0x245864, 0x8fc4c2], 170);
  g.lineStyle(1, 0x9fd4d2, 0.22);
  for (let i = 0; i < 6; i += 1) {
    const y = 10 + i * 16;
    g.beginPath();
    g.moveTo(-2, y);
    g.lineTo(24, y + 2);
    g.lineTo(52, y - 1);
    g.lineTo(98, y + 2);
    g.strokePath();
  }
}

export function paintDirt(g, w = 96, h = 96) {
  g.fillStyle(0x76543b, 1);
  g.fillRect(0, 0, w, h);
  // Sin surcos en el tile: las rodadas se dibujan siguiendo la curva del camino.
  dither(g, w, h, [0x3c2b22, 0xb18a5d, 0x5c4231, 0xd0a46d], 220);
}

function stone(g, pts, fill, edge, shine) {
  g.fillStyle(fill, 1);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, edge, 0.58);
  g.strokePath();
  g.lineStyle(1, shine, 0.22);
  g.lineBetween(pts[0][0] + 2, pts[0][1] + 2, pts[1][0] - 2, pts[1][1] + 2);
}

export function paintCobble(g, w = 96, h = 96) {
  const fills = [0x77716a, 0x68665f, 0x858077, 0x5d635d, 0x71685d, 0x8b806f];
  g.fillStyle(0x393631, 1);
  g.fillRect(0, 0, w, h);

  let id = 0;
  for (let row = 0, y = -3; y < h + 4; row += 1, y += 18) {
    let x = row % 2 === 0 ? -12 : -25;
    while (x < w + 8) {
      const sw = 22 + Math.floor(noise(id, 20) * 13);
      const top = y + Math.floor(noise(id, 21) * 3);
      const bottom = y + 15 + Math.floor(noise(id, 22) * 3);
      const pts = [
        [x + 2, top + 2],
        [x + sw - 3, top],
        [x + sw, bottom - 3],
        [x + sw - 4, bottom],
        [x + 1, bottom - 1],
        [x - 1, top + 6],
      ];
      stone(g, pts, fills[id % fills.length], 0x292824, 0xd7c8ae);
      x += sw + 3;
      id += 1;
    }
  }

  dither(g, w, h, [0xe0d2b9, 0x2d2b27], 34);
}
