/** El caminante. Estados: move, attack, roll, jump, slide, hurt, ko, frozen. */

import Phaser from "phaser";
import { SHEET_INDEX, POSE } from "../art/actors.js";
import { DEPTH, PLAYER, TILE } from "../config.js";
import { tone } from "../sfx.js";

export const DIRS = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Punto de giro del barrido dentro del cuadro de 32×32, por dirección.
const SLIDE_SPEED = 150;

const SLASH_ORIGIN = { right: [10 / 32, 16 / 32], down: [16 / 32, 10 / 32], left: [22 / 32, 16 / 32], up: [16 / 32, 22 / 32] };

function cellIsIce(world, s) {
  return world.cellAt(s.x, s.y - 2) === "i";
}

export function viewOf(dir) {
  return dir === "left" || dir === "right" ? "side" : dir;
}

export class Player {
  constructor(scene, x, y, dir = "down") {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, "cast-player", SHEET_INDEX[viewOf(dir)]).setOrigin(0.5, 1);
    this.sprite.body.setSize(10, 6).setOffset(3, 17);
    this.sprite.setCollideWorldBounds(true);
    this.shadow = scene.add.image(x, y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.facing = dir;
    this.state = "move";
    this.stateTime = 0;
    this.invuln = 0;
    this.rollCooldown = 0;
    this.running = false;
    this.crouching = false;
    this.hidden = false;
    this.inGrass = false;
    this.hitThisSwing = new Set();
    this.hop = 0;
    this.stepTimer = 0;
    this.faceIdle();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get body() { return this.sprite.body; }

  /** Centro del cuerpo (para golpes y distancias). */
  center() {
    return { x: this.sprite.x, y: this.sprite.y - 9 };
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  faceIdle() {
    const view = viewOf(this.facing);
    this.sprite.setFlipX(this.facing === "left");
    // Quieto y sin nada raro: respira. Agachado, con destello o en otro estado: cuadro fijo.
    if (!this.crouching && !this.flashing && (this.state === "move" || this.state === "frozen")) {
      this.sprite.play(`player-idle-${view}`, true);
      return;
    }
    this.sprite.anims.stop();
    this.sprite.setTexture(this.flashing ? "cast-player-flash" : "cast-player", SHEET_INDEX[view] + (this.crouching ? POSE.crouch : POSE.idle));
  }

  freeze() {
    this.body.setVelocity(0, 0);
    if (this.state !== "ko") this.setState("frozen");
    this.faceIdle();
  }

  unfreeze() {
    if (this.state === "frozen") this.setState("move");
  }

  update(dt, controls, world) {
    const s = this.sprite;
    this.stateTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.rollCooldown = Math.max(0, this.rollCooldown - dt);
    this.updateFlash();

    const cell = world.cellAt(s.x, s.y - 2);
    const key = `${Math.floor(s.x / TILE)},${Math.floor((s.y - 2) / TILE)}`;
    this.inGrass = cell === '"' && world.tallGrass.has(key) && !world.tallGrass.get(key).cut;

    switch (this.state) {
      case "frozen":
      case "ko":
        this.body.setVelocity(0, 0);
        break;
      case "hurt":
        if (this.stateTime > PLAYER.hurtTime) this.setState("move");
        break;
      case "attack":
        this.body.setVelocity(0, 0);
        if (this.stateTime > PLAYER.attackTime) {
          this.setState("move");
          this.faceIdle();
        }
        break;
      case "roll":
        if (this.stateTime > PLAYER.rollTime) {
          this.setState("move");
          this.rollCooldown = PLAYER.rollCooldown;
          this.running = controls.held("roll");
          this.faceIdle();
        }
        break;
      case "jump":
        this.updateJump(dt);
        break;
      case "slide":
        this.updateSlide(world);
        break;
      default:
        this.updateMove(dt, controls, world);
    }

    this.hidden = this.crouching && this.inGrass && this.state === "move";
    s.setAlpha(this.hidden ? 0.75 : 1);
    if (this.state !== "jump") this.shadow.setPosition(s.x, s.y);
    this.shadow.setVisible(!this.hidden);
    s.setDepth(s.y + (this.state === "jump" ? 32 : 0));
  }

  updateMove(dt, controls, world) {
    const s = this.sprite;
    const mv = controls.move();
    const moving = Math.abs(mv.x) + Math.abs(mv.y) > 0.1;
    this.crouching = controls.held("hide");
    if (!controls.held("roll")) this.running = false;

    // En hielo no hay pasos: se patina en línea recta hasta chocar o salir del hielo.
    if (cellIsIce(world, s) && moving) {
      const dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x < 0 ? "left" : "right") : mv.y < 0 ? "up" : "down";
      return this.startSlide(dir);
    }
    if (controls.pressed("attack")) return this.startAttack(world);
    if (controls.pressed("roll") && this.rollCooldown <= 0 && !this.crouching) return this.startRoll(mv);

    if (moving) {
      if (Math.abs(mv.x) > Math.abs(mv.y) + 0.05) this.facing = mv.x < 0 ? "left" : "right";
      else if (Math.abs(mv.y) > 0.05) this.facing = mv.y < 0 ? "up" : "down";
    }
    const speed = this.crouching ? PLAYER.crouch : this.running ? PLAYER.run : PLAYER.walk;
    const mult = this.scene.speedBonus ?? 1;
    this.body.setVelocity(mv.x * speed * mult, mv.y * speed * mult);

    const view = viewOf(this.facing);
    s.setFlipX(this.facing === "left");
    if (moving && !this.crouching) {
      const anim = `player-${this.running ? "run" : "walk"}-${view}`;
      const tex = this.flashing ? "cast-player-flash" : "cast-player";
      if (s.anims.currentAnim?.key !== anim || s.texture.key !== tex) {
        s.play(anim, true);
        if (tex !== "cast-player") s.setTexture(tex, s.frame.name);
      }
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.running ? 170 : 260;
        if (this.inGrass) this.rustle(world);
        else if (this.running) this.scene.fx?.dust(s.x, s.y);
        this.scene.stepSound?.(s.x, s.y, this.running);
      }
    } else if (moving && this.crouching) {
      s.anims.stop();
      s.setTexture("cast-player", SHEET_INDEX[view] + POSE.crouch);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && this.inGrass) {
        this.stepTimer = 420;
        this.rustle(world);
      }
    } else {
      this.faceIdle();
    }

    // Borde: si camina hacia abajo contra un escalón, lo salta.
    if (mv.y > 0.5 && Math.abs(mv.x) < 0.6) {
      const below = world.cellAt(s.x, s.y + 3);
      if (below === "^") this.startJump();
    }
  }

  startSlide(dir) {
    const s = this.sprite;
    this.facing = dir;
    this.crouching = false;
    this.running = false;
    this.setState("slide");
    this.snapToLane(dir === "left" || dir === "right" ? "y" : "x");
    const d = DIRS[dir];
    this.body.setVelocity(d.x * SLIDE_SPEED, d.y * SLIDE_SPEED);
    s.setFlipX(dir === "left");
    s.anims.stop();
    s.setFrame(SHEET_INDEX[viewOf(dir)] + POSE.walk[0]);
  }

  updateSlide(world) {
    const d = DIRS[this.facing];
    const b = this.body;
    const blocked = b.blocked[this.facing] || b.touching[this.facing];
    // Sin velocidad en el eje (tapón) también cuenta como choque.
    const stalled = this.stateTime > 60 && Math.abs(d.x ? b.velocity.x : b.velocity.y) < 5;
    if (blocked || stalled || this.stateTime > 4000) {
      this.snapToLane("x");
      this.snapToLane("y");
      b.setVelocity(0, 0);
      tone(this.scene, "bump");
      this.setState("move");
      this.faceIdle();
      return;
    }
    if (!cellIsIce(world, this.sprite)) {
      b.setVelocity(0, 0);
      this.setState("move");
      this.faceIdle();
      return;
    }
    b.setVelocity(d.x * SLIDE_SPEED, d.y * SLIDE_SPEED);
    if (this.stateTime % 90 < 20) this.scene.fx?.dust?.(this.sprite.x, this.sprite.y);
  }

  /** Centra al jugador en su celda sobre un eje, para patinar por carriles limpios. */
  snapToLane(axis) {
    const s = this.sprite;
    if (axis === "x") s.x = Math.floor(s.x / TILE) * TILE + TILE / 2;
    else s.y = Math.floor((s.y - 2) / TILE) * TILE + 11;
    this.body.reset(s.x, s.y);
  }

  rustle(world) {
    const key = `${Math.floor(this.sprite.x / TILE)},${Math.floor((this.sprite.y - 2) / TILE)}`;
    const g = world.tallGrass.get(key);
    if (g && !g.cut) g.img.play(g.anim, true);
  }

  startAttack(world) {
    this.setState("attack");
    this.hitThisSwing.clear();
    this.body.setVelocity(0, 0);
    this.faceIdle();
    const c = this.center();
    const [ox, oy] = SLASH_ORIGIN[this.facing];
    const slash = this.scene.add.sprite(c.x, c.y + 1, `slash-${this.facing}`, 0).setOrigin(ox, oy);
    slash.setDepth(this.facing === "up" ? this.sprite.y - 1 : this.sprite.y + 2);
    slash.play(`slash-${this.facing}`);
    slash.once("animationcomplete", () => slash.destroy());
    tone(this.scene, "swing");
    // El golpe se evalúa en dos momentos del barrido.
    this.scene.time.delayedCall(40, () => this.scene.resolvePlayerHit?.(this.hitbox()));
    this.scene.time.delayedCall(110, () => this.scene.resolvePlayerHit?.(this.hitbox()));
  }

  hitbox() {
    const c = this.center();
    const d = DIRS[this.facing];
    const side = this.facing === "left" || this.facing === "right";
    const w = side ? 22 : 26;
    const h = side ? 24 : 20;
    return new Phaser.Geom.Rectangle(c.x + d.x * 13 - w / 2, c.y + d.y * 12 - h / 2 + 2, w, h);
  }

  startRoll(mv) {
    let dx = mv.x;
    let dy = mv.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.1) {
      dx = DIRS[this.facing].x;
      dy = DIRS[this.facing].y;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.setState("roll");
    this.invuln = Math.max(this.invuln, PLAYER.rollTime + 60);
    this.body.setVelocity((dx / len) * PLAYER.rollSpeed, (dy / len) * PLAYER.rollSpeed);
    this.sprite.setFlipX(dx < 0);
    this.sprite.play("roll");
    this.scene.fx?.dust(this.sprite.x, this.sprite.y);
    tone(this.scene, "roll");
  }

  startJump() {
    this.setState("jump");
    this.jumpFrom = this.sprite.y;
    const cellY = Math.floor((this.sprite.y + 3) / TILE);
    this.jumpTo = (cellY + 1) * TILE + 10;
    this.body.enable = false;
    this.faceIdle();
    tone(this.scene, "jump");
  }

  updateJump() {
    const t = Math.min(1, this.stateTime / 340);
    const baseY = this.jumpFrom + (this.jumpTo - this.jumpFrom) * t;
    const arc = Math.sin(t * Math.PI) * 12;
    this.sprite.y = baseY - arc;
    this.shadow.setPosition(this.sprite.x, baseY);
    if (t >= 1) {
      this.sprite.y = this.jumpTo;
      this.body.enable = true;
      this.body.reset(this.sprite.x, this.jumpTo);
      this.setState("move");
      this.scene.fx?.dust(this.sprite.x, this.sprite.y);
      tone(this.scene, "land");
    }
  }

  /** Devuelve true si el golpe entró. */
  hurt(halves, fromX, fromY) {
    if (this.invuln > 0 || this.state === "ko" || this.state === "jump" || this.state === "frozen") return false;
    const c = this.center();
    const dx = c.x - fromX;
    const dy = c.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setState("hurt");
    this.invuln = PLAYER.invulnTime;
    this.flashTime = 140;
    this.body.setVelocity((dx / len) * PLAYER.knockback, (dy / len) * PLAYER.knockback);
    this.sprite.anims.stop();
    tone(this.scene, "hurt");
    this.scene.cameras.main.shake(90, 0.006);
    return true;
  }

  updateFlash() {
    const s = this.sprite;
    if (this.flashTime > 0) {
      this.flashTime -= this.scene.game.loop.delta;
      this.flashing = true;
      if (s.texture.key === "cast-player") s.setTexture("cast-player-flash", s.frame.name);
    } else if (this.flashing) {
      this.flashing = false;
      if (s.texture.key === "cast-player-flash") s.setTexture("cast-player", s.frame.name);
    }
    if (this.invuln > 0 && this.state !== "roll" && this.state !== "ko") s.setVisible(Math.floor(this.invuln / 70) % 2 === 0);
    else s.setVisible(true);
  }

  knockOut() {
    this.setState("ko");
    this.body.setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setTexture("ko-player").setVisible(true);
    this.sprite.setFlipX(false);
  }

  revive() {
    this.setState("move");
    this.invuln = 600;
    this.faceIdle();
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
