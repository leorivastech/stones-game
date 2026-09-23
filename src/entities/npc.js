/** Gente del pueblo. Caminan un poco alrededor de su lugar y te miran cuando les hablas. */

import { SHEET_INDEX } from "../art/actors.js";
import { DEPTH, TILE } from "../config.js";
import { viewOf } from "./player.js";

export class Npc {
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec;
    this.cast = spec.cast;
    this.home = { x: spec.x * TILE, y: spec.y * TILE };
    this.facing = spec.dir ?? "down";
    this.sprite = scene.physics.add.sprite(this.home.x, this.home.y, `cast-${spec.cast}`, SHEET_INDEX[viewOf(this.facing)]).setOrigin(0.5, 1);
    this.sprite.body.setSize(10, 6).setOffset(3, 17);
    this.sprite.body.setImmovable(true);
    this.shadow = scene.add.image(this.home.x, this.home.y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.target = null;
    this.wait = 800 + Math.random() * 2000;
    this.talking = false;
    this.pose();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  pose(moving = false) {
    const view = viewOf(this.facing);
    this.sprite.setFlipX(this.facing === "left");
    if (moving) {
      const key = `${this.cast}-walk-${view}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(SHEET_INDEX[view]);
    }
  }

  lookAt(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    this.pose(false);
  }

  update(dt) {
    const body = this.sprite.body;
    this.shadow.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y);
    if (this.talking || !this.spec.wander || this.scene.modal) {
      body.setVelocity(0, 0);
      if (!this.talking) this.pose(false);
      return;
    }
    if (!this.target) {
      this.wait -= dt;
      body.setVelocity(0, 0);
      this.pose(false);
      if (this.wait <= 0) {
        const r = this.spec.wander * TILE;
        this.target = { x: this.home.x + (Math.random() - 0.5) * r * 2, y: this.home.y + (Math.random() - 0.5) * r };
        this.walkTime = 0;
      }
      return;
    }
    this.walkTime += dt;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const len = Math.hypot(dx, dy);
    if (len < 3 || this.walkTime > 3000 || body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) {
      this.target = null;
      this.wait = 1200 + Math.random() * 2600;
      return;
    }
    body.setVelocity((dx / len) * 28, (dy / len) * 28);
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    this.pose(true);
  }
}
