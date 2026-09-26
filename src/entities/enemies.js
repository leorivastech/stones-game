/**
 * Enemigos que se ven caminando por el mapa. Nada de turnos: todo pasa en tiempo real.
 *
 *  Jabalí  — te ve, escarba y embiste en línea recta. Si choca con roca, queda aturdido.
 *  Bandido — escondido o de guardia en su campamento. Te persigue, avisa y se lanza.
 *            Si te pega con piedras encima, se te cae una; él corre a levantarla y huye.
 *  Guardia — patrulla con cono de visión. Si te ve con piedras a la vista, sospecha (?),
 *            se alarma (!) y te persigue. Si te alcanza: revisión. Si le pegas, pelea.
 */

import Phaser from "phaser";
import { SHEET_INDEX, POSE } from "../art/actors.js";
import { DEPTH, ENEMY, TILE } from "../config.js";
import { tone, sfx } from "../sfx.js";
import { DIRS, viewOf } from "./player.js";
import { frozen, release, shake, squash } from "../engine/juice.js";

// Parpadeo al recibir un golpe: blanco/normal 3 veces.
const BLINK_STEP = 45;
const BLINK_TIME = BLINK_STEP * 6;

function dirFromVec(x, y) {
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? "left" : "right";
  return y < 0 ? "up" : "down";
}

class Enemy {
  constructor(scene, spec, texture, frame) {
    this.scene = scene;
    this.spec = spec;
    this.home = { x: spec.x * TILE, y: spec.y * TILE };
    this.sprite = scene.physics.add.sprite(this.home.x, this.home.y, texture, frame).setOrigin(0.5, 1);
    this.shadow = scene.add.image(this.home.x, this.home.y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.state = "idle";
    this.stateTime = 0;
    this.facing = spec.dir ?? "down";
    this.invuln = 0;
    this.flash = 0;
    this.dead = false;
    this.bubble = null;
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get body() { return this.sprite.body; }

  center() {
    return { x: this.sprite.x, y: this.sprite.y - 8 };
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  /**
   * A quién persigue. Solo: el jugador. En línea: el jugador más cercano de los que andan en el
   * mapa (el de este aparato o el de otro); ver WorldScene.targetFor.
   */
  player() {
    return this.scene.targetFor ? this.scene.targetFor(this) : this.scene.player;
  }

  distToPlayer() {
    const p = this.player();
    return Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
  }

  lineOfSight(tx, ty) {
    const steps = Math.ceil(Phaser.Math.Distance.Between(this.x, this.y - 6, tx, ty) / 6);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = this.x + (tx - this.x) * t;
      const y = this.y - 6 + (ty - this.y + 6) * t;
      if (this.scene.world.solidAt(x, y) && this.scene.world.cellAt(x, y) !== "~") return false;
    }
    return true;
  }

  moveToward(tx, ty, speed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) {
      this.body.setVelocity(0, 0);
      return true;
    }
    this.body.setVelocity((dx / len) * speed, (dy / len) * speed);
    this.facing = dirFromVec(dx, dy);
    return false;
  }

  showBubble(key, ms = 700) {
    this.bubble?.destroy();
    const b = this.scene.add.image(this.x, this.y - 26, key).setOrigin(0.5, 1).setDepth(DEPTH.fx);
    this.bubble = b;
    if (ms) this.scene.time.delayedCall(ms, () => { if (this.bubble === b) { b.destroy(); this.bubble = null; } });
  }

  hit(damage, fromX, fromY) {
    if (this.dead || this.invuln > 0) return false;
    // En línea, si este enemigo lo mueve otro jugador, el golpe se le manda a él.
    if (this.puppet) {
      this.invuln = 260;
      this.hitBlink = BLINK_TIME;
      const c = this.center();
      this.scene.fx.spark(c.x, c.y);
      this.scene.fx.float?.(c.x, c.y - 8, `-${damage}`, "font-red");
      tone(this.scene, "hit");
      this.scene.net?.hitPuppet(this, damage, fromX, fromY);
      return true;
    }
    this.hp -= damage;
    this.invuln = 260;
    this.hitBlink = BLINK_TIME;
    const c = this.center();
    const dx = c.x - fromX;
    const dy = c.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    // Empujón según el tipo (jabalí y escorpión vuelan, el guardia apenas se mueve) y el daño.
    const kind = this.kind ?? this.spec.kind;
    const force = (ENEMY[kind]?.knock ?? 190) * (0.75 + 0.25 * damage) * (this.hp <= 0 ? 1.3 : 1);
    this.body.setVelocity((dx / len) * force, (dy / len) * force);
    this.knockTime = 140;
    this.scene.fx.spark(c.x, c.y);
    this.scene.fx.float?.(c.x, c.y - 8, `-${damage}`, "font-red");
    tone(this.scene, "hit");
    if (this.hp <= 0) this.die();
    else this.onHurt?.();
    return true;
  }

  die() {
    this.dead = true;
    release(this);
    this.body.enable = false;
    this.bubble?.destroy();
    this.scene.fx.poof(this.x, this.y - 6);
    sfx(this.scene, "die", { volume: 0.3, detune: (Math.random() - 0.5) * 300 });
    if (!this.puppet) this.scene.onEnemyDefeated(this);
    this.scene.net?.enemyDied(this);
    // Se queda blanco durante el congelado, se aplasta contra el suelo y se desvanece.
    const wait = Math.max(0, (this.hitstopUntil ?? 0) - this.scene.time.now);
    this.sprite.anims.stop();
    this.whiten(true);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.3,
      scaleY: 0.55,
      delay: wait,
      duration: 90,
      ease: "Quad.Out",
      onStart: () => this.whiten(false),
    });
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, delay: wait + 60, duration: 200, onComplete: () => this.destroy() });
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.bubble?.destroy();
    this.cone?.destroy();
  }

  preUpdate(dt) {
    // Congelado del golpe: blanco y quieto; el empujón sale al soltarse. (Los títeres no se congelan.)
    if (!this.puppet && frozen(this, this.hitstopUntil ?? 0, this.scene.time.now)) {
      this.whiten(true);
      return true;
    }
    this.stateTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.knockTime > 0) this.knockTime -= dt;
    this.shadow.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y);
    if (this.bubble) this.bubble.setPosition(this.x, this.y - 25 - (this.stateTime < 120 ? 2 : 0));
    if (this.hitBlink > 0) this.hitBlink -= dt;
    // Blanco en los pasos pares del parpadeo del golpe, o en el destello de aviso (`flash`).
    const blinkWhite = this.hitBlink > 0 && Math.floor((BLINK_TIME - this.hitBlink) / BLINK_STEP) % 2 === 0;
    if (this.flash > 0) this.flash -= dt;
    if (this.flash > 0 || blinkWhite) this.whiten(true);
    else if (this.flashed) this.whiten(false);
    return this.knockTime > 0;
  }

  /** Destello blanco. En Canvas no hay tinte: se hace semitransparente. */
  whiten(on) {
    const s = this.sprite;
    this.flashed = on;
    if (this.scene.game.renderer.type === Phaser.CANVAS) s.setAlpha(on ? 0.4 : 1);
    else if (on) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else s.clearTint();
  }

  /** ¿Toca al jugador? Para el daño por contacto. */
  touching(pad = 3) {
    const a = this.body;
    const b = this.player().body;
    return a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y;
  }
}

// ---------------------------------------------------------------------------

export class Boar extends Enemy {
  constructor(scene, spec, kind = "boar") {
    super(scene, spec, kind, 0);
    this.kind = kind;
    this.hp = ENEMY[kind].hp;
    this.body.setSize(16, 7).setOffset(4, 10);
    this.shadow.setTexture("shadow-big");
    this.wanderTarget = null;
    this.setState("wander");
  }

  update(dt) {
    if (this.dead) return;
    if (this.preUpdate(dt)) return;
    const cfg = ENEMY[this.kind];
    const p = this.player();
    const d = this.distToPlayer();
    switch (this.state) {
      case "wander": {
        if (!this.wanderTarget || this.stateTime > 2600) {
          this.wanderTarget = { x: this.home.x + (Math.random() - 0.5) * 64, y: this.home.y + (Math.random() - 0.5) * 40 };
          this.stateTime = 0;
        }
        const arrived = this.moveToward(this.wanderTarget.x, this.wanderTarget.y, cfg.speed);
        if (arrived) this.body.setVelocity(0, 0);
        this.anim(arrived ? null : `${this.kind}-walk`);
        if (d < cfg.sight && !p.hidden && p.state !== "ko" && this.lineOfSight(p.x, p.y - 8)) {
          this.setState("windup");
          this.body.setVelocity(0, 0);
          this.showBubble("bubble-alert", 500);
          tone(this.scene, "charge");
          sfx(this.scene, this.kind === "wolf" ? "growl" : "boar", { volume: 0.4, detune: (Math.random() - 0.5) * 200 });
        }
        break;
      }
      case "windup": {
        this.body.setVelocity(0, 0);
        this.anim(null, 2);
        this.sprite.setFlipX(p.x < this.x);
        this.sprite.x += Math.sin(this.stateTime * 0.08) * 0.6;
        if (Math.floor(this.stateTime / 120) % 2 === 0) this.scene.fx.dust(this.x - (this.sprite.flipX ? -8 : 8), this.y, 0.6);
        if (this.stateTime > (cfg.windup ?? 560)) {
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.chargeDir = { x: dx / len, y: dy / len };
          this.setState("charge");
        }
        break;
      }
      case "charge": {
        this.body.setVelocity(this.chargeDir.x * cfg.charge, this.chargeDir.y * cfg.charge);
        this.anim(`${this.kind}-run`);
        this.sprite.setFlipX(this.chargeDir.x < 0);
        if (Math.floor(this.stateTime / 90) !== Math.floor((this.stateTime - dt) / 90)) this.scene.fx.dust(this.x, this.y, 0.8);
        if (this.touching()) this.scene.damageTarget(this.player(), cfg.damage, this, { steal: false });
        const b = this.body.blocked;
        if (this.stateTime > 120 && (b.left || b.right || b.up || b.down)) {
          this.setState("stunned");
          this.body.setVelocity(0, 0);
          shake(this.scene, "bump");
          tone(this.scene, "bump");
          this.showBubble("bubble-ask", 900);
        } else if (this.stateTime > 950) {
          this.setState("rest");
        }
        break;
      }
      case "stunned":
        this.body.setVelocity(0, 0);
        this.anim(null, 3);
        if (this.stateTime > 1300) this.setState("wander");
        break;
      case "rest":
        this.body.setVelocity(this.body.velocity.x * 0.85, this.body.velocity.y * 0.85);
        this.anim(null, 0);
        if (this.stateTime > 700) this.setState("wander");
        break;
      default:
        this.setState("wander");
    }
    if (this.state === "wander" && Math.abs(this.body.velocity.x) > 1) this.sprite.setFlipX(this.body.velocity.x < 0);
    // Embestida: se estira a lo largo (con los pies en el suelo) y vuelve a su tamaño al parar.
    const s = this.sprite;
    const [tx, ty] = this.state === "charge" ? [1.15, 0.9] : [1, 1];
    const k = Math.min(1, dt / 60);
    s.setScale(Math.abs(tx - s.scaleX) < 0.01 ? tx : s.scaleX + (tx - s.scaleX) * k, Math.abs(ty - s.scaleY) < 0.01 ? ty : s.scaleY + (ty - s.scaleY) * k);
  }

  anim(key, frame = 0) {
    if (key) {
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(frame);
    }
  }

  onHurt() {
    if (this.state === "stunned") return;
    this.setState("windup");
  }
}

// ---------------------------------------------------------------------------

class Humanoid extends Enemy {
  constructor(scene, spec, cast) {
    super(scene, spec, `cast-${cast}`, SHEET_INDEX.down);
    this.cast = cast;
    this.body.setSize(10, 6).setOffset(3, 17);
  }

  walkAnim(moving, run = false) {
    const view = viewOf(this.facing);
    this.sprite.setFlipX(this.facing === "left");
    if (moving) {
      const key = `${this.cast}-${run ? "run" : "walk"}-${view}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(SHEET_INDEX[view]);
    }
  }

  crouchPose() {
    this.sprite.anims.stop();
    this.sprite.setFrame(SHEET_INDEX[viewOf(this.facing)] + POSE.crouch);
    this.sprite.setFlipX(this.facing === "left");
  }

  /** Estocada: avanza rápido y deja un zarpazo. */
  lunge(speed, damage, onHit) {
    const d = DIRS[this.facing];
    this.body.setVelocity(d.x * speed, d.y * speed);
    const c = this.center();
    const origin = { right: [10 / 32, 0.5], down: [0.5, 10 / 32], left: [22 / 32, 0.5], up: [0.5, 22 / 32] }[this.facing];
    const fx = this.scene.add.sprite(c.x, c.y, `claw-${this.facing}`, 0).setOrigin(...origin).setDepth(this.y + 2);
    fx.play(`claw-${this.facing}`);
    fx.once("animationcomplete", () => fx.destroy());
    tone(this.scene, "swing");
    this.lungeDamage = damage;
    this.lungeHit = onHit;
  }

  checkLungeHit() {
    if (this.touching(6)) this.scene.damageTarget(this.player(), this.lungeDamage, this, this.lungeHit);
  }

  faceToward(tx, ty) {
    this.facing = dirFromVec(tx - this.x, ty - this.y);
  }
}

// ---------------------------------------------------------------------------

export class Bandit extends Humanoid {
  constructor(scene, spec) {
    super(scene, spec, "bandit");
    this.hp = ENEMY.bandit.hp;
    this.carrying = null;
    this.ambush = Boolean(spec.ambush);
    if (this.ambush) {
      this.sprite.setVisible(false);
      this.shadow.setVisible(false);
      this.body.enable = false;
      this.setState("hidden");
    } else this.setState("idle");
  }

  wantsPlayer() {
    const p = this.player();
    if (p.state === "ko" || this.scene.targetBusy(p)) return false;
    if ((this.spec.minCargo ?? 0) > this.scene.cargoOfTarget(p)) return false;
    const d = this.distToPlayer();
    const sight = p.hidden ? 20 : p.crouching ? ENEMY.bandit.sight * 0.6 : ENEMY.bandit.sight;
    return d < sight && this.lineOfSight(p.x, p.y - 8);
  }

  update(dt) {
    if (this.dead) return;
    if (this.preUpdate(dt)) return;
    const cfg = ENEMY.bandit;
    const p = this.player();
    switch (this.state) {
      case "hidden": {
        if (this.wantsPlayer() && this.distToPlayer() < 60) {
          this.sprite.setVisible(true);
          this.shadow.setVisible(true);
          this.body.enable = true;
          this.faceToward(p.x, p.y);
          this.showBubble("bubble-alert");
          tone(this.scene, "alert");
          sfx(this.scene, "draw", { volume: 0.4 });
          this.scene.fx.grassBurst(this.x, this.y);
          this.scene.tweens.add({ targets: this.sprite, y: this.y - 6, duration: 110, yoyo: true });
          this.setState("chase");
        }
        break;
      }
      case "idle": {
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        if (this.stateTime > 1800) {
          this.facing = ["down", "left", "right", "up"][Math.floor(Math.random() * 4)];
          this.stateTime = 0;
        }
        const loot = this.scene.nearestLoose(this.x, this.y, 140);
        if (loot) this.setState("grab");
        else if (this.wantsPlayer()) {
          this.showBubble("bubble-alert");
          tone(this.scene, "alert");
          this.setState("chase");
        }
        break;
      }
      case "chase": {
        const loot = this.scene.nearestLoose(this.x, this.y, 140);
        if (loot) { this.setState("grab"); break; }
        const d = this.distToPlayer();
        if (!this.wantsPlayer() && this.stateTime > 900) {
          if (d > 150 || p.hidden) {
            this.showBubble("bubble-ask");
            this.setState("return");
            break;
          }
        }
        if (d < 26) {
          this.body.setVelocity(0, 0);
          this.faceToward(p.x, p.y - 4);
          this.setState("windup");
          break;
        }
        this.moveToward(p.x, p.y, cfg.speed);
        this.walkAnim(true, true);
        break;
      }
      case "windup":
        this.body.setVelocity(0, 0);
        this.faceToward(p.x, p.y - 4);
        this.crouchPose();
        this.flash = this.stateTime % 160 < 60 ? 40 : 0;
        if (this.stateTime > 380) {
          this.setState("lunge");
          this.lunge(cfg.lunge, cfg.damage, { steal: true });
        }
        break;
      case "lunge":
        this.walkAnim(true, true);
        this.checkLungeHit();
        if (this.stateTime > 190) {
          this.body.setVelocity(0, 0);
          this.setState("recover");
        }
        break;
      case "recover":
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        if (this.stateTime > 520) this.setState("chase");
        break;
      case "grab": {
        const loot = this.scene.nearestLoose(this.x, this.y, 200);
        if (!loot) { this.setState("chase"); break; }
        if (this.moveToward(loot.x, loot.y, cfg.speed + 12) || Phaser.Math.Distance.Between(this.x, this.y, loot.x, loot.y) < 8) {
          this.carrying = this.scene.takeLoose(loot);
          this.showBubble("bubble-talk", 500);
          this.setState("flee");
        }
        this.walkAnim(true, true);
        break;
      }
      case "flee": {
        // Escapa lejos del jugador, esquivando árboles: prueba 8 rumbos y se queda con el más libre.
        this.fleeTimer = (this.fleeTimer ?? 0) - dt;
        const b = this.body.blocked;
        if (!this.fleeDir || this.fleeTimer <= 0 || b.left || b.right || b.up || b.down) {
          const ax = this.x - p.x;
          const ay = this.y - p.y;
          const al = Math.hypot(ax, ay) || 1;
          let best = null;
          let bestScore = -Infinity;
          for (let k = 0; k < 8; k += 1) {
            const a = (k / 8) * Math.PI * 2;
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            let free = 0;
            for (const r of [10, 20, 30]) if (!this.scene.world.solidAt(this.x + dx * r, this.y - 3 + dy * r)) free += 1;
            const score = (dx * ax + dy * ay) / al + free * 0.9 - (free < 3 ? 2 : 0);
            if (score > bestScore) { bestScore = score; best = { x: dx, y: dy }; }
          }
          this.fleeDir = best;
          this.fleeTimer = 350;
        }
        const sp = cfg.speed + 6;
        this.body.setVelocity(this.fleeDir.x * sp, this.fleeDir.y * sp);
        this.facing = dirFromVec(this.fleeDir.x, this.fleeDir.y);
        this.walkAnim(true, true);
        const view = this.scene.cameras.main.worldView;
        const offscreen = !view.contains(this.x, this.y - 8);
        if (this.distToPlayer() > 230 || (offscreen && this.distToPlayer() > 170) || this.stateTime > 9000) {
          this.scene.banditEscaped(this);
          this.dead = true;
          this.destroy();
        }
        break;
      }
      case "return": {
        const arrived = this.moveToward(this.home.x, this.home.y, cfg.speed * 0.7);
        this.walkAnim(!arrived);
        if (arrived) this.setState(this.ambush ? "idle" : "idle");
        if (this.wantsPlayer() && this.stateTime > 600) this.setState("chase");
        break;
      }
      default:
        this.setState("idle");
    }
    if (this.carrying) {
      this.carryIcon ??= this.scene.add.image(this.x, this.y - 26, `gem-${this.carrying}`).setDepth(DEPTH.fx);
      this.carryIcon.setPosition(this.x, this.y - 26 + Math.sin(this.stateTime * 0.02) * 1.5);
    }
  }

  onHurt() {
    if (this.state === "idle" || this.state === "return") this.setState("chase");
  }

  destroy() {
    super.destroy();
    this.carryIcon?.destroy();
  }
}

// ---------------------------------------------------------------------------

export class Guard extends Humanoid {
  constructor(scene, spec) {
    super(scene, spec, "guard");
    this.hp = ENEMY.guard.hp;
    this.patrol = (spec.patrol ?? []).map(([x, y]) => ({ x: x * TILE, y: y * TILE }));
    this.patrolIndex = 0;
    this.patrolStep = 1;
    this.suspicion = 0;
    this.hostile = false;
    this.lastSeen = null;
    this.cone = scene.add.graphics().setDepth(DEPTH.cone);
    this.setState(spec.post ? "post" : "patrol");
  }

  sightRange() {
    const p = this.player();
    // Una caravana grande se ve de más lejos.
    const base = ENEMY.guard.sight * (this.scene.heatLevel() >= 2 ? 1.2 : 1) * (this.scene.groupSight?.() ?? 1);
    if (p.hidden) return 0;
    return p.crouching ? base * 0.55 : base;
  }

  /** ¿Ve al jugador? Distancia, ángulo del cono y línea de vista. */
  sees() {
    const p = this.player();
    if (p.state === "ko" || this.scene.targetBusy(p)) return false;
    const d = this.distToPlayer();
    if (d < 18 && !p.hidden) return true;
    if (d > this.sightRange()) return false;
    const f = DIRS[this.facing];
    const ang = Math.atan2(p.y - 8 - (this.y - 8), p.x - this.x) - Math.atan2(f.y, f.x);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(ang));
    if (diff > ENEMY.guard.fov) return false;
    return this.lineOfSight(p.x, p.y - 8);
  }

  suspicious() {
    return this.hostile || this.scene.visibleOfTarget(this.player()) > 0;
  }

  drawCone() {
    const g = this.cone;
    g.clear();
    if (this.dead || this.state === "down") return;
    const range = ENEMY.guard.sight * (this.scene.heatLevel() >= 2 ? 1.2 : 1) * (this.scene.groupSight?.() ?? 1);
    const f = DIRS[this.facing];
    const a0 = Math.atan2(f.y, f.x);
    const alert = this.state === "chase" || this.hostile;
    const color = alert ? 0xe0493d : this.suspicion > 0.05 ? 0xe6b736 : 0xfaf3e1;
    const alpha = alert ? 0.2 : this.suspicion > 0.05 ? 0.2 : this.scene.visibleCargo() > 0 ? 0.13 : 0.07;
    const ox = this.x;
    const oy = this.y - 6;
    const pts = [{ x: ox, y: oy }];
    const rays = 12;
    for (let i = 0; i <= rays; i += 1) {
      const a = a0 - ENEMY.guard.fov + (i / rays) * ENEMY.guard.fov * 2;
      let r = 0;
      while (r < range) {
        r += 6;
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        if (this.scene.world.solidAt(x, y) && this.scene.world.cellAt(x, y) !== "~") break;
      }
      pts.push({ x: Math.round(ox + Math.cos(a) * r), y: Math.round(oy + Math.sin(a) * r) });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }

  update(dt) {
    if (this.dead) return;
    if (this.preUpdate(dt)) { this.drawCone(); return; }
    const cfg = ENEMY.guard;
    const p = this.player();
    const sees = this.sees();
    if (sees) this.lastSeen = { x: p.x, y: p.y };

    // Sospecha: sube mientras te ve con carga; baja si no.
    if (["patrol", "post", "search", "return", "suspect"].includes(this.state)) {
      if (sees && this.suspicious()) {
        const close = 1 - Math.min(1, this.distToPlayer() / cfg.sight);
        this.suspicion += (dt / 1000) * (1.3 + close * 2.2);
        if (this.state !== "suspect") {
          this.setState("suspect");
          this.showBubble("bubble-ask", 0);
          tone(this.scene, "suspect");
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - dt / 1600);
      }
      if (this.suspicion >= 1) {
        this.suspicion = 1;
        this.alarm();
      }
    }

    switch (this.state) {
      case "post":
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        if (this.stateTime > 2600) {
          this.facing = this.facing === this.spec.dir ? (Math.random() < 0.5 ? "left" : "right") : this.spec.dir;
          this.stateTime = 0;
        }
        break;
      case "patrol": {
        if (!this.patrol.length) { this.setState("post"); break; }
        const t = this.patrol[this.patrolIndex];
        const arrived = this.moveToward(t.x, t.y, cfg.speed);
        this.walkAnim(!arrived);
        if (arrived) {
          if (this.patrolIndex + this.patrolStep >= this.patrol.length || this.patrolIndex + this.patrolStep < 0) this.patrolStep *= -1;
          this.patrolIndex += this.patrolStep;
          this.pauseTime = 700;
          this.setState("pause");
        }
        break;
      }
      case "pause":
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        if (this.stateTime > this.pauseTime) this.setState(this.spec.post ? "post" : "patrol");
        break;
      case "suspect":
        this.body.setVelocity(0, 0);
        if (this.lastSeen) this.faceToward(this.lastSeen.x, this.lastSeen.y);
        this.walkAnim(false);
        if (!sees && this.stateTime > 900) {
          this.bubble?.destroy();
          this.bubble = null;
          this.setState(this.suspicion > 0.3 ? "search" : this.spec.post ? "post" : "patrol");
        }
        break;
      case "chase": {
        if (sees) this.lostTime = 0;
        else this.lostTime = (this.lostTime ?? 0) + dt;
        const target = sees ? p : this.lastSeen;
        if (this.lostTime > 2400 || !target) {
          this.showBubble("bubble-ask", 900);
          this.setState("search");
          break;
        }
        if (this.hostile && this.distToPlayer() < 26) {
          this.faceToward(p.x, p.y - 4);
          this.setState("windup");
          break;
        }
        this.moveToward(target.x, target.y, cfg.chase);
        this.walkAnim(true, true);
        if (!this.hostile && this.touching(2)) this.scene.onGuardCatch(this);
        break;
      }
      case "windup":
        this.body.setVelocity(0, 0);
        this.crouchPose();
        this.flash = this.stateTime % 160 < 60 ? 40 : 0;
        if (this.stateTime > 420) {
          this.setState("lunge");
          this.lunge(150, cfg.damage, { steal: false });
        }
        break;
      case "lunge":
        this.walkAnim(true, true);
        this.checkLungeHit();
        if (this.stateTime > 180) { this.body.setVelocity(0, 0); this.setState("recover"); }
        break;
      case "recover":
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        if (this.stateTime > 600) this.setState("chase");
        break;
      case "search": {
        const t = this.lastSeen ?? this.home;
        const arrived = this.moveToward(t.x, t.y, cfg.speed);
        this.walkAnim(!arrived);
        if (arrived && this.stateTime > 600) {
          if (Math.floor(this.stateTime / 600) % 2) this.facing = ["left", "right", "up", "down"][Math.floor(this.stateTime / 600) % 4];
        }
        if (sees && this.suspicious()) { this.alarm(); break; }
        if (this.stateTime > 3200) {
          this.suspicion = 0;
          this.hostile = false;
          this.setState("return");
        }
        break;
      }
      case "return": {
        const t = this.spec.post ? this.home : this.patrol[this.patrolIndex] ?? this.home;
        const arrived = this.moveToward(t.x, t.y, cfg.speed);
        this.walkAnim(!arrived);
        if (arrived) {
          if (this.spec.post) this.facing = this.spec.dir ?? "down";
          this.setState(this.spec.post ? "post" : "patrol");
        }
        break;
      }
      case "stunned":
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        this.sprite.x += Math.sin(this.stateTime * 0.1) * 0.4;
        if (this.stateTime > 700) this.setState("chase");
        break;
      default:
        this.setState("patrol");
    }
    this.drawCone();
  }

  alarm() {
    if (this.state === "chase") return;
    this.showBubble("bubble-alert", 900);
    tone(this.scene, "alert");
    sfx(this.scene, "horn", { volume: 0.25 });
    sfx(this.scene, "armor", { volume: 0.35 });
    this.setState("chase");
    this.lostTime = 0;
    this.scene.onGuardAlarm(this);
  }

  onHurt() {
    // Pegarle a un guardia de la Corona es otro nivel de problema.
    if (!this.hostile) {
      this.hostile = true;
      this.scene.onGuardAttacked(this);
    }
    this.showBubble("bubble-alert", 600);
    this.setState("chase");
  }

  die() {
    // Los guardias no mueren: quedan tendidos y el calor sube mucho.
    this.dead = true;
    release(this);
    this.body.enable = false;
    this.bubble?.destroy();
    this.cone.clear();
    this.sprite.anims.stop();
    this.sprite.setTexture("ko-guard");
    // Cae tendido con un aplastón, después del congelado del golpe.
    const wait = Math.max(0, (this.hitstopUntil ?? 0) - this.scene.time.now);
    this.scene.time.delayedCall(wait, () => { if (!this.sprite.active) return; this.whiten(false); squash(this.scene, this.sprite, 1.25, 0.7, 140); });
    this.scene.fx.poof(this.x, this.y - 6);
    if (!this.puppet) this.scene.onEnemyDefeated(this);
    this.scene.net?.enemyDied(this);
  }

  /** Empujón al huir de una revisión: el guardia se queda aturdido un momento. */
  shove() {
    // Si el mapa cambió a media revisión, este guardia ya no existe.
    if (!this.body) return;
    if (this.puppet) { this.scene.net?.enemyAct(this, "shove"); return; }
    this.setState("stunned");
    this.hostile = true;
    const p = this.player();
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    this.body.setVelocity((dx / len) * 140, (dy / len) * 140);
    this.knockTime = 160;
  }
}

// ---------------------------------------------------------------------------

/** Escorpión: enterrado en la arena (sólo se ve la arena removida), sale si te acercas y pica. */
export class Scorpion extends Enemy {
  constructor(scene, spec) {
    super(scene, spec, "scorpion", 3);
    this.hp = ENEMY.scorpion.hp;
    this.body.setSize(14, 6).setOffset(3, 7);
    this.shadow.setVisible(false);
    this.setState("buried");
  }

  update(dt) {
    if (this.dead) return;
    if (this.preUpdate(dt)) return;
    const cfg = ENEMY.scorpion;
    const p = this.player();
    const d = this.distToPlayer();
    const s = this.sprite;
    switch (this.state) {
      case "buried":
        this.body.setVelocity(0, 0);
        s.anims.stop();
        s.setFrame(3);
        // La arena tiembla un poco para que el jugador atento lo note.
        s.x = this.home.x + (Math.floor(this.stateTime / 90) % 2 ? 0.5 : -0.5);
        if (d < cfg.sight && p.state !== "ko" && !this.scene.targetBusy(p)) {
          this.setState("emerge");
          this.scene.fx.dust(this.x, this.y, 0.8);
          tone(this.scene, "suspect");
          sfx(this.scene, "scorpion", { volume: 0.4 });
        }
        break;
      case "emerge":
        this.body.setVelocity(0, 0);
        s.setFrame(0);
        this.shadow.setVisible(true);
        if (this.stateTime > 300) this.setState("chase");
        break;
      case "chase": {
        this.moveToward(p.x, p.y, cfg.speed);
        s.setFlipX(p.x < this.x);
        if (s.anims.currentAnim?.key !== "scorpion-walk") s.play("scorpion-walk");
        if (d < 22) this.setState("windup");
        if (d > cfg.sight * 1.8) this.setState("return");
        break;
      }
      case "windup":
        this.body.setVelocity(0, 0);
        s.anims.stop();
        s.setFrame(2);
        s.setFlipX(p.x < this.x);
        this.flash = this.stateTime % 140 < 50 ? 40 : 0;
        if (this.stateTime > 320) {
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.body.setVelocity((dx / len) * 110, (dy / len) * 110);
          this.setState("strike");
        }
        break;
      case "strike":
        if (this.touching(4)) this.scene.damageTarget(this.player(), cfg.damage, this, { steal: false });
        if (this.stateTime > 160) {
          this.body.setVelocity(0, 0);
          this.setState("recover");
        }
        break;
      case "recover":
        this.body.setVelocity(0, 0);
        s.setFrame(0);
        if (this.stateTime > 700) this.setState(d > cfg.sight ? "return" : "chase");
        break;
      case "return": {
        const arrived = this.moveToward(this.home.x, this.home.y, cfg.speed);
        if (s.anims.currentAnim?.key !== "scorpion-walk") s.play("scorpion-walk");
        if (arrived) {
          this.shadow.setVisible(false);
          this.setState("buried");
        }
        break;
      }
      default:
        this.setState("buried");
    }
  }

  onHurt() {
    if (this.state === "buried") this.setState("chase");
  }
}

export function makeEnemy(scene, spec) {
  if (spec.kind === "boar") return new Boar(scene, spec);
  if (spec.kind === "wolf") return new Boar(scene, spec, "wolf");
  if (spec.kind === "scorpion") return new Scorpion(scene, spec);
  if (spec.kind === "bandit") return new Bandit(scene, spec);
  if (spec.kind === "guard") return new Guard(scene, spec);
  return null;
}
