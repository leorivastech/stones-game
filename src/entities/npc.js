/**
 * Gente del pueblo. Los aldeanos (los que traen `wander`) caminan entre 2-3 puntos cerca de su lugar,
 * se paran unos segundos y miran alrededor; de noche la mitad se mete a su casa y vuelve de día.
 * El herrero martilla en el yunque; el comerciante acomoda su puesto de vez en cuando.
 * Si te acercas (<28 px) o les hablas, se detienen y te miran.
 */

import { SHEET_INDEX } from "../art/actors.js";
import { DEPTH, TILE } from "../config.js";
import { isNight } from "../engine/daylight.js";
import { hash } from "../art/pixel.js";
import { getVolume } from "../sfx.js";
import { viewOf } from "./player.js";

const SPEED = 28;
const NEAR = 28;
const HAMMER_MS = 1200; // un martillazo por ciclo de la animación `work`

function dirTo(dx, dy) {
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
}

/** Tintineo suave del martillo en el yunque (WebAudio, por el bus de efectos). */
function clink(scene, volume) {
  const ctx = scene.sound.context;
  const bus = getVolume("sfx");
  if (!ctx || scene.sound.locked || bus <= 0 || volume <= 0) return;
  const now = ctx.currentTime;
  for (const [f, v, dur] of [[1568, 1, 0.22], [2350, 0.45, 0.16], [3920, 0.2, 0.08]]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f * (0.98 + Math.random() * 0.04), now);
    gain.gain.setValueAtTime(0.05 * v * volume * bus, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(scene.sound.masterVolumeNode ?? ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
}

export class Npc {
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec;
    this.cast = spec.cast;
    this.home = { x: spec.x * TILE, y: spec.y * TILE };
    this.facing = spec.dir ?? "down";
    this.baseFacing = this.facing;
    this.sprite = scene.physics.add.sprite(this.home.x, this.home.y, `cast-${spec.cast}`, SHEET_INDEX[viewOf(this.facing)]).setOrigin(0.5, 1);
    this.sprite.body.setSize(10, 6).setOffset(3, 17);
    this.sprite.body.setImmovable(true);
    this.shadow = scene.add.image(this.home.x, this.home.y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.target = null;
    this.wait = 800 + Math.random() * 2000;
    this.talking = false;
    this.seed = [...(spec.name ?? "x")].reduce((a, c) => a + c.charCodeAt(0), 0);
    // La mitad de los aldeanos se va a dormir (siempre los mismos: sale del nombre).
    const walkers = (scene.def?.objects ?? []).filter((o) => o.type === "npc" && o.wander);
    this.sleeper = Boolean(spec.wander) && walkers.indexOf(spec) % 2 === 0;
    this.away = false;
    this.points = spec.wander ? this.pickPoints() : [];
    this.pointIdx = 0;
    this.lookTimer = 0;
    this.chore = 4000 + Math.random() * 5000;
    this.setupWork();
    this.pose();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  // ------------------------------------------------------------ lugares

  /** 2-3 puntos a 24-48 px de su lugar, en piso libre. */
  pickPoints() {
    const w = this.scene.world;
    const pts = [{ ...this.home }];
    const n = 2 + (this.seed % 2);
    for (let tries = 0; pts.length < n + 1 && tries < 40; tries += 1) {
      const a = hash(this.seed, tries, 5) * Math.PI * 2;
      const r = 24 + hash(this.seed, tries, 7) * 24;
      const x = this.home.x + Math.cos(a) * r;
      const y = this.home.y + Math.sin(a) * r * 0.7;
      if (this.freeAt(x, y) && this.clearPath(this.home, { x, y })) pts.push({ x, y });
      void w;
    }
    return pts;
  }

  freeAt(x, y) {
    const w = this.scene.world;
    if (!w || x < 8 || y < 8 || x > w.W - 8 || y > w.H - 4) return false;
    return !w.solidAt(x - 5, y - 3) && !w.solidAt(x + 5, y - 3) && !w.solidAt(x, y - 1);
  }

  clearPath(a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (!this.freeAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }

  /** La puerta de casa más cercana (de noche se mete ahí). */
  nearestDoor() {
    let best = null;
    let bd = Infinity;
    for (const o of this.scene.def?.objects ?? []) {
      if (o.type !== "house") continue;
      const door = this.scene.registry.get(`meta-${o.art}`)?.door;
      if (!door) continue;
      const p = { x: o.x * TILE + door.x, y: o.y * TILE + door.y + 3 };
      const d = Math.hypot(p.x - this.home.x, p.y - this.home.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ------------------------------------------------------------ oficios

  /** Herrero: se pone junto al yunque y martilla. Comerciante: acomoda su puesto de vez en cuando. */
  setupWork() {
    const role = this.spec.role;
    if (role === "smith") {
      const anvil = (this.scene.def?.objects ?? []).find((o) => o.type === "prop" && o.art === "anvil"
        && Math.hypot(o.x * TILE - this.home.x, o.y * TILE - this.home.y) < 64);
      if (!anvil) return;
      const ax = anvil.x * TILE;
      const ay = anvil.y * TILE;
      // El yunque mide 16×12: el herrero se para a su lado, mirándolo.
      const right = this.home.x >= ax + 8;
      this.work = {
        x: right ? ax + 22 : ax - 6,
        y: ay + 11,
        facing: right ? "left" : "right",
        spark: { x: right ? ax + 11 : ax + 5, y: ay + 3 },
        timer: 900,
      };
      this.sprite.setPosition(this.work.x, this.work.y);
      this.sprite.body.reset(this.work.x, this.work.y);
      this.facing = this.work.facing;
    }
  }

  onScreen() {
    const v = this.scene.cameras.main.worldView;
    return this.x > v.x - 8 && this.x < v.right + 8 && this.y > v.y - 8 && this.y < v.bottom + 24;
  }

  updateWork(dt) {
    const w = this.work;
    this.sprite.body.setVelocity(0, 0);
    this.facing = w.facing;
    const key = `${this.cast}-work-side`;
    this.sprite.setFlipX(this.facing === "left");
    if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) {
      this.sprite.play(key);
      w.timer = 900; // el golpe cae al final del ciclo (idle 420 + preparar 480)
    }
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer += HAMMER_MS;
      this.scene.fx?.spark(w.spark.x, w.spark.y);
      if (this.onScreen()) {
        const p = this.scene.player;
        const d = p ? Math.hypot(p.x - this.x, p.y - this.y) : 200;
        clink(this.scene, Math.max(0.25, 1 - d / 260));
      }
    }
  }

  // ------------------------------------------------------------ poses

  pose(moving = false) {
    const view = viewOf(this.facing);
    this.sprite.setFlipX(this.facing === "left");
    if (moving) {
      const key = `${this.cast}-walk-${view}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
    } else {
      // Quieto pero vivo: respira.
      this.sprite.play(`${this.cast}-idle-${view}`, true);
    }
  }

  lookAt(x, y) {
    this.facing = dirTo(x - this.x, y - this.y);
    this.pose(false);
  }

  /** Durante un diálogo o menú: quieto (sin caminar en su lugar). */
  freeze() {
    this.sprite.body.setVelocity(0, 0);
    if (!this.work && this.sprite.anims.currentAnim?.key?.includes("-walk-")) this.pose(false);
  }

  // ------------------------------------------------------------ noche

  /** De noche la mitad se va a su casa (se desvanece en la puerta); de día vuelven. */
  updateNight(dt) {
    const night = !this.scene.def?.dark && isNight(this.scene.registry);
    if (night && !this.away && !this.leaving) {
      this.leaving = this.nearestDoor() ?? { ...this.home };
      this.leaveTime = 0;
      this.target = null;
    }
    if (!night && this.away) this.comeBack();
    if (!this.leaving) return false;
    const body = this.sprite.body;
    this.leaveTime += dt;
    const dx = this.leaving.x - this.x;
    const dy = this.leaving.y - this.y;
    const len = Math.hypot(dx, dy);
    const stuck = this.leaveTime > 9000 || (this.leaveTime > 400 && (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down));
    if (len < 4 || stuck) {
      body.setVelocity(0, 0);
      this.goInside();
      return true;
    }
    body.setVelocity((dx / len) * SPEED * 1.2, (dy / len) * SPEED * 1.2);
    this.facing = dirTo(dx, dy);
    this.pose(true);
    return true;
  }

  goInside() {
    this.leaving = null;
    this.away = true;
    this.sprite.body.enable = false;
    if (this.it) this.it.hidden = true;
    this.pose(false);
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, duration: 500, onComplete: () => this.sprite.setVisible(false) });
  }

  comeBack() {
    this.away = false;
    const door = this.nearestDoor() ?? this.home;
    this.sprite.setPosition(door.x, door.y).setVisible(true).setAlpha(0);
    this.shadow.setAlpha(0);
    this.sprite.body.enable = true;
    this.sprite.body.reset(door.x, door.y);
    if (this.it) this.it.hidden = false;
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 1, duration: 500 });
    this.target = { ...this.home };
    this.walkTime = -6000; // camino largo de vuelta
  }

  // ------------------------------------------------------------ bucle

  update(dt) {
    const body = this.sprite.body;
    this.shadow.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y);
    if (this.away && !(this.sleeper && !isNight(this.scene.registry))) return;
    if (this.scene.modal) { this.freeze(); return; }
    if (this.talking) { body.setVelocity(0, 0); return; }
    // El jugador cerca: se detiene y lo mira.
    const p = this.scene.player;
    if (p && !this.away && !this.leaving && Math.hypot(p.x - this.x, p.y - this.y) < NEAR && p.state !== "ko") {
      body.setVelocity(0, 0);
      const f = dirTo(p.x - this.x, p.y - this.y);
      if (f !== this.facing || this.sprite.anims.currentAnim?.key?.includes("-walk-") || this.sprite.anims.currentAnim?.key?.includes("-work-")) this.lookAt(p.x, p.y);
      this.near = true;
      return;
    }
    if (this.near) {
      this.near = false;
      this.wait = Math.max(this.wait, 700);
      if (!this.spec.wander) { this.facing = this.work?.facing ?? this.baseFacing; this.pose(false); }
    }
    if (this.sleeper && this.updateNight(dt)) return;
    if (this.away) return;
    if (this.work) { this.updateWork(dt); return; }
    if (!this.spec.wander) {
      body.setVelocity(0, 0);
      if (this.spec.role === "market") this.updateChore(dt);
      return;
    }
    this.updateWander(dt);
  }

  /** El comerciante: cada tanto se voltea y acomoda la mercancía (estira las manos dos veces). */
  updateChore(dt) {
    const s = this.sprite;
    if (this.choreLeft > 0) {
      this.choreLeft -= dt;
      if (this.choreLeft <= 0) {
        this.facing = this.baseFacing;
        this.pose(false);
      }
      return;
    }
    this.chore -= dt;
    if (this.chore > 0) return;
    this.chore = 7000 + Math.random() * 6000;
    this.facing = Math.random() < 0.5 ? "left" : "right";
    s.setFlipX(this.facing === "left");
    s.play(`${this.cast}-reach-side`);
    this.choreLeft = 1300;
  }

  updateWander(dt) {
    const body = this.sprite.body;
    if (!this.target) {
      body.setVelocity(0, 0);
      this.wait -= dt;
      // Mira alrededor mientras espera.
      this.lookTimer -= dt;
      if (this.lookTimer <= 0) {
        this.lookTimer = 900 + Math.random() * 1200;
        const dirs = ["left", "right", "down", "up"].filter((d) => d !== this.facing);
        this.facing = dirs[Math.floor(Math.random() * (Math.random() < 0.7 ? 2 : 3))];
      }
      this.pose(false);
      if (this.wait <= 0 && this.points.length > 1) {
        this.pointIdx = (this.pointIdx + 1) % this.points.length;
        this.target = this.points[this.pointIdx];
        this.walkTime = 0;
      } else if (this.wait <= 0) this.wait = 2000;
      return;
    }
    this.walkTime += dt;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const len = Math.hypot(dx, dy);
    const blocked = this.walkTime > 300 && (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down);
    // Otro aldeano justo enfrente: espera en vez de chocar.
    const ahead = { x: this.x + (dx / (len || 1)) * 10, y: this.y + (dy / (len || 1)) * 10 };
    const crowd = this.scene.npcs?.some((n) => n !== this && !n.away && Math.hypot(n.x - ahead.x, n.y - ahead.y) < 10);
    if (len < 3 || this.walkTime > 5000 || blocked || crowd) {
      this.target = null;
      this.wait = 2000 + Math.random() * 3000;
      this.lookTimer = 700 + Math.random() * 800;
      body.setVelocity(0, 0);
      this.pose(false);
      return;
    }
    body.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
    this.facing = dirTo(dx, dy);
    this.pose(true);
  }
}
