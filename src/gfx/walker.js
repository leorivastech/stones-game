/** Sprite del caminante: 4 direcciones, 4 frames. 3/4 medieval. */

export const FW = 48;
export const FH = 56;

function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
}

function drawDown(g, f, bob, step) {
  g.fillStyle(0x080604, 0.4);
  g.fillEllipse(24, 50 + bob, 16, 5);
  g.fillStyle(0x1a100c, 1);
  g.fillRoundedRect(18 - step, 42 + bob, 6, 8, 2);
  g.fillRoundedRect(26 + step, 42 + bob, 6, 8, 2);
  g.fillStyle(0x4a2818, 1);
  g.fillEllipse(24, 32 + bob, 20, 22);
  g.fillStyle(0x6a3a22, 1);
  poly(g, [[16, 28 + bob], [24, 22 + bob], [32, 28 + bob], [30, 40 + bob], [18, 40 + bob]]);
  g.fillStyle(0x5a4020, 1);
  g.fillEllipse(14, 34 + bob, 8, 10);
  g.fillStyle(0xc45c18, 1);
  g.fillCircle(12, 36 + bob, 2);
  g.fillStyle(0x2a1810, 1);
  g.fillEllipse(24, 16 + bob, 16, 14);
  g.fillStyle(0xc4a07a, 1);
  g.fillCircle(24, 18 + bob, 4);
  g.fillStyle(0x1a100c, 1);
  g.fillEllipse(24, 13 + bob, 14, 8);
  g.fillStyle(0x3a2014, 0.7);
  g.fillCircle(21, 17 + bob, 1);
  g.fillCircle(27, 17 + bob, 1);
}

function drawUp(g, f, bob, step) {
  g.fillStyle(0x080604, 0.4);
  g.fillEllipse(24, 50 + bob, 16, 5);
  g.fillStyle(0x1a100c, 1);
  g.fillRoundedRect(18 - step, 42 + bob, 6, 8, 2);
  g.fillRoundedRect(26 + step, 42 + bob, 6, 8, 2);
  g.fillStyle(0x4a2818, 1);
  g.fillEllipse(24, 32 + bob, 20, 22);
  g.fillStyle(0x5a4020, 1);
  g.fillEllipse(34, 34 + bob, 8, 10);
  g.fillStyle(0x2a1810, 1);
  g.fillEllipse(24, 16 + bob, 18, 16);
  g.fillStyle(0x1a100c, 1);
  g.fillEllipse(24, 14 + bob, 14, 10);
}

function drawSide(g, f, bob, step) {
  g.fillStyle(0x080604, 0.4);
  g.fillEllipse(24, 50 + bob, 16, 5);
  g.fillStyle(0x4a3424, 1);
  g.fillRect(30, 20 + bob, 2, 26);
  g.fillStyle(0xc45c18, 1);
  g.fillCircle(31, 18 + bob, 2);
  g.fillStyle(0x1a100c, 1);
  g.fillRoundedRect(20, 42 + bob, 6, 8, 2);
  g.fillRoundedRect(28 + step, 41 + bob, 6, 9, 2);
  g.fillStyle(0x4a2818, 1);
  g.fillEllipse(23, 32 + bob, 16, 22);
  g.fillStyle(0x6a3a22, 1);
  g.fillEllipse(26, 30 + bob, 10, 16);
  g.fillStyle(0x5a4020, 1);
  g.fillEllipse(18, 36 + bob, 7, 9);
  g.fillStyle(0x2a1810, 1);
  g.fillEllipse(26, 16 + bob, 14, 14);
  g.fillStyle(0xc4a07a, 1);
  g.fillCircle(30, 18 + bob, 3);
  g.fillStyle(0x1a100c, 1);
  g.fillEllipse(24, 13 + bob, 12, 8);
}

function drawFrame(g, dir, frame) {
  const bob = [0, -2, 0, -2][frame];
  const step = [0, 3, 0, -3][frame];
  if (dir === "down") drawDown(g, frame, bob, step);
  else if (dir === "up") drawUp(g, frame, bob, step);
  else drawSide(g, frame, bob, step);
}

export function bakeWalker(scene) {
  for (const key of ["walker-src", "walker"]) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
  const dirs = ["down", "side", "up"];
  const sheetW = FW * 4;
  const sheetH = FH * 3;
  const gfx = scene.add.graphics();
  dirs.forEach((dir, row) => {
    for (let col = 0; col < 4; col += 1) {
      gfx.save();
      gfx.translateCanvas(col * FW, row * FH);
      drawFrame(gfx, dir, col);
      gfx.restore();
    }
  });
  gfx.generateTexture("walker-src", sheetW, sheetH);
  gfx.destroy();
  const src = scene.textures.get("walker-src").getSourceImage();
  scene.textures.addSpriteSheet("walker", src, {
    frameWidth: FW,
    frameHeight: FH,
  });
}

export function createWalkerAnims(scene) {
  const mk = (key, frames, rate, repeat) => {
    if (scene.anims.exists(key)) scene.anims.remove(key);
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers("walker", { frames }),
      frameRate: rate,
      repeat,
    });
  };
  mk("walk-down", [0, 1, 2, 3], 8, -1);
  mk("walk-side", [4, 5, 6, 7], 8, -1);
  mk("walk-up", [8, 9, 10, 11], 8, -1);
  mk("idle-down", [0, 1], 3, -1);
  mk("idle-side", [4, 5], 3, -1);
  mk("idle-up", [8, 9], 3, -1);
}
