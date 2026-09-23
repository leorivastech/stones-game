import Phaser from "phaser";
import { PROTO_STONES, bakeStoneTextures } from "../gfx/protoStones.js";

const SPEED = 220;
const STONE_SPOTS = [
  { x: 280, y: 150 },
  { x: 360, y: 300 },
  { x: 480, y: 180 },
];

/** Primer cuarto: tomar una piedra proto y llevarla al umbral. */
export class PlayScene extends Phaser.Scene {
  constructor() {
    super("play");
  }

  create() {
    this.won = false;
    this.carried = null;
    bakeStoneTextures(this);

    this.add
      .grid(400, 225, 800, 450, 40, 40, 0x1f3a2b, 1, 0x2d5a40, 0.35)
      .setDepth(-1);

    this.player = this.add.rectangle(120, 225, 32, 32, 0x6b4fd8);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    this.door = this.add.rectangle(680, 225, 48, 64, 0xc4a35a);
    this.physics.add.existing(this.door, true);

    this.stones = PROTO_STONES.map((spec, i) => {
      const spot = STONE_SPOTS[i];
      const stone = this.physics.add.image(spot.x, spot.y, spec.key);
      stone.body.setImmovable(true);
      stone.setData("kind", spec.key);
      this.physics.add.overlap(this.player, stone, () => this.pick(stone));
      return stone;
    });

    this.hint = this.add
      .text(400, 24, "Toma una piedra y llévala al umbral", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#e7ecf3",
      })
      .setOrigin(0.5, 0);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.input.keyboard.on("keydown-R", () => this.scene.restart());

    this.physics.add.overlap(this.player, this.door, () => this.place());
  }

  update() {
    if (this.won) {
      this.player.body.setVelocity(0, 0);
      return;
    }
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y += 1;
    const body = this.player.body;
    if (x === 0 && y === 0) {
      body.setVelocity(0, 0);
      return;
    }
    const len = Math.hypot(x, y);
    body.setVelocity((x / len) * SPEED, (y / len) * SPEED);
  }

  pick(stone) {
    if (this.won || this.carried || !stone.active) return;
    this.carried = stone;
    stone.disableBody(true, true);
    this.hint.setText("Al umbral · R reinicia");
  }

  place() {
    if (this.won || !this.carried) return;
    this.won = true;
    this.hint.setText("La piedra quedó · R para otro intento");
  }
}
