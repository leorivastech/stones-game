/** Ritmo y look de película: lento, zoom cercano, viñeta oscura. */

export const WALK_SPEED = 108;

export function filmCamera(scene, bg) {
  const cam = scene.cameras.main;
  cam.setZoom(1.28);
  cam.setLerp(0.06, 0.06);
  cam.fadeIn(500);
  cam.setBackgroundColor(bg);
  return cam;
}

export function filmVignette(scene) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(16);
  g.fillStyle(0x080604, 0.55);
  g.fillRect(0, 0, 800, 42);
  g.fillRect(0, 408, 800, 42);
  g.fillStyle(0x080604, 0.4);
  g.fillRect(0, 0, 52, 450);
  g.fillRect(748, 0, 52, 450);
}

export function torchGlow(scene, x, y) {
  scene.add.image(x, y, "torch").setDepth(3);
  scene.add.particles(x, y - 8, "ember", {
    speed: { min: 6, max: 18 },
    lifespan: 900,
    scale: { start: 0.28, end: 0.02 },
    alpha: { start: 0.75, end: 0 },
    gravityY: -28,
    frequency: 140,
    blendMode: "ADD",
    quantity: 1,
  }).setDepth(4);
}
