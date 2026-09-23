/** Guardias, bandidos, caballos y carreta — proto de encuentro. */

function paint(scene, key, w, h, draw) {
  const gfx = scene.add.graphics();
  draw(gfx);
  gfx.generateTexture(key, w, h);
  gfx.destroy();
}

function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
}

function paintGuard(g) {
  g.fillStyle(0x080604, 0.4);
  g.fillEllipse(22, 60, 18, 6);

  g.fillStyle(0x1a100c, 1);
  g.fillRoundedRect(14, 48, 7, 12, 2);
  g.fillRoundedRect(24, 48, 7, 12, 2);
  g.fillStyle(0x2a1810, 1);
  g.fillRect(14, 56, 7, 4);
  g.fillRect(24, 56, 7, 4);

  g.fillStyle(0x3a2014, 1);
  g.fillEllipse(22, 40, 16, 18);
  g.fillStyle(0x5a2018, 1);
  poly(g, [[12, 30], [22, 24], [32, 30], [30, 48], [14, 48]]);
  g.fillStyle(0xc9a227, 0.85);
  g.fillRect(12, 38, 20, 3);
  g.fillStyle(0x8a7a48, 1);
  g.fillCircle(22, 40, 2);

  g.fillStyle(0x4a4842, 1);
  g.fillCircle(8, 38, 8);
  g.fillStyle(0x5a2018, 1);
  g.fillCircle(8, 38, 4);

  g.fillStyle(0x6a6860, 1);
  g.fillEllipse(22, 18, 16, 14);
  g.fillStyle(0xc4a07a, 1);
  g.fillCircle(22, 22, 4);
  g.fillStyle(0x1a100c, 0.7);
  g.fillRect(16, 20, 12, 2);
  g.fillStyle(0x4a4842, 1);
  g.fillEllipse(22, 14, 18, 10);
  g.fillRect(20, 8, 4, 8);
  g.fillStyle(0x3a3834, 1);
  poly(g, [[14, 12], [22, 6], [30, 12], [22, 16]]);

  g.fillStyle(0x4a3424, 1);
  g.fillRect(40, 6, 3, 46);
  g.fillStyle(0x8a7a48, 1);
  poly(g, [[38, 6], [45, 6], [41.5, 0]]);
  g.fillStyle(0x6a6860, 1);
  g.fillRect(39, 28, 5, 6);
}

function paintBandit(g) {
  g.fillStyle(0x080604, 0.4);
  g.fillEllipse(22, 60, 18, 6);

  g.fillStyle(0x1a100c, 1);
  g.fillRoundedRect(14, 48, 7, 12, 2);
  g.fillRoundedRect(24, 48, 7, 12, 2);

  g.fillStyle(0x2a1810, 1);
  g.fillEllipse(22, 40, 18, 20);
  g.fillStyle(0x3a2014, 1);
  poly(g, [[10, 28], [22, 22], [34, 28], [32, 50], [12, 50]]);
  g.fillStyle(0x1a100c, 1);
  g.fillRect(12, 36, 20, 4);

  g.fillStyle(0x140c08, 1);
  g.fillEllipse(22, 18, 18, 16);
  g.fillStyle(0xc4a07a, 1);
  g.fillCircle(22, 22, 3);
  g.fillStyle(0x0c0806, 1);
  poly(g, [[10, 16], [22, 4], [34, 16], [30, 28], [14, 28]]);
  g.fillStyle(0x1a100c, 1);
  g.fillRect(16, 18, 12, 3);
  g.fillStyle(0xc4a07a, 0.7);
  g.fillCircle(18, 20, 1);
  g.fillCircle(26, 20, 1);

  g.fillStyle(0x6a6860, 1);
  poly(g, [[32, 40], [44, 34], [36, 44]]);
  g.fillStyle(0x4a3424, 1);
  g.fillRect(34, 36, 8, 3);
}

function paintHorse(g, pal) {
  g.fillStyle(0x080604, 0.35);
  g.fillEllipse(58, 74, 86, 12);

  g.fillStyle(pal.leg, 1);
  g.fillRect(28, 48, 6, 22);
  g.fillRect(40, 50, 6, 20);
  g.fillRect(70, 48, 6, 22);
  g.fillRect(82, 46, 6, 24);
  g.fillStyle(pal.hoof, 1);
  g.fillRect(26, 68, 10, 5);
  g.fillRect(38, 68, 10, 5);
  g.fillRect(68, 68, 10, 5);
  g.fillRect(80, 68, 10, 5);

  g.fillStyle(pal.dark, 1);
  g.fillEllipse(58, 44, 64, 28);
  g.fillStyle(pal.body, 1);
  g.fillEllipse(60, 40, 58, 24);

  g.fillStyle(pal.dark, 1);
  poly(g, [[78, 34], [96, 16], [108, 22], [90, 42]]);
  g.fillStyle(pal.body, 1);
  poly(g, [[82, 32], [98, 18], [106, 22], [90, 38]]);

  g.fillStyle(pal.body, 1);
  g.fillEllipse(110, 20, 22, 14);
  g.fillStyle(pal.dark, 1);
  g.fillEllipse(118, 22, 12, 8);
  g.fillStyle(0x1a1008, 1);
  g.fillCircle(118, 18, 2);
  g.fillStyle(pal.mane, 1);
  poly(g, [[100, 10], [104, 2], [110, 12]]);
  poly(g, [[94, 12], [96, 4], [102, 14]]);
  if (pal.blaze) {
    g.fillStyle(0xe8d8c4, 0.85);
    g.fillEllipse(116, 20, 4, 8);
  }

  g.fillStyle(pal.mane, 1);
  poly(g, [[22, 34], [4, 22], [8, 44], [26, 40]]);
  poly(g, [[76, 20], [86, 8], [92, 22], [80, 28]]);

  g.fillStyle(0x3a2014, 1);
  g.fillEllipse(56, 32, 20, 12);
  g.fillStyle(0x2a1810, 1);
  g.fillRect(48, 30, 16, 4);
  g.fillStyle(0xc9a227, 0.8);
  g.fillRect(52, 28, 8, 3);
  g.fillStyle(0x1a1008, 1);
  g.fillRect(96, 18, 16, 2);
}

function paintCart(g) {
  g.fillStyle(0x080604, 0.3);
  g.fillEllipse(48, 52, 82, 10);

  g.fillStyle(0x4a3424, 1);
  poly(g, [[8, 22], [6, 40], [90, 40], [88, 18], [48, 12]]);
  g.fillStyle(0x5a4030, 1);
  poly(g, [[12, 20], [14, 34], [84, 34], [82, 18], [48, 14]]);
  g.fillStyle(0x3a2818, 1);
  g.fillRect(8, 32, 82, 8);

  g.fillStyle(0x2a1c12, 1);
  g.fillCircle(24, 46, 10);
  g.fillCircle(72, 46, 10);
  g.fillStyle(0x5a4030, 1);
  g.fillCircle(24, 46, 4);
  g.fillCircle(72, 46, 4);
  g.fillStyle(0x1a1008, 1);
  g.fillCircle(24, 46, 2);
  g.fillCircle(72, 46, 2);

  g.fillStyle(0xc45c18, 1);
  g.fillCircle(40, 22, 5);
  g.fillCircle(54, 20, 4);
  g.fillStyle(0xe07020, 0.7);
  g.fillCircle(48, 24, 3);
}

function paintBarrier(g) {
  g.fillStyle(0x2a1c12, 1);
  g.fillRect(8, 2, 6, 22);
  g.fillRect(70, 2, 6, 22);
  g.fillRect(132, 2, 6, 22);
  g.fillStyle(0x4a3424, 1);
  g.fillRoundedRect(4, 8, 140, 7, 2);
  g.fillStyle(0x5a2018, 0.85);
  g.fillRect(18, 9, 40, 4);
  g.fillRect(90, 9, 40, 4);
  g.fillStyle(0x6a5420, 1);
  g.fillRect(6, 16, 136, 3);
}

function paintSack(g) {
  g.fillStyle(0x080604, 0.35);
  g.fillEllipse(14, 22, 20, 6);
  g.fillStyle(0x6a5420, 1);
  g.fillEllipse(14, 14, 18, 16);
  g.fillStyle(0x5a2018, 1);
  g.fillRect(10, 4, 8, 6);
  g.fillStyle(0xc45c18, 1);
  g.fillCircle(14, 14, 4);
}

function paintSmith(g) {
  g.fillStyle(0x080604, 0.4);
  g.fillEllipse(22, 60, 18, 6);
  g.fillStyle(0x1a100c, 1);
  g.fillRoundedRect(14, 48, 7, 12, 2);
  g.fillRoundedRect(24, 48, 7, 12, 2);
  g.fillStyle(0x3a2014, 1);
  g.fillEllipse(22, 40, 18, 20);
  g.fillStyle(0x4a3424, 1);
  poly(g, [[10, 26], [22, 22], [34, 28], [30, 50], [14, 50]]);
  g.fillStyle(0x6a6860, 1);
  g.fillRect(12, 34, 20, 6);
  g.fillStyle(0x2a1c12, 1);
  g.fillEllipse(22, 16, 14, 12);
  g.fillStyle(0xc4a07a, 1);
  g.fillCircle(22, 18, 3);
  g.fillStyle(0x1a100c, 1);
  g.fillEllipse(22, 12, 16, 8);
  g.fillStyle(0x4a4842, 1);
  g.fillRect(34, 22, 3, 18);
  g.fillStyle(0x6a6860, 1);
  poly(g, [[32, 20], [42, 18], [36, 26]]);
}

export function bakeNpcs(scene) {
  const keys = ["npc-guard", "npc-bandit", "npc-smith", "horse", "horse-dark", "cart", "barrier", "sack"];
  for (const key of keys) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }

  paint(scene, "npc-guard", 48, 64, paintGuard);
  paint(scene, "npc-bandit", 48, 64, paintBandit);
  paint(scene, "npc-smith", 48, 64, paintSmith);
  paint(scene, "horse", 128, 80, (g) => paintHorse(g, {
    body: 0x6a4a32,
    dark: 0x4a301c,
    leg: 0x2a1c12,
    hoof: 0x1a1008,
    mane: 0x2a1810,
    blaze: true,
  }));
  paint(scene, "horse-dark", 128, 80, (g) => paintHorse(g, {
    body: 0x2a2018,
    dark: 0x140c08,
    leg: 0x100804,
    hoof: 0x080604,
    mane: 0x0c0806,
    blaze: false,
  }));
  paint(scene, "cart", 96, 56, paintCart);
  paint(scene, "barrier", 148, 26, paintBarrier);
  paint(scene, "sack", 28, 26, paintSack);
}
