/** Texturas proto — medieval de película. */

import { paintCobble, paintDirt, paintGrass, paintHighland, paintJungle, paintMoss, paintSand, paintSnow, paintWater } from "./tiles.js";
import { bakeWalker, createWalkerAnims } from "./walker.js";
import { bakeNpcs } from "./npcs.js";

const KEYS = [
  "grass", "moss", "highland", "jungle", "sand", "snow", "dirt", "cobble", "water",
  "house-a", "house-b", "house-c",
  "tree", "tree-pine", "tree-palm", "fern", "flowers",
  "bush", "rock", "ore-pile", "barrel", "crate", "hay",
  "ember", "dust", "leaf", "snowflake", "rune-mote", "smoke", "torch",
  "stall", "well", "forge", "post", "gate", "banner",
  "cliff", "boulder", "cactus", "tree-bare", "tree-pine-snow", "lantern",
  "stall-side", "fence", "roof-snow", "roof-vines", "bigleaf", "reed", "tuft", "bones",
];

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

export function bakeAll(scene) {
  for (const key of KEYS) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }

  paint(scene, "grass", 96, 96, paintGrass);
  paint(scene, "moss", 96, 96, paintMoss);
  paint(scene, "highland", 96, 96, paintHighland);
  paint(scene, "jungle", 96, 96, paintJungle);
  paint(scene, "sand", 96, 96, paintSand);
  paint(scene, "snow", 96, 96, paintSnow);
  paint(scene, "water", 96, 96, paintWater);
  paint(scene, "dirt", 96, 96, paintDirt);
  paint(scene, "cobble", 96, 96, paintCobble);

  paintCottage(scene, "house-a", "hall");
  paintCottage(scene, "house-b", "keep");
  paintCottage(scene, "house-c", "shed");

  paint(scene, "tree", 52, 64, (g) => {
    g.fillStyle(0x090b07, 0.36);
    g.fillEllipse(28, 59, 34, 9);
    g.fillStyle(0x352315, 1);
    poly(g, [[22, 30], [20, 58], [31, 58], [29, 30]]);
    g.fillStyle(0x5a3b20, 0.65);
    poly(g, [[24, 32], [23, 56], [27, 56], [27, 31]]);
    g.fillStyle(0x172a17, 1);
    g.fillCircle(26, 22, 18);
    g.fillCircle(14, 27, 12);
    g.fillCircle(38, 26, 13);
    g.fillStyle(0x294326, 1);
    g.fillCircle(18, 18, 11);
    g.fillCircle(34, 15, 12);
    g.fillCircle(27, 29, 12);
    g.fillStyle(0x4d6540, 0.65);
    g.fillCircle(17, 15, 5);
    g.fillCircle(32, 12, 6);
    g.fillCircle(40, 23, 4);
  });

  paint(scene, "tree-pine", 46, 74, (g) => {
    g.fillStyle(0x090b07, 0.34);
    g.fillEllipse(23, 69, 28, 8);
    g.fillStyle(0x2e2014, 1);
    g.fillRect(20, 52, 5, 16);
    const tiers = [[23, 52, 19, 16], [23, 38, 16, 15], [23, 25, 12, 14], [23, 14, 8, 12]];
    tiers.forEach(([x, y, half, tall], i) => {
      g.fillStyle(i % 2 ? 0x1d3a26 : 0x14291b, 1);
      poly(g, [[x - half, y], [x, y - tall], [x + half, y]]);
      g.fillStyle(0x3d6140, 0.5);
      poly(g, [[x - half + 4, y - 1], [x - 1, y - tall + 3], [x, y - 1]]);
    });
  });

  paint(scene, "tree-palm", 62, 76, (g) => {
    g.fillStyle(0x090b07, 0.32);
    g.fillEllipse(30, 71, 30, 8);
    g.fillStyle(0x51381f, 1);
    poly(g, [[25, 70], [31, 70], [39, 30], [33, 28]]);
    g.fillStyle(0x6d4c2a, 0.7);
    poly(g, [[27, 68], [30, 68], [37, 31], [34, 30]]);
    const fronds = [[-26, 4], [-18, -12], [2, -20], [20, -10], [26, 6], [8, 10]];
    fronds.forEach(([dx, dy], i) => {
      g.fillStyle(i % 2 ? 0x2f6b3a : 0x1f4b29, 1);
      poly(g, [[36, 28], [36 + dx, 28 + dy], [36 + dx * 0.72, 28 + dy + 9], [34, 33]]);
    });
    g.fillStyle(0x7fbb69, 0.4);
    g.fillCircle(36, 28, 5);
  });

  paint(scene, "fern", 38, 26, (g) => {
    g.fillStyle(0x0a0c08, 0.24);
    g.fillEllipse(19, 24, 28, 5);
    const blades = [[-15, -12], [-8, -18], [0, -20], [8, -17], [15, -11]];
    blades.forEach(([dx, dy], i) => {
      g.fillStyle(i % 2 ? 0x356b3c : 0x214a2a, 1);
      poly(g, [[19, 24], [19 + dx, 24 + dy], [19 + dx * 0.6, 24 + dy + 7]]);
    });
  });

  paint(scene, "flowers", 26, 16, (g) => {
    g.fillStyle(0x2c4a28, 1);
    for (let i = 0; i < 5; i += 1) g.lineBetween(4 + i * 4, 14, 4 + i * 4, 8);
    const tones = [0xd8c35a, 0xc9648a, 0xe0dcc4, 0xd8c35a, 0xb85f7a];
    tones.forEach((tone, i) => {
      g.fillStyle(tone, 0.95);
      g.fillCircle(4 + i * 4, 7 - (i % 2) * 2, 2.4);
    });
  });

  paint(scene, "bush", 32, 22, (g) => {
    g.fillStyle(0x0a0c08, 0.28);
    g.fillEllipse(16, 20, 26, 5);
    g.fillStyle(0x1b301b, 1);
    g.fillCircle(9, 14, 8);
    g.fillCircle(17, 11, 10);
    g.fillCircle(25, 15, 7);
    g.fillStyle(0x3b5533, 0.85);
    g.fillCircle(15, 8, 5);
    g.fillCircle(23, 12, 4);
  });

  paint(scene, "rock", 32, 22, (g) => {
    g.fillStyle(0x090b08, 0.34);
    g.fillEllipse(16, 19, 27, 6);
    g.fillStyle(0x58564d, 1);
    poly(g, [[3, 17], [7, 8], [17, 3], [28, 9], [30, 18]]);
    g.fillStyle(0x777268, 0.9);
    poly(g, [[7, 8], [17, 3], [21, 10], [12, 12]]);
    g.lineStyle(1, 0x282824, 0.6);
    g.lineBetween(21, 10, 28, 9);
  });

  paint(scene, "ore-pile", 54, 34, (g) => {
    g.fillStyle(0x090805, 0.38);
    g.fillEllipse(27, 29, 46, 8);
    [[9, 22, 9], [20, 17, 11], [31, 21, 10], [42, 19, 8], [28, 10, 9]].forEach(([x, y, r], i) => {
      g.fillStyle(i % 2 ? 0x4f4840 : 0x675d50, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0xd9782d, 0.9);
      g.fillCircle(x - 2, y - 2, Math.max(2, r / 3));
      g.fillStyle(0xffc467, 0.55);
      g.fillCircle(x - 3, y - 3, 1.5);
    });
  });

  paint(scene, "barrel", 26, 34, (g) => {
    g.fillStyle(0x0a0806, 0.35);
    g.fillEllipse(13, 31, 22, 5);
    g.fillStyle(0x6d4828, 1);
    g.fillRoundedRect(4, 5, 18, 26, 6);
    g.fillStyle(0x8a5f33, 1);
    g.fillEllipse(13, 6, 18, 6);
    g.lineStyle(2, 0x2a211a, 0.8);
    g.strokeEllipse(13, 6, 18, 6);
    g.lineBetween(4, 13, 22, 13);
    g.lineBetween(4, 24, 22, 24);
  });

  paint(scene, "crate", 30, 28, (g) => {
    g.fillStyle(0x0a0806, 0.32);
    g.fillEllipse(15, 26, 26, 5);
    g.fillStyle(0x765331, 1);
    g.fillRect(3, 3, 24, 22);
    g.lineStyle(2, 0x3f2b1d, 0.9);
    g.strokeRect(3, 3, 24, 22);
    g.lineBetween(5, 5, 25, 23);
    g.lineBetween(25, 5, 5, 23);
  });

  paint(scene, "hay", 40, 22, (g) => {
    g.fillStyle(0x0a0806, 0.28);
    g.fillEllipse(20, 20, 36, 5);
    g.fillStyle(0x9d7735, 1);
    g.fillRoundedRect(2, 5, 36, 15, 6);
    g.lineStyle(1, 0xe1b85c, 0.65);
    for (let i = 0; i < 8; i += 1) g.lineBetween(5 + i * 4, 6, 2 + i * 5, 18);
    g.lineStyle(2, 0x5b3c22, 0.75);
    g.lineBetween(18, 5, 18, 20);
  });

  paint(scene, "ember", 28, 28, (g) => {
    g.fillStyle(0xe07020, 0.2);
    g.fillCircle(14, 14, 13);
    g.fillStyle(0xc45c18, 1);
    g.fillCircle(13, 13, 8);
    g.fillStyle(0xf0a040, 1);
    g.fillCircle(11, 11, 4);
    g.fillStyle(0xffe8b0, 0.85);
    g.fillCircle(10, 10, 2);
  });

  paint(scene, "dust", 8, 8, (g) => {
    g.fillStyle(0xd8b77f, 0.8);
    g.fillCircle(4, 4, 2.5);
  });

  paint(scene, "leaf", 10, 8, (g) => {
    g.fillStyle(0x66834c, 0.9);
    g.fillEllipse(5, 4, 8, 4);
  });

  paint(scene, "snowflake", 8, 8, (g) => {
    g.fillStyle(0xf4fbff, 0.92);
    g.fillCircle(4, 4, 2.2);
    g.lineStyle(1, 0xcde7ed, 0.8);
    g.lineBetween(1, 4, 7, 4);
    g.lineBetween(4, 1, 4, 7);
  });

  paint(scene, "rune-mote", 8, 8, (g) => {
    g.fillStyle(0xb89cff, 0.3);
    g.fillCircle(4, 4, 3.5);
    g.fillStyle(0xe4d9ff, 0.95);
    g.fillCircle(4, 4, 1.4);
  });

  paint(scene, "smoke", 18, 18, (g) => {
    g.fillStyle(0xb8afa1, 0.5);
    g.fillCircle(9, 9, 7);
    g.fillStyle(0xd4cabb, 0.25);
    g.fillCircle(6, 6, 4);
  });

  paint(scene, "torch", 16, 28, (g) => {
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(6, 12, 4, 14);
    g.fillStyle(0xe07020, 1);
    g.fillCircle(8, 8, 5);
    g.fillStyle(0xffe8b0, 1);
    g.fillCircle(8, 6, 2);
  });

  paint(scene, "stall", 120, 92, (g) => {
    g.fillStyle(0x080604, 0.35);
    g.fillEllipse(60, 86, 92, 12);
    g.fillStyle(0x2a1c12, 1);
    poly(g, [[18, 50], [12, 78], [22, 84], [100, 82], [108, 72], [98, 48]]);
    g.fillStyle(0x5a2018, 1);
    poly(g, [[8, 52], [30, 16], [60, 6], [94, 14], [114, 50], [60, 38]]);
    // Rayas del toldo: crema sobre rojo, siguiendo la caída de la tela.
    g.fillStyle(0xe8d9b8, 0.85);
    poly(g, [[22, 46], [38, 14], [46, 11], [34, 44]]);
    poly(g, [[50, 40], [60, 6], [70, 8], [62, 40]]);
    poly(g, [[86, 44], [82, 12], [90, 13], [100, 46]]);
    g.fillStyle(0x3a1410, 0.7);
    poly(g, [[24, 50], [60, 20], [96, 50], [60, 42]]);
    g.fillStyle(0x2a1c12, 0.55);
    poly(g, [[8, 52], [60, 38], [114, 50], [110, 54], [60, 42], [12, 56]]);
    g.fillStyle(0x6a5420, 1);
    g.fillRoundedRect(28, 54, 64, 16, 3);
    g.fillStyle(0x8a6a2a, 0.7);
    g.fillRect(30, 55, 60, 3);
    g.fillStyle(0xc9a227, 1);
    g.fillEllipse(40, 56, 12, 6);
    g.fillStyle(0x6a9a58, 1);
    g.fillEllipse(58, 55, 14, 7);
    g.fillStyle(0xd86c3a, 1);
    g.fillEllipse(78, 56, 12, 6);
    g.fillStyle(0xc45c18, 1);
    g.fillCircle(26, 68, 6);
    g.fillCircle(94, 66, 6);
  });

  paint(scene, "well", 40, 32, (g) => {
    g.fillStyle(0x3a3834, 1);
    g.fillEllipse(20, 22, 32, 16);
    g.fillStyle(0x0c1014, 1);
    g.fillEllipse(20, 21, 18, 9);
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(8, 6, 3, 14);
    g.fillRect(28, 6, 3, 14);
    g.fillRect(8, 5, 23, 3);
  });

  paint(scene, "forge", 96, 72, (g) => {
    g.fillStyle(0x080604, 0.4);
    g.fillEllipse(48, 66, 70, 12);
    g.fillStyle(0x3a2818, 1);
    poly(g, [[8, 40], [6, 62], [90, 62], [88, 38], [48, 32]]);
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(14, 44, 68, 12);
    g.fillStyle(0x4a4842, 1);
    poly(g, [[28, 28], [22, 46], [74, 46], [68, 28], [48, 22]]);
    g.fillStyle(0x2e2c28, 1);
    g.fillEllipse(48, 30, 36, 16);
    g.fillStyle(0xc45c18, 1);
    g.fillCircle(44, 28, 8);
    g.fillCircle(52, 26, 6);
    g.fillStyle(0xffe8b0, 0.8);
    g.fillCircle(46, 26, 3);
    g.fillStyle(0x3a3834, 1);
    g.fillEllipse(70, 50, 22, 10);
    g.fillRect(64, 38, 12, 14);
    g.fillStyle(0x6a6860, 1);
    g.fillRect(78, 18, 4, 28);
    g.fillStyle(0x4a4842, 1);
    poly(g, [[74, 18], [90, 14], [82, 24]]);
  });

  paint(scene, "post", 22, 40, (g) => {
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(9, 10, 4, 28);
    g.fillStyle(0x5a2018, 1);
    poly(g, [[4, 6], [18, 6], [16, 18], [6, 18]]);
  });

  paint(scene, "banner", 18, 36, (g) => {
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(4, 2, 3, 32);
    g.fillStyle(0x5a2018, 1);
    poly(g, [[7, 4], [16, 8], [7, 20]]);
  });

  paint(scene, "gate", 130, 96, (g) => {
    g.fillStyle(0x3a3834, 1);
    poly(g, [[8, 20], [4, 92], [34, 94], [36, 18], [22, 8]]);
    poly(g, [[94, 18], [96, 94], [126, 92], [122, 20], [108, 8]]);
    g.fillStyle(0x2e2c28, 1);
    g.fillRect(6, 8, 28, 10);
    g.fillRect(96, 8, 28, 10);
    g.fillStyle(0x12100c, 1);
    g.slice(65, 94, 32, Math.PI, 0, true);
    g.fillPath();
    g.fillStyle(0x5a2018, 1);
    poly(g, [[40, 22], [65, 10], [90, 22], [65, 28]]);
  });

  bakeScenery(scene);
  bakeWalker(scene);
  createWalkerAnims(scene);
  bakeNpcs(scene);
}

/** Props de paisaje: risco, peñasco, cactus, árboles de clima, farol, cerca. */
function bakeScenery(scene) {
  // Risco: pared de roca estratificada con cima clara y sombra al pie.
  paint(scene, "cliff", 150, 96, (g) => {
    g.fillStyle(0x090b08, 0.36);
    g.fillEllipse(75, 90, 130, 12);
    g.fillStyle(0x3f4640, 1);
    poly(g, [[4, 88], [8, 40], [30, 22], [58, 30], [76, 12], [104, 26], [128, 18], [146, 44], [148, 88]]);
    g.fillStyle(0x5b655c, 1);
    poly(g, [[12, 42], [30, 26], [58, 34], [76, 18], [104, 30], [128, 24], [142, 44], [126, 50], [96, 42], [70, 48], [44, 44]]);
    g.fillStyle(0x8a978a, 0.9);
    poly(g, [[30, 26], [58, 34], [52, 40], [34, 36]]);
    poly(g, [[76, 18], [104, 30], [98, 36], [80, 28]]);
    poly(g, [[128, 24], [142, 44], [134, 46]]);
    g.fillStyle(0x2c322d, 0.75);
    poly(g, [[8, 60], [146, 62], [148, 88], [4, 88]]);
    g.lineStyle(2, 0x262b27, 0.7);
    [[14, 56, 140, 58], [10, 68, 144, 70], [12, 78, 142, 80]].forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d));
    g.lineStyle(1, 0x9aa79b, 0.35);
    [[20, 50, 60, 52], [80, 46, 130, 48]].forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d));
    g.fillStyle(0x4a5a42, 0.8);
    g.fillCircle(24, 86, 7);
    g.fillCircle(118, 87, 6);
    g.fillCircle(70, 88, 5);
  });

  paint(scene, "boulder", 54, 40, (g) => {
    g.fillStyle(0x090b08, 0.36);
    g.fillEllipse(27, 35, 48, 9);
    g.fillStyle(0x4f5049, 1);
    poly(g, [[4, 30], [8, 14], [22, 4], [40, 6], [50, 18], [48, 32]]);
    g.fillStyle(0x767468, 1);
    poly(g, [[8, 14], [22, 4], [40, 6], [36, 14], [18, 18]]);
    g.fillStyle(0x94918a, 0.7);
    poly(g, [[22, 4], [34, 6], [30, 11], [20, 10]]);
    g.lineStyle(1, 0x2b2b27, 0.6);
    g.lineBetween(18, 18, 30, 30);
    g.lineBetween(36, 14, 44, 26);
    g.fillStyle(0x5f7a4c, 0.75);
    g.fillEllipse(12, 30, 10, 6);
  });

  paint(scene, "cactus", 34, 52, (g) => {
    g.fillStyle(0x0a0806, 0.3);
    g.fillEllipse(17, 48, 26, 6);
    g.fillStyle(0x3f6b3a, 1);
    g.fillRoundedRect(12, 8, 10, 40, 5);
    g.fillRoundedRect(2, 18, 8, 16, 4);
    g.fillRect(6, 30, 8, 5);
    g.fillRoundedRect(24, 12, 8, 18, 4);
    g.fillRect(20, 26, 8, 5);
    g.fillStyle(0x6b9a58, 0.7);
    g.fillRoundedRect(14, 10, 3, 34, 2);
    g.fillRoundedRect(4, 20, 2, 12, 1);
    g.fillRoundedRect(26, 14, 2, 14, 1);
    g.fillStyle(0xf0e0c0, 0.85);
    for (let i = 0; i < 6; i += 1) g.fillCircle(21, 12 + i * 6, 0.9);
    g.fillStyle(0xd86c7a, 0.9);
    g.fillCircle(17, 8, 3);
  });

  paint(scene, "tree-bare", 48, 70, (g) => {
    g.fillStyle(0x090b07, 0.3);
    g.fillEllipse(24, 66, 30, 7);
    g.fillStyle(0x3a2d24, 1);
    poly(g, [[21, 40], [20, 66], [28, 66], [27, 40]]);
    g.lineStyle(3, 0x3a2d24, 1);
    g.lineBetween(24, 42, 12, 26);
    g.lineBetween(24, 40, 36, 22);
    g.lineBetween(24, 36, 24, 14);
    g.lineStyle(2, 0x4a3b30, 1);
    g.lineBetween(12, 26, 6, 14);
    g.lineBetween(12, 26, 16, 12);
    g.lineBetween(36, 22, 42, 10);
    g.lineBetween(36, 22, 30, 8);
    g.lineBetween(24, 20, 18, 6);
    g.lineBetween(24, 18, 31, 4);
    g.lineStyle(1.5, 0xe7f1f3, 0.9);
    g.lineBetween(12, 25, 6, 13);
    g.lineBetween(36, 21, 42, 9);
    g.lineBetween(24, 19, 18, 5);
  });

  paint(scene, "tree-pine-snow", 46, 74, (g) => {
    g.fillStyle(0x090b07, 0.3);
    g.fillEllipse(23, 69, 28, 8);
    g.fillStyle(0x2e2014, 1);
    g.fillRect(20, 52, 5, 16);
    const tiers = [[23, 52, 19, 16], [23, 38, 16, 15], [23, 25, 12, 14], [23, 14, 8, 12]];
    tiers.forEach(([x, y, half, tall], i) => {
      g.fillStyle(i % 2 ? 0x24463a : 0x1a3329, 1);
      poly(g, [[x - half, y], [x, y - tall], [x + half, y]]);
      g.fillStyle(0xe9f3f5, 0.92);
      poly(g, [[x - half + 2, y - 1], [x - half * 0.35, y - tall * 0.42], [x, y - tall + 2], [x + half * 0.4, y - tall * 0.4], [x + half - 2, y - 1], [x + half * 0.5, y - 4], [x, y - 3], [x - half * 0.5, y - 5]]);
    });
  });

  paint(scene, "lantern", 22, 52, (g) => {
    g.fillStyle(0x0a0806, 0.32);
    g.fillEllipse(11, 49, 16, 4);
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(9, 16, 4, 32);
    g.fillRect(4, 46, 14, 3);
    g.fillRect(9, 10, 8, 2);
    g.fillStyle(0x3a3834, 1);
    g.fillRoundedRect(12, 10, 8, 12, 2);
    g.fillStyle(0xffb347, 0.95);
    g.fillRoundedRect(13, 12, 6, 8, 1);
    g.fillStyle(0xfff0c0, 1);
    g.fillCircle(16, 16, 1.8);
  });

  // Puesto lateral: mesa con toldo a rayas y mercancía encima.
  paint(scene, "stall-side", 82, 62, (g) => {
    g.fillStyle(0x080604, 0.34);
    g.fillEllipse(41, 58, 66, 9);
    g.fillStyle(0x2a1c12, 1);
    g.fillRect(8, 30, 4, 26);
    g.fillRect(70, 30, 4, 26);
    g.fillStyle(0x5b3d24, 1);
    g.fillRect(10, 36, 62, 12);
    g.fillStyle(0x3a2718, 0.8);
    g.fillRect(10, 46, 62, 3);
    g.fillStyle(0xb8cfd0, 1);
    poly(g, [[4, 28], [14, 8], [68, 8], [78, 28]]);
    for (let i = 0; i < 4; i += 1) {
      g.fillStyle(0x8a3a3a, 1);
      poly(g, [[8 + i * 18, 28], [16 + i * 16, 8], [24 + i * 16, 8], [18 + i * 18, 28]]);
    }
    g.fillStyle(0x2a1c12, 0.5);
    g.fillRect(4, 27, 74, 3);
    g.fillStyle(0xc9a227, 1);
    g.fillEllipse(24, 34, 12, 6);
    g.fillStyle(0xd86c3a, 1);
    g.fillEllipse(40, 33, 12, 7);
    g.fillStyle(0x6a9a58, 1);
    g.fillEllipse(56, 34, 12, 6);
  });

  paint(scene, "fence", 72, 30, (g) => {
    g.fillStyle(0x0a0806, 0.26);
    g.fillEllipse(36, 27, 66, 5);
    g.fillStyle(0x5b3d24, 1);
    for (let i = 0; i < 4; i += 1) g.fillRect(4 + i * 21, 6, 5, 20);
    g.fillStyle(0x7a5533, 1);
    g.fillRect(2, 10, 68, 3);
    g.fillRect(2, 18, 68, 3);
    g.fillStyle(0x3a2718, 0.6);
    for (let i = 0; i < 4; i += 1) g.fillRect(4 + i * 21, 6, 2, 20);
  });

  // Nieve para el techo de las casas: coincide con el polígono del tejado.
  paint(scene, "roof-snow", 156, 148, (g) => {
    g.fillStyle(0xeaf3f5, 0.96);
    poly(g, [[8, 66], [28, 46], [78, 36], [128, 46], [150, 66], [136, 62], [120, 66], [96, 58], [78, 62], [60, 58], [36, 66], [20, 62]]);
    g.fillStyle(0xffffff, 0.7);
    poly(g, [[30, 52], [78, 40], [124, 52], [78, 48]]);
    g.fillStyle(0xc9dbe0, 0.65);
    poly(g, [[8, 66], [20, 62], [36, 66], [30, 70]]);
    poly(g, [[120, 66], [136, 62], [150, 66], [130, 70]]);
    g.fillStyle(0xeaf3f5, 0.9);
    g.fillEllipse(118, 48, 12, 6);
  });

  // Enredaderas para las casas de selva: cuelgan del borde del tejado.
  paint(scene, "roof-vines", 156, 148, (g) => {
    g.lineStyle(3, 0x2f6b34, 0.95);
    [[20, 64, 14, 96], [40, 66, 36, 104], [62, 60, 58, 90], [98, 60, 102, 96], [124, 64, 130, 100], [142, 68, 146, 92]].forEach(([x1, y1, x2, y2]) => {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo((x1 + x2) / 2 + 4, (y1 + y2) / 2);
      g.lineTo(x2, y2);
      g.strokePath();
    });
    g.fillStyle(0x3f8a44, 0.95);
    [[16, 80], [14, 94], [38, 84], [36, 102], [58, 78], [100, 78], [102, 94], [128, 84], [130, 98], [146, 90]].forEach(([x, y]) => {
      g.fillEllipse(x, y, 9, 6);
    });
    g.fillStyle(0x8fd08a, 0.7);
    [[16, 79], [38, 83], [100, 77], [128, 83]].forEach(([x, y]) => g.fillEllipse(x - 1, y - 1, 4, 3));
    g.fillStyle(0x4d7a3a, 0.85);
    g.fillEllipse(78, 44, 30, 8);
    g.fillEllipse(48, 50, 22, 7);
    g.fillEllipse(110, 50, 24, 7);
    g.fillStyle(0xd86c7a, 0.9);
    g.fillCircle(37, 100, 2.2);
    g.fillCircle(129, 96, 2.2);
  });

  paint(scene, "bigleaf", 46, 34, (g) => {
    g.fillStyle(0x0a0c08, 0.22);
    g.fillEllipse(23, 31, 32, 5);
    g.fillStyle(0x1f5a2e, 1);
    poly(g, [[23, 30], [4, 14], [10, 6], [23, 2], [38, 6], [42, 16]]);
    g.fillStyle(0x3c8a48, 0.75);
    poly(g, [[23, 28], [10, 14], [16, 8], [23, 6]]);
    g.lineStyle(1, 0x8fd08a, 0.5);
    g.lineBetween(23, 28, 23, 6);
    g.lineBetween(23, 20, 12, 12);
    g.lineBetween(23, 18, 34, 10);
  });

  paint(scene, "reed", 24, 40, (g) => {
    g.lineStyle(2, 0x5f7a3a, 1);
    [[4, 38, 6, 8], [10, 38, 12, 4], [16, 38, 18, 10], [12, 38, 9, 14]].forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d));
    g.fillStyle(0x6b4a2a, 1);
    g.fillEllipse(6, 8, 4, 10);
    g.fillEllipse(12, 5, 4, 10);
    g.fillEllipse(18, 10, 4, 9);
  });

  paint(scene, "tuft", 22, 14, (g) => {
    g.lineStyle(2, 0x5a7a3a, 0.95);
    [[4, 13, 2, 4], [8, 13, 7, 2], [12, 13, 13, 3], [16, 13, 19, 5], [10, 13, 10, 1]].forEach(([a, b, c, d]) => g.lineBetween(a, b, c, d));
    g.lineStyle(1, 0x9ab86a, 0.7);
    g.lineBetween(9, 13, 8, 4);
    g.lineBetween(13, 13, 15, 5);
  });

  paint(scene, "bones", 40, 20, (g) => {
    g.fillStyle(0x0a0806, 0.2);
    g.fillEllipse(20, 17, 34, 5);
    g.fillStyle(0xe6dcc4, 1);
    g.fillEllipse(12, 10, 16, 12);
    g.fillStyle(0x3a3128, 1);
    g.fillEllipse(9, 9, 4, 4);
    g.fillEllipse(15, 9, 4, 4);
    g.fillStyle(0xe6dcc4, 1);
    g.fillRect(22, 8, 14, 3);
    g.fillCircle(22, 9, 2.5);
    g.fillCircle(36, 9, 2.5);
    g.fillRect(24, 14, 12, 2.5);
  });
}

function paintCottage(scene, key, kind) {
  paint(scene, key, 156, 148, (g) => {
    g.fillStyle(0x080604, 0.4);
    g.fillEllipse(80, 140, 90, 12);

    g.fillStyle(0x6a5844, 1);
    if (kind === "keep") {
      poly(g, [[32, 58], [22, 70], [20, 130], [42, 138], [112, 134], [128, 120], [124, 62], [90, 54]]);
    } else if (kind === "shed") {
      poly(g, [[14, 64], [8, 120], [26, 136], [134, 130], [146, 108], [138, 58], [78, 62], [28, 56]]);
    } else {
      poly(g, [[16, 60], [10, 82], [14, 128], [34, 138], [140, 132], [148, 110], [142, 58], [98, 52], [46, 54]]);
    }

    g.fillStyle(0x7a684e, 1);
    if (kind === "keep") {
      poly(g, [[36, 66], [28, 76], [26, 122], [46, 128], [108, 124], [120, 112], [116, 68]]);
    } else if (kind === "shed") {
      poly(g, [[20, 72], [16, 116], [32, 126], [128, 120], [136, 100], [130, 66]]);
    } else {
      poly(g, [[22, 68], [18, 122], [38, 130], [132, 124], [140, 102], [134, 66], [90, 62]]);
    }

    g.fillStyle(0x4a4842, 1);
    if (kind === "keep") {
      poly(g, [[22, 126], [20, 132], [42, 138], [112, 134], [128, 122], [124, 118], [108, 128], [44, 132]]);
    } else if (kind === "shed") {
      poly(g, [[10, 122], [8, 128], [26, 136], [134, 130], [144, 116], [132, 122], [28, 130]]);
    } else {
      poly(g, [[12, 126], [14, 132], [34, 138], [140, 132], [146, 120], [132, 128], [36, 134]]);
    }

    g.fillStyle(0x3a2a1c, 0.45);
    g.fillRect(54, 74, 3, 48);
    g.fillRect(100, 72, 3, 46);

    g.fillStyle(0x6a5428, 1);
    if (kind === "keep") {
      poly(g, [[14, 68], [40, 40], [78, 32], [122, 42], [142, 70], [78, 62]]);
    } else if (kind === "shed") {
      poly(g, [[4, 70], [44, 42], [104, 36], [152, 66], [78, 62]]);
    } else {
      poly(g, [[4, 68], [26, 44], [78, 34], [130, 44], [154, 70], [78, 62]]);
    }
    g.fillStyle(0x4a3a1c, 0.7);
    poly(g, [[28, 68], [78, 42], [128, 68], [78, 60]]);
    g.lineStyle(1, 0xb08a45, 0.42);
    for (let i = 0; i < 8; i += 1) {
      const x = 28 + i * 14;
      g.lineBetween(x, 63 - Math.abs(78 - x) * 0.3, x + 7, 67);
    }
    g.lineStyle(2, 0x2d2116, 0.55);
    g.lineBetween(22, 68, 78, 60);
    g.lineBetween(78, 60, 136, 68);

    g.fillStyle(0x4a4842, 1);
    g.fillRoundedRect(118, 48, 10, 18, 2);
    g.fillStyle(0x120c08, 1);
    g.fillRoundedRect(66, 96, 24, 34, 7);
    g.fillStyle(0x5b3a24, 0.8);
    g.fillRect(70, 100, 3, 28);
    g.fillStyle(0xc9a227, 0.85);
    g.fillCircle(84, 114, 1.8);
    g.fillStyle(0xe09040, 0.55);
    g.fillEllipse(40, 92, 14, 12);
    g.fillEllipse(114, 90, 12, 10);
    g.fillStyle(0xffe8b0, 0.35);
    g.fillEllipse(40, 92, 6, 5);
    g.lineStyle(2, 0x3a2418, 0.85);
    g.lineBetween(40, 86, 40, 98);
    g.lineBetween(33, 92, 47, 92);
    g.lineBetween(114, 85, 114, 95);
    g.lineBetween(108, 90, 120, 90);
  });
}
