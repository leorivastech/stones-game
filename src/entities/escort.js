/**
 * Arquera escolta (Sahra, de Duneshade). En las rutas camina detrás del jugador y dispara a
 * bandidos y bestias que estén a tiro y a la vista. A la Corona sólo le dispara si ya es hostil.
 */

import Phaser from "phaser";
import { SHEET_INDEX, POSE } from "../art/actors.js";
import { DEPTH } from "../config.js";
import { tone, sfx } from "../sfx.js";
import { viewOf } from "./player.js";

const RANGE = 120;
const COOLDOWN = 1300;
const ARROW_SPEED = 260;

export class Escort {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.add.sprite(x, y, "cast-archer", SHEET_INDEX.down).setOrigin(0.5, 1);
    this.shadow = scene.add.image(x, y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.trail = [];
    this.facing = "down";
    this.cooldown = 800;
    this.arrows = [];
    this.aimTime = 0;
  }

  pose(moving) {
    const view = viewOf(this.facing);
    this.sprite.setFlipX(this.facing === "left");
    if (moving) {
      const key = `archer-walk-${view}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
    } else {
      this.sprite.anims.stop();
      if (this.aimTime > 0) {
        this.sprite.anims.stop();
        this.sprite.setFrame(SHEET_INDEX[view] + POSE.act);
      } else {
        this.sprite.play(`archer-idle-${view}`, true);
      }
    }
  }

  target() {
    let best = null;
    let bd = RANGE;
    for (const e of this.scene.enemies) {
      if (e.dead || !e.body?.enable || !e.sprite.visible) continue;
      if (e.spec.kind === "guard" && !e.hostile) continue;
      if (e.state === "buried" || e.state === "hidden") continue;
      const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, e.x, e.y);
      if (d < bd && e.lineOfSight(this.sprite.x, this.sprite.y - 10)) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  update(dt) {
    const p = this.scene.player;
    const s = this.sprite;
    // Sigue al jugador un poco atrás, por el mismo camino.
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trail.push({ x: p.x, y: p.y });
    let moving = false;
    if (this.trail.length > 22 && !this.scene.modal) {
      const t = this.trail.shift();
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.3) {
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
        moving = true;
      }
      s.setPosition(t.x, t.y);
    }
    this.aimTime = Math.max(0, this.aimTime - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.scene.modal && this.cooldown <= 0) {
      const e = this.target();
      if (e) this.shoot(e);
    }
    this.pose(moving && this.aimTime <= 0);
    s.setDepth(s.y);
    this.shadow.setPosition(s.x, s.y);
    this.updateArrows(dt);
  }

  shoot(e) {
    const s = this.sprite;
    const sx = s.x;
    const sy = s.y - 12;
    const tx = e.x;
    const ty = e.y - 8;
    const a = Math.atan2(ty - sy, tx - sx);
    this.facing = Math.abs(tx - sx) > Math.abs(ty - sy) ? (tx < sx ? "left" : "right") : ty < sy ? "up" : "down";
    this.aimTime = 260;
    this.cooldown = COOLDOWN;
    const img = this.scene.add.image(sx, sy, "arrow").setRotation(a).setDepth(DEPTH.fx);
    this.arrows.push({ img, vx: Math.cos(a) * ARROW_SPEED, vy: Math.sin(a) * ARROW_SPEED, life: 700 });
    tone(this.scene, "swing");
  }

  updateArrows(dt) {
    for (const ar of this.arrows) {
      if (ar.dead) continue;
      ar.life -= dt;
      ar.img.x += (ar.vx * dt) / 1000;
      ar.img.y += (ar.vy * dt) / 1000;
      const hitWall = this.scene.world.solidAt(ar.img.x, ar.img.y + 6) && this.scene.world.cellAt(ar.img.x, ar.img.y + 6) !== "~";
      let hit = null;
      for (const e of this.scene.enemies) {
        if (e.dead || !e.body?.enable) continue;
        const b = e.body;
        if (ar.img.x > b.x - 4 && ar.img.x < b.x + b.width + 4 && ar.img.y > b.y - 14 && ar.img.y < b.y + b.height + 2) { hit = e; break; }
      }
      if (hit) {
        hit.hit(1, ar.img.x - ar.vx * 0.05, ar.img.y - ar.vy * 0.05);
        if (hit.spec.kind === "guard") this.scene.onGuardAttacked(hit);
      }
      if (hit || hitWall || ar.life <= 0) {
        ar.dead = true;
        ar.img.destroy();
        if (hitWall && !hit) sfx(this.scene, "chop", { volume: 0.15 });
      }
    }
    this.arrows = this.arrows.filter((a) => !a.dead);
  }
}
