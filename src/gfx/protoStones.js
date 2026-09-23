/** Piedras de prueba: se dibujan en Graphics y se hornean a textura. */

export const PROTO_STONES = [
  { key: "stone-amber", color: 0xc4a35a },
  { key: "stone-violet", color: 0x6b4fd8 },
  { key: "stone-teal", color: 0x3d9b8f },
];

export function bakeStoneTextures(scene) {
  for (const stone of PROTO_STONES) {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0x0b1210, 0.4);
    gfx.fillCircle(18, 20, 13);
    gfx.fillStyle(stone.color, 1);
    gfx.fillCircle(16, 16, 13);
    gfx.fillStyle(0xffffff, 0.28);
    gfx.fillCircle(11, 11, 4);
    gfx.generateTexture(stone.key, 32, 32);
    gfx.destroy();
  }
}
