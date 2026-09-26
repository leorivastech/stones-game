/**
 * Enemigos que se ven caminando por el mapa. Nada de turnos: todo pasa en tiempo real.
 *
 *  Jabalí  — te ve, escarba y embiste en línea recta. Si choca con roca, queda aturdido.
 *  Bandido — escondido o de guardia en su campamento. Te persigue, avisa y se lanza.
 *            Si te pega con piedras encima, se te cae una; él corre a levantarla y huye.
 *  Guardia — patrulla con cono de visión. Si te ve con piedras a la vista, sospecha (?),
 *            se alarma (!) y te persigue. Si te alcanza: revisión. Si le pegas, pelea.
 *            Lleva escudo al frente: hay que rodearlo o pegarle tras su estocada.
 *
 *  De noche los guardias ven menos (salvo junto a un farol) y los bandidos más; salen más bandidos
 *  y lobos. La fama sube la vida de los bandidos y la vista de los guardias.
 */

import Phaser from "phaser";
import { SHEET_INDEX, POSE } from "../art/actors.js";
import { DEPTH, ENEMY, ENEMY_JITTER, FAME_CURVE, NIGHT, STEALTH, TILE } from "../config.js";
import { tone, sfx } from "../sfx.js";
import { DIRS, viewOf } from "./player.js";
import { frozen, hitstop, release, shake, squash } from "../engine/juice.js";
import { isNight } from "../engine/daylight.js";
import { online } from "../net/online.js";
import { FAME_TITLES, reputation } from "../state.js";

// Parpadeo al recibir un golpe: blanco/normal 3 veces.
const BLINK_STEP = 45;
const BLINK_TIME = BLINK_STEP * 6;

/** Un tiempo de ataque con ±25 % al azar: cada ataque se siente un poco distinto. */
const jit = (ms) => ms * (1 - ENEMY_JITTER + Math.random() * ENEMY_JITTER * 2);

/** Título de fama como número: 0 Desconocido, 1 Mensajero … 4 Leyenda del golfo. */
export function fameTier(reg) {
  const v = reputation(reg);
  let tier = 0;
  FAME_TITLES.forEach((t, i) => { if (v >= t.min) tier = i; });
  return tier;
}

/** ¿Es de noche en este mapa? (Las cuevas no cuentan.) Se revisa cada medio segundo. */
export function nightIn(scene) {
  const now = scene.time.now;
  if (scene._nightAt == null || now - scene._nightAt > 500) {
    scene._nightAt = now;
    scene._night = !scene.def?.dark && isNight(scene.registry);
  }
  return scene._night;
}

/** ¿Hay una luz prendida (farol, fogata, ventana) sobre este punto? */
function litAt(scene, x, y) {
  for (const l of scene.daylight?.lights ?? []) {
    const img = l.img;
    if (!img.visible || img.alpha < 0.2) continue;
    const r = img.width * 0.55;
    if (Math.abs(img.x - x) < r && Math.abs(img.y - y) < r && Math.hypot(img.x - x, img.y - y) < r) return true;
  }
  return false;
}

/** Cuánto se deja ver un blanco (multiplica la vista): 0 escondido … 1 a la vista. */
function stealthOf(p) {
  if (p.hidden) return 0;
  if (typeof p.stealth === "number") return p.stealth;
  return p.crouching ? STEALTH.crouch : 1; // jugadores de otro aparato
}

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

  /**
   * `remote`: el golpe viene de otro aparato (lo manda WorldNet a quien corre la IA). Si el enemigo
   * acaba de recibir otro golpe se ignora: dos jugadores pegando a la vez no hacen daño doble.
   * `push` multiplica el empujón (ataque cargado).
   */
  hit(damage, fromX, fromY, { remote = false, push = 1 } = {}) {
    if (this.dead || this.invuln > 0) return false;
    if (remote && this.scene.time.now - (this.lastHitAt ?? -1e9) < 360) return false;
    // Escudo (guardia): de frente no entra. En un títere se decide aquí y el golpe se manda igual.
    if (this.blocks?.(fromX, fromY)) {
      this.block(fromX, fromY);
      if (this.puppet) this.scene.net?.hitPuppet(this, damage, fromX, fromY);
      return false;
    }
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
    this.lastHitAt = this.scene.time.now;
    this.hitBlink = BLINK_TIME;
    const c = this.center();
    const dx = c.x - fromX;
    const dy = c.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    // Empujón según el tipo (jabalí y escorpión vuelan, el guardia apenas se mueve) y el daño.
    const kind = this.kind ?? this.spec.kind;
    // `push`: el ataque cargado empuja más (config.PLAYER.charge.push).
    const force = (ENEMY[kind]?.knock ?? 190) * (0.75 + 0.25 * damage) * (this.hp <= 0 ? 1.3 : 1) * push;
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
    this.mark?.destroy();
  }

  preUpdate(dt) {
    // Títere en línea: sus cambios de estado llegan por la red; algunos tienen algo que ver (el cuchillo).
    if (this.puppet && this.state !== this.netState) {
      const prev = this.netState;
      this.netState = this.state;
      if (prev !== undefined) this.onNetState?.(this.state, prev);
    }
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

  /**
   * Animales: de lado, de frente o de espalda según hacia dónde van (con un margen para no parpadear
   * en diagonal). `base` = "boar-walk", "wolf-run"…; devuelve la clave con la vista.
   */
  viewKey(base) {
    const v = this.body.velocity;
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    if (ay > 4 && ay > ax * 1.3) this.moveView = v.y < 0 ? "up" : "down";
    else if (ax > 4 && ax > ay * 1.1) this.moveView = "side";
    const view = this.moveView ?? "side";
    return view === "side" ? base : `${base}-${view}`;
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

  /** ¿Te ve? Agachado o entre el pasto te ve de más cerca; escondido, no. */
  spots(p, d) {
    const k = stealthOf(p);
    return k > 0 && d < ENEMY[this.kind].sight * k && p.state !== "ko" && this.lineOfSight(p.x, p.y - 8);
  }

  /** Lobos: al ver presa avisa a la manada; los que estén cerca la rodean por el costado. */
  alertPack(p) {
    if (this.kind !== "wolf") return;
    for (const e of this.scene.enemies) {
      if (e === this || e.dead || e.puppet || e.kind !== "wolf" || e.state !== "wander") continue;
      if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) > 150) continue;
      // Rodea por el lado contrario al del que avisó, para llegar de costado.
      const cross = (this.x - p.x) * (e.y - p.y) - (this.y - p.y) * (e.x - p.x);
      e.flankSide = cross === 0 ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(cross);
      e.setState("flank");
      e.showBubble("bubble-alert", 400);
      break; // uno rodea; los demás siguen a lo suyo
    }
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
        if (this.spots(p, d)) {
          this.setState("windup");
          this.body.setVelocity(0, 0);
          this.showBubble("bubble-alert", 500);
          tone(this.scene, "charge");
          sfx(this.scene, this.kind === "wolf" ? "growl" : "boar", { volume: 0.4, detune: (Math.random() - 0.5) * 200 });
          this.alertPack(p);
        }
        break;
      }
      case "flank": {
        // Da la vuelta alrededor de la presa (a ~60 px, 90° hacia su lado) y de ahí embiste.
        const a = Math.atan2(this.y - p.y, this.x - p.x) + this.flankSide * (Math.PI / 2);
        const tx = p.x + Math.cos(a) * 60;
        const ty = p.y + Math.sin(a) * 60;
        const arrived = this.moveToward(tx, ty, cfg.speed * 2.2);
        this.anim(`${this.kind}-run`);
        if (Math.abs(this.body.velocity.x) > 1) this.sprite.setFlipX(this.body.velocity.x < 0);
        if (arrived || this.stateTime > 1500 || Phaser.Math.Distance.Between(this.x, this.y, tx, ty) < 10) {
          this.body.setVelocity(0, 0);
          this.windupMs = jit((cfg.windup ?? 560) * 0.6);
          this.setState("windup");
        }
        break;
      }
      case "windup": {
        this.body.setVelocity(0, 0);
        this.anim(null, 2);
        this.sprite.setFlipX(p.x < this.x);
        this.sprite.x += Math.sin(this.stateTime * 0.08) * 0.6;
        if (Math.floor(this.stateTime / 120) % 2 === 0) this.scene.fx.dust(this.x - (this.sprite.flipX ? -8 : 8), this.y, 0.6);
        this.windupMs ??= jit(cfg.windup ?? 560);
        if (this.stateTime > this.windupMs) {
          this.windupMs = null;
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.chargeDir = { x: dx / len, y: dy / len };
          // Jabalí: a veces (30 %) embiste dos veces seguidas.
          if (this.kind === "boar" && !this.second) this.double = Math.random() < 0.3;
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
        const b = this.body;
        const blocked = b.blocked.left || b.blocked.right || b.blocked.up || b.blocked.down;
        if (this.stateTime > 120 && blocked) {
          this.setState("stunned");
          this.double = false;
          this.second = false;
          this.body.setVelocity(0, 0);
          shake(this.scene, "bump");
          tone(this.scene, "bump");
          this.showBubble("bubble-ask", 900);
        } else if (this.stateTime > (this.second ? 650 : 950)) {
          if (this.double) {
            // Segunda embestida: frena, se voltea rápido y vuelve a cargar.
            this.double = false;
            this.second = true;
            this.body.setVelocity(0, 0);
            this.windupMs = jit(260);
            this.showBubble("bubble-alert", 300);
            this.setState("windup");
          } else {
            this.second = false;
            this.setState("rest");
          }
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
        this.restMs ??= jit(700);
        if (this.stateTime > this.restMs) { this.restMs = null; this.setState("wander"); }
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
      const k = this.viewKey(key);
      if (this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k);
    } else {
      this.moveView = "side";
      this.sprite.anims.stop();
      this.sprite.setFrame(frame);
    }
  }

  onHurt() {
    if (this.state === "stunned") return;
    this.windupMs = null;
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

  /** Pose de golpe con su arma: "windup" (preparar, el aviso) o "strike" (la estocada). */
  swingPose(phase) {
    this.sprite.anims.stop();
    this.sprite.setFrame(SHEET_INDEX[viewOf(this.facing)] + POSE[phase]);
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
    // Curva por fama: desde el título 3, los bandidos aguantan un golpe más.
    this.hp = ENEMY.bandit.hp + (fameTier(scene.registry) >= FAME_CURVE.banditHpFrom ? 1 : 0);
    this.carrying = null;
    this.knifeCd = 1200;
    this.knifeRoll = 0;
    this.ambush = Boolean(spec.ambush);
    if (this.ambush) this.hide();
    else this.setState("idle");
  }

  /** Emboscada: invisible y sin cuerpo hasta que pasas cerca. */
  hide() {
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.bubble?.destroy();
    this.bubble = null;
    this.setState("hidden");
  }

  sightRange(p) {
    // Escondido en el pasto te ve solo si casi lo pisas. De noche ven más lejos.
    if (p.hidden) return 20;
    return ENEMY.bandit.sight * (nightIn(this.scene) ? NIGHT.banditSight : 1) * stealthOf(p);
  }

  wantsPlayer() {
    const p = this.player();
    if (p.state === "ko" || this.scene.targetBusy(p)) return false;
    if ((this.spec.minCargo ?? 0) > this.scene.cargoOfTarget(p)) return false;
    const d = this.distToPlayer();
    return d < this.sightRange(p) && this.lineOfSight(p.x, p.y - 8);
  }

  /** Cuchillo recto hacia el blanco. `visual`: en un títere solo se ve (el daño lo cuenta quien manda). */
  throwKnife(visual = false) {
    const cfg = ENEMY.bandit.knife;
    const p = this.player();
    const c = this.center();
    const a = Math.atan2(p.y - 9 - c.y, p.x - c.x);
    const scene = this.scene;
    const img = scene.add.image(c.x, c.y, "knife").setRotation(a).setDepth(DEPTH.fx);
    const k = { x: c.x, y: c.y, vx: Math.cos(a) * cfg.speed, vy: Math.sin(a) * cfg.speed, left: cfg.range, img };
    tone(scene, "swing");
    sfx(scene, "knife", { volume: 0.3, detune: (Math.random() - 0.5) * 300 });
    const done = () => {
      scene.events.off("update", step);
      scene.events.off("shutdown", done);
      if (img.active) img.destroy();
    };
    const step = (_t, delta) => {
      if (!img.active) { done(); return; }
      const dt = Math.min(delta, 50);
      const mx = (k.vx * dt) / 1000;
      const my = (k.vy * dt) / 1000;
      k.x += mx;
      k.y += my;
      k.left -= Math.hypot(mx, my);
      img.setPosition(Math.round(k.x), Math.round(k.y)).setDepth(k.y + 9);
      const w = scene.world;
      if (k.left <= 0 || (w.solidAt(k.x, k.y + 8) && w.cellAt(k.x, k.y + 8) !== "~")) {
        if (k.left > 0) scene.fx.spark(k.x, k.y);
        done();
        return;
      }
      if (visual) return;
      const targets = scene.net ? scene.net.targets() : [scene.player];
      for (const t of targets) {
        if (!t || t.state === "ko") continue;
        const b = t.body;
        if (k.x < b.x - 2 || k.x > b.x + b.width + 2 || k.y < b.y - 16 || k.y > b.y + b.height + 1) continue;
        // Rodando (o recién golpeado) el cuchillo pasa de largo: se puede esquivar.
        if (!t.remote && (t.invuln > 0 || t.state === "jump")) continue;
        scene.damageTarget(t, cfg.damage, { kind: "knife", x: k.x, y: k.y, center: () => ({ x: k.x - k.vx * 0.05, y: k.y - k.vy * 0.05 }) }, { steal: false });
        done();
        return;
      }
    };
    scene.events.on("update", step);
    scene.events.once("shutdown", done);
  }

  onNetState(st, prev) {
    if (st === "thrown") this.throwKnife(true);
    // Emboscada en un títere: sin cuerpo mientras está escondido, con cuerpo al salir (para poder pegarle).
    if (st === "hidden") this.body.enable = false;
    else if (prev === "hidden") this.body.enable = true;
  }

  update(dt) {
    if (this.dead) return;
    if (this.preUpdate(dt)) return;
    const cfg = ENEMY.bandit;
    const p = this.player();
    this.knifeCd -= dt;
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
          // Patrón: estocada normal o finta (amaga, se para y ataca después).
          this.setState(Math.random() < cfg.feint ? "feint" : "windup");
          break;
        }
        // A media distancia, a veces lanza un cuchillo (cada 3 s como mucho).
        this.knifeRoll -= dt;
        if (this.knifeCd <= 0 && this.knifeRoll <= 0 && d > cfg.knife.min && d < cfg.knife.max) {
          this.knifeRoll = 500;
          if (Math.random() < cfg.knife.chance && this.lineOfSight(p.x, p.y - 8)) {
            this.body.setVelocity(0, 0);
            this.faceToward(p.x, p.y - 4);
            this.setState("aim");
            break;
          }
        }
        this.moveToward(p.x, p.y, cfg.speed);
        this.walkAnim(true, true);
        break;
      }
      case "aim":
        // Brazo arriba y un destello lento: el aviso de que viene un cuchillo.
        this.body.setVelocity(0, 0);
        this.faceToward(p.x, p.y - 4);
        this.sprite.anims.stop();
        this.sprite.setFrame(SHEET_INDEX[viewOf(this.facing)] + POSE.windup);
        this.sprite.setFlipX(this.facing === "left");
        this.flash = this.stateTime % 200 < 60 ? 40 : 0;
        this.aimMs ??= jit(cfg.knife.aim);
        if (this.stateTime > this.aimMs) {
          this.aimMs = null;
          this.knifeCd = cfg.knife.cooldown;
          this.throwKnife();
          this.setState("thrown");
        }
        break;
      case "thrown":
        this.body.setVelocity(0, 0);
        if (this.stateTime > 360) this.setState("chase");
        break;
      case "feint":
        // Amaga (se agacha y da medio paso) y se detiene; ataca ~250 ms después.
        this.feintA ??= jit(cfg.feintFake);
        this.feintB ??= jit(cfg.feintWait);
        if (this.stateTime < this.feintA) {
          const f = DIRS[this.facing];
          this.body.setVelocity(f.x * 45, f.y * 45);
          this.crouchPose();
          this.flash = this.stateTime % 160 < 60 ? 40 : 0;
        } else {
          this.body.setVelocity(0, 0);
          this.walkAnim(false);
          this.faceToward(p.x, p.y - 4);
        }
        if (this.stateTime > this.feintA + this.feintB) {
          this.feintA = this.feintB = null;
          this.faceToward(p.x, p.y - 4);
          this.setState("lunge");
          this.lunge(cfg.lunge, cfg.damage, { steal: true });
        }
        break;
      case "windup":
        this.body.setVelocity(0, 0);
        this.faceToward(p.x, p.y - 4);
        this.swingPose("windup");
        this.flash = this.stateTime % 160 < 60 ? 40 : 0;
        this.windupMs ??= jit(cfg.windup);
        if (this.stateTime > this.windupMs) {
          this.windupMs = null;
          this.setState("lunge");
          this.lunge(cfg.lunge, cfg.damage, { steal: true });
        }
        break;
      case "lunge":
        this.swingPose("strike");
        this.checkLungeHit();
        if (this.stateTime > 190) {
          this.body.setVelocity(0, 0);
          this.setState("recover");
        }
        break;
      case "recover":
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        this.recoverMs ??= jit(cfg.recover);
        if (this.stateTime > this.recoverMs) { this.recoverMs = null; this.setState("chase"); }
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
        // El de emboscada se vuelve a esconder en su pasto: la emboscada sirve otra vez.
        if (arrived) {
          if (this.ambush) this.hide();
          else this.setState("idle");
        } else if (this.wantsPlayer() && this.stateTime > 600) this.setState("chase");
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
    this.dashCd = 1200;
    // Curva por fama: cada título, +10 % de vista.
    this.fameSight = 1 + FAME_CURVE.guardSightPerTier * fameTier(scene.registry);
    this.cone = scene.add.graphics().setDepth(DEPTH.cone);
    this.setState(spec.post ? "post" : "patrol");
  }

  /**
   * Hasta dónde ve (sin contar cómo vas tú). Una caravana grande se ve de más lejos, con calor alto
   * más, con fama más. De noche ×0.7, salvo que el blanco esté bajo la luz de un farol o fogata.
   */
  baseSight(p = this.player()) {
    let r = ENEMY.guard.sight * (this.scene.heatLevel() >= 2 ? 1.2 : 1) * (this.scene.groupSight?.() ?? 1) * this.fameSight;
    if (nightIn(this.scene) && !litAt(this.scene, p.x, p.y - 8)) r *= NIGHT.guardSight;
    return r;
  }

  sightRange() {
    const p = this.player();
    return this.baseSight(p) * stealthOf(p);
  }

  /** Escudo: de frente (±57°) no le entra nada, salvo tras su estocada (recover) o aturdido. */
  blocks(fx, fy) {
    if (this.dead || this.state === "recover" || this.state === "stunned") return false;
    const f = DIRS[this.facing];
    const dx = fx - this.x;
    const dy = fy - (this.y - 8);
    const len = Math.hypot(dx, dy) || 1;
    return (dx * f.x + dy * f.y) / len > Math.cos(ENEMY.guard.shieldArc);
  }

  /** Golpe al escudo: chispa, "tonk", sin daño y el jugador rebota un poco. */
  block(fx, fy) {
    const scene = this.scene;
    const f = DIRS[this.facing];
    const sx = this.x + f.x * 7;
    const sy = this.y - 9 + f.y * 5;
    scene.fx.spark(sx, sy);
    tone(scene, "bump");
    sfx(scene, "armor", { volume: 0.3, detune: 300 });
    shake(scene, "bump");
    this.invuln = 180;
    // Solo rebota el jugador de este aparato si el golpe fue suyo (no una flecha de Sahra).
    const p = scene.player;
    const c = p.center();
    if (Math.hypot(c.x - fx, c.y - fy) < 6) {
      hitstop(scene, 50);
      p.recoil?.(this.x, this.y - 8);
    }
    // Pegarle al escudo de la Corona también cuenta como ataque.
    if (!this.puppet && !this.hostile) this.onHurt();
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
    // Cono en píxeles (G11): trama Bayer 4×4 en vez de un polígono con alpha, para que no desentone
    // con el pixel art. La forma se dibuja en coordenadas del guardia y sólo se repinta cuando cambia
    // (dirección, alcance, paredes o color); al caminar en campo abierto sólo se mueve.
    const g = this.cone;
    if (this.dead || this.state === "down") { g.clear(); g.coneKey = null; return; }
    const range = this.baseSight();
    const f = DIRS[this.facing];
    const a0 = Math.atan2(f.y, f.x);
    const alert = this.state === "chase" || this.hostile;
    const color = alert ? 0xe0493d : this.suspicion > 0.05 ? 0xe6b736 : 0xfaf3e1;
    // Densidad de la trama (fracción de píxeles pintados) con un alpha fijo: mismo peso que antes.
    const dens = alert ? 0.5 : this.suspicion > 0.05 ? 0.5 : this.scene.visibleCargo() > 0 ? 0.3 : 0.15;
    const ox = Math.round(this.x);
    const oy = Math.round(this.y - 6);
    const pts = [[0, 0]];
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
      pts.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)]);
    }
    g.setPosition(ox, oy);
    const key = `${color}|${dens}|${pts.join(";")}`;
    if (g.coneKey === key) return;
    g.coneKey = key;
    g.clear();
    g.fillStyle(color, 0.45);
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    let y0 = 0;
    let y1 = 0;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const n = pts.length;
    const xs = [];
    for (let y = y0; y <= y1; y += 1) {
      // Relleno por renglones (par-impar): cortes del renglón con los lados del polígono.
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i += 1) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % n];
        if ((ay <= cy) !== (by <= cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5);
        const xb = Math.floor(xs[k + 1] - 0.5);
        for (let x = xa; x <= xb; x += 1) {
          // El borde del cono va más cerrado para que se lea la forma.
          const edge = x === xa || x === xb;
          const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
          if (t < (edge ? Math.min(1, dens * 2) : dens)) g.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  update(dt) {
    if (this.dead) return;
    if (this.preUpdate(dt)) { this.drawCone(); return; }
    const cfg = ENEMY.guard;
    const p = this.player();
    const sees = this.sees();
    if (sees) this.lastSeen = { x: p.x, y: p.y };
    this.dashCd -= dt;
    if (this.state !== "search") this.clearMark();

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
          if (this.suspicion > 0.3) this.startSearch();
          else this.setState(this.spec.post ? "post" : "patrol");
        }
        break;
      case "chase": {
        if (sees) this.lostTime = 0;
        else this.lostTime = (this.lostTime ?? 0) + dt;
        const target = sees ? p : this.lastSeen;
        if (this.lostTime > 2400 || !target) {
          this.showBubble("bubble-ask", 900);
          this.startSearch();
          break;
        }
        const d = this.distToPlayer();
        if (this.hostile && d < 26) {
          this.faceToward(p.x, p.y - 4);
          this.setState("windup");
          break;
        }
        // Embestida corta con el escudo si estás a 40-70 px.
        if (this.hostile && sees && this.dashCd <= 0 && d > cfg.dash.min && d < cfg.dash.max) {
          this.body.setVelocity(0, 0);
          this.faceToward(p.x, p.y - 4);
          this.setState("dwindup");
          break;
        }
        this.moveToward(target.x, target.y, cfg.chase);
        this.walkAnim(true, true);
        if (!this.hostile && this.touching(2)) this.scene.onGuardCatch(this);
        break;
      }
      case "windup":
        this.body.setVelocity(0, 0);
        this.swingPose("windup");
        this.flash = this.stateTime % 160 < 60 ? 40 : 0;
        this.windupMs ??= jit(cfg.windup);
        if (this.stateTime > this.windupMs) {
          this.windupMs = null;
          this.setState("lunge");
          this.lunge(150, cfg.damage, { steal: false });
        }
        break;
      case "dwindup":
        // Aviso corto (se agacha tras el escudo) y embiste en línea recta hacia ti.
        this.body.setVelocity(0, 0);
        this.faceToward(p.x, p.y - 4);
        this.crouchPose();
        this.flash = this.stateTime % 120 < 50 ? 40 : 0;
        this.windupMs ??= jit(cfg.dash.windup);
        if (this.stateTime > this.windupMs) {
          this.windupMs = null;
          this.dashCd = cfg.dash.cooldown;
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.setState("dash");
          this.lunge(cfg.dash.speed, cfg.damage, { steal: false });
          this.body.setVelocity((dx / len) * cfg.dash.speed, (dy / len) * cfg.dash.speed);
          sfx(this.scene, "armor", { volume: 0.3 });
        }
        break;
      case "dash":
        this.walkAnim(true, true);
        if (Math.floor(this.stateTime / 70) !== Math.floor((this.stateTime - dt) / 70)) this.scene.fx.dust(this.x, this.y, 0.7);
        this.checkLungeHit();
        if (this.stateTime > cfg.dash.time) { this.body.setVelocity(0, 0); this.setState("recover"); }
        break;
      case "lunge":
        this.swingPose("strike");
        this.checkLungeHit();
        if (this.stateTime > 180) { this.body.setVelocity(0, 0); this.setState("recover"); }
        break;
      case "recover":
        // La ventana para pegarle de frente: baja el escudo un momento.
        this.body.setVelocity(0, 0);
        this.walkAnim(false);
        this.recoverMs ??= jit(cfg.recover);
        if (this.stateTime > this.recoverMs) { this.recoverMs = null; this.setState("chase"); }
        break;
      case "search": {
        // Va a donde te vio por última vez (marcado con "?") y mira alrededor unos 3 s.
        const t = this.lastSeen ?? this.home;
        const arrived = this.moveToward(t.x, t.y, cfg.speed * 1.15) || this.stateTime > 6000;
        if (arrived && this.lookFrom == null) {
          this.lookFrom = this.stateTime;
          this.body.setVelocity(0, 0);
          this.clearMark();
        }
        this.walkAnim(!arrived);
        if (this.lookFrom != null) {
          this.body.setVelocity(0, 0);
          const look = this.stateTime - this.lookFrom;
          this.facing = ["left", "right", "up", "down"][Math.floor(look / 700) % 4];
        }
        if (sees && this.suspicious()) { this.alarm(); break; }
        if (this.lookFrom != null && this.stateTime - this.lookFrom > cfg.searchLook) {
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

  /** Te perdió: marca con "?" dónde te vio y va a revisar. */
  startSearch() {
    this.setState("search");
    this.lookFrom = null;
    this.clearMark();
    const t = this.lastSeen;
    if (!t || !STEALTH.lastSeenMark) return;
    this.mark = this.scene.add.image(Math.round(t.x), Math.round(t.y - 10), "bubble-ask").setOrigin(0.5, 1).setDepth(DEPTH.fx).setAlpha(0.85);
    this.scene.tweens.add({ targets: this.mark, y: this.mark.y - 2, duration: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  clearMark() {
    if (!this.mark) return;
    this.scene.tweens.killTweensOf(this.mark);
    this.mark.destroy();
    this.mark = null;
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
    this.clearMark();
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
        if (d < cfg.sight * Math.max(stealthOf(p), 0.5) && p.state !== "ko" && !this.scene.targetBusy(p)) {
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
        // Si te pierde de vista 3 s (lejos, escondido o tras una roca), se vuelve a enterrar ahí mismo.
        const sees = !p.hidden && p.state !== "ko" && d < cfg.sight * 3 && this.lineOfSight(p.x, p.y - 6);
        this.lostTime = sees ? 0 : (this.lostTime ?? 0) + dt;
        if (this.lostTime > cfg.lose) { this.burrow(); break; }
        if (sees) this.moveToward(p.x, p.y, cfg.speed);
        else this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
        s.setFlipX(p.x < this.x);
        this.walkView();
        if (d < 22 && sees) this.setState("windup");
        break;
      }
      case "windup":
        this.body.setVelocity(0, 0);
        s.anims.stop();
        s.setFrame(2);
        s.setFlipX(p.x < this.x);
        this.flash = this.stateTime % 140 < 50 ? 40 : 0;
        this.windupMs ??= jit(320);
        if (this.stateTime > this.windupMs) {
          this.windupMs = null;
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
        this.recoverMs ??= jit(700);
        if (this.stateTime > this.recoverMs) { this.recoverMs = null; this.lostTime = 0; this.setState("chase"); }
        break;
      case "return": {
        const arrived = this.moveToward(this.home.x, this.home.y, cfg.speed);
        this.walkView();
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

  walkView() {
    const k = this.viewKey("scorpion-walk");
    if (this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k);
  }

  /** Se mete en la arena donde está: queda enterrado otra vez, esperando. */
  burrow() {
    this.body.setVelocity(0, 0);
    this.home = { x: this.x, y: this.y };
    this.lostTime = 0;
    this.scene.fx.dust(this.x, this.y, 0.8);
    this.shadow.setVisible(false);
    this.sprite.anims.stop();
    this.setState("buried");
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

// ---------------------------------------------------------------------------
// Noche: salen más enemigos (solo jugando solo; en línea cada mapa es igual para todos).

const CALM = new Set(["idle", "hidden", "wander", "return", "buried", "patrol", "post", "pause"]);

/** Un lugar libre (no sólido, no agua) cerca de (x, y) en celdas, lejos de otros enemigos. */
function freeSpotNear(scene, x, y, taken) {
  const w = scene.world;
  const ok = (px, py) => {
    for (const [ox, oy] of [[-6, -2], [6, -2], [-6, -8], [6, -8], [0, -4]]) {
      if (w.solidAt(px + ox, py + oy) || w.cellAt(px + ox, py + oy) === "~") return false;
    }
    return taken.every((t) => Math.hypot(t.x - px, t.y - py) > 14);
  };
  for (const r of [1.6, 2.2, 3, 3.8]) {
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < 10; k += 1) {
      const a = a0 + (k / 10) * Math.PI * 2;
      const px = (x + Math.cos(a) * r) * TILE;
      const py = (y + Math.sin(a) * r * 0.8) * TILE;
      if (ok(px, py)) return { x: px / TILE, y: py / TILE };
    }
  }
  return null;
}

/** Qué sale de más de noche en este mapa: un bandido por campamento, uno por emboscada, un lobo en montaña o nieve. */
function planNight(scene) {
  const def = scene.def;
  const list = def.objects.filter((o) => o.type === "enemy");
  const taken = scene.enemies.map((e) => ({ x: e.home.x, y: e.home.y }));
  const plan = [];
  const add = (spec, n) => {
    for (let i = 0; i < n; i += 1) {
      const at = freeSpotNear(scene, spec.x, spec.y, taken);
      if (!at) continue;
      taken.push({ x: at.x * TILE, y: at.y * TILE });
      plan.push({ ...spec, ...at, night: true, lastNight: -1 });
    }
  };
  // Campamentos: bandidos a la vista a menos de 6 celdas uno de otro.
  const camps = [];
  for (const b of list.filter((o) => o.kind === "bandit" && !o.ambush)) {
    const c = camps.find((k) => Math.hypot(k.x - b.x, k.y - b.y) < 6);
    if (!c) camps.push({ x: b.x, y: b.y });
  }
  for (const c of camps) add({ type: "enemy", kind: "bandit", x: c.x, y: c.y }, NIGHT.extraPerCamp);
  for (const b of list.filter((o) => o.kind === "bandit" && o.ambush)) add({ type: "enemy", kind: "bandit", ambush: true, minCargo: b.minCargo, x: b.x, y: b.y }, NIGHT.extraPerAmbush);
  const cold = (o) => ["mountain", "snow"].includes(def.biomeAt ? def.biomeAt(Math.floor(o.x), Math.floor(o.y)) : def.biome);
  const wolf = list.find((o) => o.kind === "wolf" && cold(o));
  if (wolf) add({ type: "enemy", kind: "wolf", x: wolf.x, y: wolf.y }, NIGHT.extraWolves);
  return plan;
}

/**
 * Llamar al crear el mapa (`initial`) y cada segundo. Al caer la noche aparecen los de más (fuera de
 * la pantalla); al amanecer se van los que sigan tranquilos y lejos de la vista.
 * Devuelve cuántos enemigos de noche hay vivos.
 */
export function updateNightSpawns(scene, initial = false) {
  // La escena se reusa entre mapas: lo de la noche anterior se olvida al crear el mapa.
  if (initial) {
    scene.nightPlan = null;
    scene.wasNight = undefined;
    scene._nightAt = null;
  }
  if (online.on || scene.def.kind !== "route" || scene.def.dark) return 0;
  scene.nightPlan ??= planNight(scene);
  const night = isNight(scene.registry);
  if (night && !scene.wasNight) scene.nightCount = (scene.nightCount ?? 0) + 1;
  scene.wasNight = night;
  const view = scene.cameras.main.worldView;
  const p = scene.player;
  const near = (x, y) => Math.hypot(p.x - x, p.y - y) < (initial ? 100 : 150);
  const inSight = (x, y) => near(x, y) || (!initial && x > view.x - 24 && x < view.right + 24 && y > view.y - 24 && y < view.bottom + 40);
  let alive = 0;
  for (const spec of scene.nightPlan) {
    const e = scene.enemies.find((x) => x.spec === spec && !x.dead);
    if (night && !e && spec.lastNight !== scene.nightCount && !inSight(spec.x * TILE, spec.y * TILE)) {
      spec.lastNight = scene.nightCount; // si lo tumbas, no vuelve hasta la noche siguiente
      const n = makeEnemy(scene, spec);
      if (!n) continue;
      n.netId = null;
      n.spawnState = n.state;
      scene.enemies.push(n);
      scene.enemyGroup.add(n.sprite);
      alive += 1;
    } else if (!night && e && CALM.has(e.state) && !inSight(e.x, e.y)) {
      e.dead = true;
      e.destroy();
    } else if (e) alive += 1;
  }
  return alive;
}
