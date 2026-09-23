/** Sprite físico del caminante + anim según dirección. */

export function addWalker(scene, x, y) {
  const sprite = scene.physics.add.sprite(x, y, "walker", 0);
  sprite.setCollideWorldBounds(true);
  sprite.body.setSize(14, 18);
  sprite.body.setOffset(17, 30);
  sprite.setDepth(y + 12);
  sprite.setData("facing", "down");
  sprite.play("idle-down");
  return sprite;
}

export function steerWalker(sprite, x, y, speed) {
  const body = sprite.body;
  sprite.setDepth(sprite.y + 12);
  if (x === 0 && y === 0) {
    body.setVelocity(0, 0);
    const facing = sprite.getData("facing") || "down";
    const idle = facing === "left" || facing === "right" ? "idle-side" : `idle-${facing}`;
    sprite.setFlipX(facing === "left");
    if (sprite.anims.currentAnim?.key !== idle) sprite.play(idle, true);
    return;
  }
  const facing = Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : y < 0 ? "up" : "down";
  sprite.setData("facing", facing);
  sprite.setFlipX(facing === "left");
  const walk = facing === "left" || facing === "right" ? "walk-side" : `walk-${facing}`;
  if (sprite.anims.currentAnim?.key !== walk) sprite.play(walk, true);
  const len = Math.hypot(x, y);
  body.setVelocity((x / len) * speed, (y / len) * speed);
}
