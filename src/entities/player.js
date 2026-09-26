/**
 * El caminante. Estados: move, attack, charge, roll, jump, slide, hurt, recoil, ko, frozen.
 * Golpe: al apretar sale el barrido normal (preparar → golpe). Si la acción se mantiene, al terminar
 * el barrido se queda cargando; a los PLAYER.charge.hold ms brilla y tiembla, y al soltar sale el
 * barrido cargado (cuesta aguante). Soltar antes = sólo el golpe normal, como siempre.
 */

import Phaser from "phaser";
import { SHEET_INDEX, POSE } from "../art/actors.js";
import { DEPTH, PLAYER, STEALTH, TILE } from "../config.js";
import { tone } from "../sfx.js";
import { buzz, frozen, hitstop, shake, squash } from "../engine/juice.js";

export const DIRS = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Punto de giro del barrido dentro del cuadro de 32×32, por dirección.
const SLIDE_SPEED = 150;

const SLASH_ORIGIN = { right: [10 / 32, 16 / 32], down: [16 / 32, 10 / 32], left: [22 / 32, 16 / 32], up: [16 / 32, 22 / 32] };
// Lo mismo para el barrido cargado (48×48, giro en (16, 24) y sus rotaciones).
const WIDE_ORIGIN = { right: [16 / 48, 24 / 48], down: [24 / 48, 16 / 48], left: [32 / 48, 24 / 48], up: [24 / 48, 32 / 48] };
// Cuándo pasa de "preparar" a "golpe" (el cuadro 1 del barrido de fx.js).
const WINDUP_MS = 50;

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
    // Aguante (0-1) y su barrita sobre la cabeza (solo se ve si no está llena).
    this.stamina = 1;
    this.staminaRest = 0; // ms desde el último gasto
    this.staminaFlash = 0; // parpadeo rojo al querer rodar sin aguante
    this.staminaBar = scene.add.graphics().setDepth(DEPTH.fx);
    this.barKey = "";
    // Qué tanto te ven los enemigos (multiplica su vista): 0 escondido, 1 a la vista.
    this.stealth = 1;
    this.slow = false;
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
    // Congelado de golpe (hitstop): nada avanza, ni el barrido; el empujón sale al soltarse.
    if (frozen(this, this.scene.hitstopUntil ?? 0, this.scene.time.now)) {
      this.slash?.active && this.slash.anims.pause();
      return;
    }
    if (this.slash?.active && this.slash.anims.isPaused) this.slash.anims.resume();
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
      case "recoil":
        // Rebote contra un escudo: sin daño, se frena solo.
        this.body.setVelocity(this.body.velocity.x * 0.85, this.body.velocity.y * 0.85);
        if (this.stateTime > 160) {
          this.setState("move");
          this.faceIdle();
        }
        break;
      case "attack": {
        this.body.setVelocity(0, 0);
        // Pose del cuerpo sincronizada con el barrido: preparar y después golpe.
        this.swingFrame(this.stateTime < WINDUP_MS ? POSE.windup : POSE.strike);
        if (!controls.held("attack")) this.chargeHeld = false;
        const long = this.charged ? PLAYER.charge.time : PLAYER.attackTime;
        if (this.stateTime > long) {
          if (this.chargeHeld && !this.charged) {
            this.setState("charge");
            this.chargeReady = false;
            this.swingFrame(POSE.windup);
          } else {
            this.charged = false;
            this.setState("move");
            this.faceIdle();
          }
        }
        break;
      }
      case "charge":
        this.updateCharge(controls, world);
        break;
      case "roll":
        if (this.stateTime > PLAYER.rollTime) {
          this.setState("move");
          this.rollCooldown = PLAYER.rollCooldown;
          this.running = controls.held("roll");
          this.faceIdle();
          squash(this.scene, s, 1.15, 0.85, 110);
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

    this.scene.ambient?.feet(this, dt); // ambiente: polvo o nieve detrás de los pies al correr o rodar
    // Pasto alto: oculta del todo solo agachado o caminando despacio (palanca a medias);
    // caminando normal o corriendo entre el pasto te ven a ×0.6. Agachado fuera del pasto, ×0.55.
    const still = this.state === "move";
    this.hidden = still && this.inGrass && (this.crouching || this.slow);
    this.stealth = this.hidden ? 0 : still && this.inGrass ? STEALTH.grassMoving : still && this.crouching ? STEALTH.crouch : 1;
    this.updateStamina(dt);
    // Tras recibir daño parpadea (alpha) mientras dura la invulnerabilidad.
    const blink = this.hurtBlink && this.invuln > 0 && this.state !== "roll" && this.state !== "ko";
    if (this.invuln <= 0) this.hurtBlink = false;
    s.setAlpha(blink && Math.floor(this.invuln / 70) % 2 === 1 ? 0.3 : this.hidden ? 0.75 : 1);
    if (this.state !== "jump") this.shadow.setPosition(s.x, s.y);
    this.shadow.setVisible(!this.hidden);
    s.setDepth(s.y + (this.state === "jump" ? 32 : 0));
    this.drawStaminaBar();
  }

  /** Correr gasta, rodar ya cobró al empezar; tras un rato sin gastar se llena. */
  updateStamina(dt) {
    const cfg = PLAYER.stamina;
    const v = this.body.velocity;
    const sprinting = this.state === "move" && this.running && !this.crouching && Math.hypot(v.x, v.y) > PLAYER.walk + 4;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - (dt / 1000) * cfg.runDrain);
      this.staminaRest = 0;
      // Sin aire: deja de correr (para volver a correr hay que rodar otra vez).
      if (this.stamina <= 0) this.running = false;
    } else if (this.state !== "roll") {
      this.staminaRest += dt;
      if (this.staminaRest >= cfg.delay) this.stamina = Math.min(1, this.stamina + (dt / 1000) * cfg.regen);
    }
    this.staminaFlash = Math.max(0, this.staminaFlash - dt);
  }

  /** Barrita de 16×2 (con borde) sobre la cabeza. Se repinta solo si cambia. */
  drawStaminaBar() {
    const g = this.staminaBar;
    const s = this.sprite;
    const show = (this.stamina < 0.999 || this.staminaFlash > 0) && this.state !== "ko" && s.visible;
    if (!show) {
      if (g.visible) g.setVisible(false);
      return;
    }
    g.setVisible(true);
    g.setPosition(Math.round(s.x) - 9, Math.round(s.y) - 30);
    const fill = Math.round(this.stamina * 16);
    const low = this.stamina < PLAYER.stamina.rollCost;
    const flash = this.staminaFlash > 0 && Math.floor(this.staminaFlash / 80) % 2 === 0;
    const key = `${fill}|${low}|${flash}`;
    if (key === this.barKey) return;
    this.barKey = key;
    g.clear();
    g.fillStyle(0x1b1422, 0.85);
    g.fillRect(0, 0, 18, 4);
    g.fillStyle(0x2b2233, 1);
    g.fillRect(1, 1, 16, 2);
    if (fill > 0) {
      g.fillStyle(flash ? 0xf58969 : low ? 0xe0493d : 0xe6b736, 1);
      g.fillRect(1, 1, fill, 2);
      g.fillStyle(flash ? 0xfaf3e1 : low ? 0xf58969 : 0xfff5c1, 1);
      g.fillRect(1, 1, fill, 1);
    } else if (flash) {
      g.fillStyle(0xe0493d, 1);
      g.fillRect(1, 1, 16, 2);
    }
  }

  updateMove(dt, controls, world) {
    const s = this.sprite;
    const mv = controls.move();
    const moving = Math.abs(mv.x) + Math.abs(mv.y) > 0.1;
    // Palanca a medias (control o táctil): paso lento, que en el pasto alto no se nota.
    this.slow = moving && Math.hypot(mv.x, mv.y) < 0.6;
    this.crouching = controls.held("hide");
    if (!controls.held("roll")) this.running = false;

    // En hielo no hay pasos: se patina en línea recta hasta chocar o salir del hielo.
    if (cellIsIce(world, s) && moving) {
      const dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x < 0 ? "left" : "right") : mv.y < 0 ? "up" : "down";
      return this.startSlide(dir);
    }
    if (controls.pressed("attack")) return this.startAttack(world);
    if (controls.pressed("roll") && this.rollCooldown <= 0 && !this.crouching) {
      // Sin aguante no se rueda: la barrita parpadea en rojo.
      if (this.stamina < PLAYER.stamina.rollCost) {
        this.staminaFlash = 400;
        this.barKey = "";
      } else return this.startRoll(mv);
    }

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

  /** Cuadro fijo de la hoja (pose de golpe o de carga), respetando el destello de daño. */
  swingFrame(pose) {
    const s = this.sprite;
    const frame = SHEET_INDEX[viewOf(this.facing)] + pose;
    const tex = this.flashing ? "cast-player-flash" : "cast-player";
    s.setFlipX(this.facing === "left");
    if (s.anims.isPlaying) s.anims.stop();
    if (s.texture.key !== tex || s.frame.name !== frame) s.setTexture(tex, frame);
  }

  /** Mantener la acción después del golpe: carga, brilla, y al soltar sale el barrido amplio. */
  updateCharge(controls, world) {
    const s = this.sprite;
    const cfg = PLAYER.charge;
    this.body.setVelocity(0, 0);
    const held = controls.held("attack");
    const ready = this.scene.time.now - this.chargeStart >= cfg.hold;
    if (held) {
      if (ready && !this.chargeReady) {
        this.chargeReady = true;
        tone(this.scene, "heart");
      }
      if (this.chargeReady) {
        const anim = `player-charge-${viewOf(this.facing)}`;
        s.setFlipX(this.facing === "left");
        if (s.anims.currentAnim?.key !== anim || !s.anims.isPlaying) s.play(anim);
      } else this.swingFrame(POSE.windup);
      return;
    }
    // Soltó.
    this.chargeReady = false;
    if (!ready) {
      this.setState("move");
      this.faceIdle();
      return;
    }
    if (this.stamina < cfg.cost) {
      // Sin aguante: la barrita parpadea y sale el golpe normal.
      this.staminaFlash = 400;
      this.barKey = "";
      this.startAttack(world, { again: true });
      return;
    }
    this.startAttack(world, { charged: true });
  }

  startAttack(world, { charged = false, again = false } = {}) {
    this.setState("attack");
    this.charged = charged;
    // Si se mantiene la acción desde este golpe, al terminar se queda cargando.
    this.chargeHeld = !charged && !again;
    this.chargeStart = this.scene.time.now;
    this.hitThisSwing.clear();
    this.body.setVelocity(0, 0);
    this.swingFrame(charged ? POSE.strike : POSE.windup);
    if (charged) return this.startChargedSwing();
    const c = this.center();
    const [ox, oy] = SLASH_ORIGIN[this.facing];
    const slash = this.scene.add.sprite(c.x, c.y + 1, `slash-${this.facing}`, 0).setOrigin(ox, oy);
    this.slash = slash;
    slash.setDepth(this.facing === "up" ? this.sprite.y - 1 : this.sprite.y + 2);
    slash.play(`slash-${this.facing}`);
    slash.once("animationcomplete", () => slash.destroy());
    tone(this.scene, "swing");
    // El golpe se evalúa en dos momentos del barrido.
    this.scene.time.delayedCall(40, () => this.scene.resolvePlayerHit?.(this.hitbox()));
    this.scene.time.delayedCall(110, () => this.scene.resolvePlayerHit?.(this.hitbox()));
  }

  /** Barrido cargado: más ancho, 2 de daño, empujón fuerte y congelado de muerte. Cuesta aguante. */
  startChargedSwing() {
    const cfg = PLAYER.charge;
    this.stamina = Math.max(0, this.stamina - cfg.cost);
    this.staminaRest = 0;
    const c = this.center();
    const [ox, oy] = WIDE_ORIGIN[this.facing];
    const slash = this.scene.add.sprite(c.x, c.y + 1, `slash-wide-${this.facing}`, 0).setOrigin(ox, oy);
    this.slash = slash;
    slash.setDepth(this.facing === "up" ? this.sprite.y - 1 : this.sprite.y + 2);
    slash.play(`slash-wide-${this.facing}`);
    slash.once("animationcomplete", () => slash.destroy());
    tone(this.scene, "swing");
    tone(this.scene, "charge");
    squash(this.scene, this.sprite, 1.15, 0.88, 140);
    const d = DIRS[this.facing];
    this.scene.fx?.dust(this.sprite.x - d.x * 6, this.sprite.y);
    this.scene.time.delayedCall(40, () => this.resolveCharged());
    this.scene.time.delayedCall(100, () => this.resolveCharged());
    this.scene.time.delayedCall(160, () => this.resolveCharged());
  }

  /** Área del barrido cargado: casi todo el medio círculo de enfrente. */
  wideHitbox() {
    const c = this.center();
    const d = DIRS[this.facing];
    const side = this.facing === "left" || this.facing === "right";
    const w = side ? 34 : 46;
    const h = side ? 46 : 34;
    return new Phaser.Geom.Rectangle(c.x + d.x * 14 - w / 2, c.y + d.y * 13 - h / 2 + 2, w, h);
  }

  resolveCharged() {
    const scene = this.scene;
    if (this.state !== "attack" || !this.charged) return;
    const cfg = PLAYER.charge;
    const rect = this.wideHitbox();
    const c = this.center();
    // El empujón de Enemy.hit ya crece con el daño; esto lo deja en ×cfg.push del golpe normal.
    const push = cfg.push / (0.75 + 0.25 * cfg.damage);
    for (const e of scene.enemies ?? []) {
      if (e.dead || !e.body?.enable || this.hitThisSwing.has(e)) continue;
      const b = e.body;
      const r2 = new Phaser.Geom.Rectangle(b.x - 3, b.y - 12, b.width + 6, b.height + 14);
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, r2)) continue;
      this.hitThisSwing.add(e);
      if (e.invuln > 0) continue;
      hitstop(scene, PLAYER.hitstop.kill, e);
      if (e.hit(cfg.damage, c.x, c.y, { push })) shake(scene, "kill");
    }
    // Corta el pasto y los arbustos que alcanza, igual que el golpe normal (world.applyCut).
    const x0 = Math.floor(rect.x / TILE);
    const x1 = Math.floor((rect.right - 1) / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const y1 = Math.floor((rect.bottom - 1) / TILE);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        for (const k of [`g:${x},${y}`, `b:${x},${y}`]) if (scene.applyCut?.(k, true)) scene.net?.cut(k);
      }
    }
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
    this.stamina = Math.max(0, this.stamina - PLAYER.stamina.rollCost);
    this.staminaRest = 0;
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
    squash(this.scene, this.sprite, 0.9, 1.1, 120);
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
      squash(this.scene, this.sprite, 1.15, 0.85, 110);
      tone(this.scene, "land");
    }
  }

  /** Devuelve true si el golpe entró. `push`: fuerza del empujón (según el enemigo). */
  hurt(halves, fromX, fromY, push = PLAYER.knockback) {
    if (this.invuln > 0 || this.state === "ko" || this.state === "jump" || this.state === "frozen") return false;
    const c = this.center();
    const dx = c.x - fromX;
    const dy = c.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setState("hurt");
    this.invuln = PLAYER.invulnTime;
    this.hurtBlink = true;
    this.flashTime = 140;
    this.body.setVelocity((dx / len) * push, (dy / len) * push);
    this.sprite.anims.stop();
    this.updateFlash(); // blanco ya, para que se vea durante el congelado
    tone(this.scene, "hurt");
    buzz(30);
    return true;
  }

  /** Rebote sin daño (pegarle de frente al escudo de un guardia). */
  recoil(fromX, fromY, force = PLAYER.blockPush) {
    if (["ko", "jump", "frozen", "slide", "hurt"].includes(this.state)) return;
    const c = this.center();
    const dx = c.x - fromX;
    const dy = c.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.setState("recoil");
    this.body.setVelocity((dx / len) * force, (dy / len) * force);
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
    s.setVisible(true);
  }

  knockOut() {
    this.setState("ko");
    this.body.setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setTexture("ko-player").setVisible(true);
    this.sprite.setFlipX(false);
    buzz(60);
  }

  revive() {
    this.setState("move");
    this.invuln = 600;
    this.hurtBlink = true;
    this.faceIdle();
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.staminaBar.destroy();
  }
}
