/**
 * El mundo: un mapa a la vez (pueblo o ruta). Aquí se juntan jugador, enemigos, gente,
 * objetos y reglas del contrabando. La interfaz vive aparte, en la escena "ui".
 */

import Phaser from "phaser";
import { MAPS } from "../maps/index.js";
import { buildMap, BUSH } from "../engine/mapbuild.js";
import { Controls } from "../engine/input.js";
import { Fx } from "../engine/fx.js";
import { Player, DIRS } from "../entities/player.js";
import { Npc } from "../entities/npc.js";
import { makeEnemy, Guard } from "../entities/enemies.js";
import { Escort } from "../entities/escort.js";
import { DEPTH, TILE } from "../config.js";
import { startMusic } from "../music.js";
import { sfx, tone, duckTheme, restoreTheme } from "../sfx.js";
import {
  GOODS, TOWNS, UPGRADES, addHeartContainer, addHeat, advanceMarket, ambushProtection, cargo, flag, gold, hasUpgrade,
  heal, heatLevel, hp, hurt, localHeat, loseStones, maxHp, pay, purchaseUpgrade, reputation, saveGame, setFlag,
  stones, visibleStones, capacity, stashCount, emptyStash, STASH_RAID_HEAT, buyTonic, drinkTonic, tonics, TONIC,
  BOAT_FARE,
} from "../state.js";

const INTRO = [
  "Las piedras de hechizo calientan casas, guardan el agua y salvan la cosecha.",
  "La Corona y su Gremio las venden caras, pocas y tarde.",
  "Por eso los pueblos le compran a quien se atreva a llevarlas por la calzada.",
  "Tienes 40 de oro, un bastón y una mochila con cuatro lugares.",
  "Brena vende ámbar en la plaza. En Valkeep, al norte, lo pagan bien.",
];

export class WorldScene extends Phaser.Scene {
  constructor() {
    super("world");
  }

  init(data) {
    this.mapId = data?.map ?? this.registry.get("mapId") ?? "ashfen";
    this.entryKey = data?.entry ?? "start";
    this.modal = false;
    this.passCleared = false;
    this.leaving = false;
    this.intro = Boolean(data?.intro);
    // La escena se reutiliza entre mapas: nada del mapa anterior debe sobrevivir.
    this.horse = null;
    this.horseShadow = null;
    this.trail = [];
    this.barrier = null;
    this.gates = {};
  }

  create() {
    const reg = this.registry;
    this.def = MAPS[this.mapId];
    const def = this.def;
    reg.set("mapId", this.mapId);
    this.ui = this.scene.get("ui");
    this.fx = new Fx(this);
    this.controls = new Controls(this);

    // Llegar a un pueblo distinto cierra un viaje: los mercados se mueven.
    let arrivedFrom = null;
    if (def.kind === "town") {
      const prev = reg.get("currentTown");
      if (prev && prev !== def.town) {
        advanceMarket(reg, prev, def.town);
        arrivedFrom = prev;
      }
      reg.set("currentTown", def.town);
      heal(reg);
      saveGame(reg);
    }

    this.world = buildMap(this, def);
    this.physics.world.setBounds(0, 0, this.world.W, this.world.H);

    const entry = def.entries[this.entryKey] ?? def.entries.start ?? Object.values(def.entries)[0];
    this.player = new Player(this, entry.x * TILE, entry.y * TILE, entry.dir);
    this.physics.add.collider(this.player.sprite, this.world.layer);
    this.physics.add.collider(this.player.sprite, this.world.statics);

    this.enemies = [];
    this.npcs = [];
    this.interactables = [];
    this.pickups = [];
    this.enemyGroup = this.physics.add.group();
    this.npcGroup = this.physics.add.group({ immovable: true });
    this.spawnObjects();
    this.physics.add.collider(this.enemyGroup, this.world.layer);
    this.physics.add.collider(this.enemyGroup, this.world.statics);
    this.physics.add.collider(this.npcGroup, this.world.layer);
    this.physics.add.collider(this.npcGroup, this.world.statics);
    this.physics.add.collider(this.player.sprite, this.npcGroup);

    if (def.kind === "route" && hasUpgrade(reg, "horse")) this.addHorse();
    this.escort = def.kind === "route" && hasUpgrade(reg, "escort") ? new Escort(this, this.player.x, this.player.y + 10) : null;
    if (def.kind === "route") this.time.delayedCall(1200, () => this.checkRaids());
    this.speedBonus = def.kind === "route" && hasUpgrade(reg, "horse") ? 1.1 : 1;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.W, this.world.H);
    cam.startFollow(this.player.sprite, true, 0.16, 0.16, 0, 12);
    cam.setRoundPixels(true);
    cam.fadeIn(260, 18, 14, 23);

    startMusic(this, def.music);
    this.ui.enterMap(def);
    if (arrivedFrom) {
      this.time.delayedCall(900, () => this.ui.toast(`Viaje cerrado · los mercados se movieron`, "font-gold"));
    }

    this.debugOn = false;
    this.events.once("shutdown", () => this.ui.prompt(null));
    if (this.intro) this.time.delayedCall(900, () => this.runModal(() => this.ui.say(INTRO)));
    if (def.kind === "route" && !flag(reg, "hint-route")) {
      setFlag(reg, "hint-route");
      this.time.delayedCall(2600, () => this.ui.toast("J golpear · K rodar (mantén: correr) · L agacharse", "font-o"));
      this.time.delayedCall(5400, () => this.ui.toast("En el pasto alto, agachado, nadie te ve", "font-green"));
    }
  }

  // ---------------------------------------------------------------- objetos

  spawnObjects() {
    const reg = this.registry;
    const heatNow = localHeat(reg, this.def);
    for (const spec of this.def.objects) {
      const px = spec.x * TILE;
      const py = spec.y * TILE;
      switch (spec.type) {
        case "npc": {
          if (spec.onlyIf && !flag(reg, spec.onlyIf)) break;
          const npc = new Npc(this, spec);
          this.npcs.push(npc);
          this.npcGroup.add(npc.sprite);
          npc.sprite.body.setImmovable(true);
          this.interactables.push({ get x() { return npc.x; }, get y() { return npc.y; }, r: 18, label: spec.role === "market" ? "Comerciar" : "Hablar", act: () => this.talkTo(npc) });
          break;
        }
        case "stash": {
          const built = hasUpgrade(reg, "stashKit") && flag(reg, `stash-${spec.id}`);
          const img = this.add.sprite(px, py + 3, `stash-${spec.kind}`, built ? 1 : 0).setOrigin(0.5, 1).setDepth(py + 3);
          this.world.addSolid(px - 9, py - 6, 18, 8);
          const it = { x: px, y: py, r: 20, label: "Alijo", act: () => this.useStash(spec, img) };
          this.interactables.push(it);
          (this.stashes ??= []).push({ spec, img });
          break;
        }
        case "sign": {
          this.add.image(px, py + 2, "sign").setOrigin(0.5, 1).setDepth(py + 2);
          this.world.addSolid(px - 6, py - 4, 12, 6);
          this.interactables.push({ x: px, y: py, r: 18, label: "Leer", act: () => this.ui.say(spec.text) });
          break;
        }
        case "chest": {
          const opened = flag(reg, `chest-${spec.id}`);
          const img = this.add.sprite(px, py + 2, "chest", opened ? 1 : 0).setOrigin(0.5, 1).setDepth(py + 2);
          this.world.addSolid(px - 7, py - 7, 14, 8);
          const it = { x: px, y: py, r: 18, label: "Abrir", hidden: opened, act: () => this.openChest(spec, img, it) };
          this.interactables.push(it);
          break;
        }
        case "gate": {
          const open = flag(reg, spec.id);
          const img = this.add.sprite(px, py, "gate", open ? 1 : 0).setOrigin(0, 0).setDepth(py + 22);
          this.world.addSolid(px, py + 8, 8, 16);
          this.world.addSolid(px + 40, py + 8, 8, 16);
          const bar = this.world.addSolid(px + 8, py + 8, 32, 16);
          if (open) bar.body.enable = false;
          this.gates = { ...(this.gates ?? {}), [spec.id]: { img, bar, x: px + 24, y: py + 12 } };
          break;
        }
        case "lever": {
          const on = flag(reg, spec.id);
          const img = this.add.sprite(px, py + 2, "lever", on ? 1 : 0).setOrigin(0.5, 1).setDepth(py + 2);
          this.world.addSolid(px - 5, py - 4, 10, 5);
          const it = { x: px, y: py, r: 18, label: "Tirar", hidden: on, act: () => this.pullLever(spec, img, it) };
          this.interactables.push(it);
          break;
        }
        case "barrier": {
          const img = this.add.sprite(px, py, "barrier", 0).setOrigin(0, 0).setDepth(py + 20);
          const solid = this.world.addSolid(px - 8, py + 8, 80, 12);
          this.barrier = { id: spec.id, img, solid, raised: false, cx: px + 32, cy: py + 14, cooldown: 0 };
          break;
        }
        case "well": {
          this.interactables.push({ x: px + 14, y: py + 28, r: 20, label: "Beber", act: () => this.drink() });
          break;
        }
        case "enemy": {
          if ((spec.minHeat ?? 0) > heatNow) break;
          const e = makeEnemy(this, spec);
          if (!e) break;
          this.enemies.push(e);
          this.enemyGroup.add(e.sprite);
          break;
        }
        default:
          break;
      }
    }
  }

  addHorse() {
    this.trail = [];
    this.horse = this.add.sprite(this.player.x - 20, this.player.y, "horse", 0).setOrigin(0.5, 1);
    this.horseShadow = this.add.image(this.horse.x, this.horse.y, "shadow-big").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
  }

  updateHorse() {
    if (!this.horse) return;
    const p = this.player;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 16) {
      const t = this.trail.shift();
      const dx = t.x - this.horse.x;
      this.horse.setPosition(t.x, t.y);
      if (Math.abs(dx) > 0.2) this.horse.setFlipX(dx < 0);
      if (this.horse.anims.currentAnim?.key !== "horse-walk") this.horse.play("horse-walk");
    } else this.horse.anims.stop();
    this.horse.setDepth(this.horse.y - 1);
    this.horseShadow.setPosition(this.horse.x, this.horse.y);
  }

  // ---------------------------------------------------------------- bucle

  update(time, delta) {
    const dt = Math.min(delta, 50);
    this.controls.update();
    if (this.controls.pressed("debug")) this.toggleDebug();
    if (this.debugOn) this.debugKeys();

    if (this.modal || this.leaving) {
      this.player.body.setVelocity(0, 0);
      for (const e of this.enemies) if (!e.dead) e.body?.setVelocity(0, 0);
      for (const n of this.npcs) n.sprite.body.setVelocity(0, 0);
      this.ui.prompt(null);
      return;
    }
    if (this.controls.pressed("pause")) {
      this.openPause();
      return;
    }

    if (this.controls.pressed("tonic")) this.useTonic();
    this.player.update(dt, this.controls, this.world);
    this.escort?.update(dt);
    for (const e of this.enemies) if (!e.dead) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.state === "down" || e.sprite.active);
    for (const n of this.npcs) n.update(dt);
    this.updatePickups(dt);
    this.updateHorse();
    this.updateBarrier(dt);
    this.updateInteract();
    this.checkExits();
  }

  // ---------------------------------------------------------------- interacción

  updateInteract() {
    const p = this.player;
    if (p.state !== "move") {
      this.ui.prompt(null);
      return;
    }
    const d = DIRS[p.facing];
    const rx = p.x + d.x * 10;
    const ry = p.y - 4 + d.y * 10;
    let best = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (it.hidden) continue;
      const dist = Math.hypot(it.x - rx, it.y - ry);
      if (dist < it.r && dist < bestD) {
        best = it;
        bestD = dist;
      }
    }
    this.ui.prompt(best ? best.label : null);
    if (best && this.controls.pressed("interact")) this.runModal(() => best.act());
  }

  async runModal(fn) {
    if (this.modal) return;
    this.modal = true;
    this.player.freeze();
    this.ui.prompt(null);
    try {
      await fn();
    } finally {
      this.modal = false;
      this.player.unfreeze();
      this.controls.lock(3);
    }
  }

  async talkTo(npc) {
    npc.talking = true;
    npc.lookAt(this.player.x, this.player.y);
    const reg = this.registry;
    const name = npc.spec.name;
    try {
      switch (npc.spec.role) {
        case "market":
          await this.ui.shop(this.def.town, name, npc.spec.talk);
          break;
        case "smith":
          await this.smithTalk(npc);
          break;
        case "healer":
          await this.healerTalk(npc);
          break;
        case "escort":
          await this.upgradeTalk(npc, "escort", ["No escolto a cualquiera por el desierto.", "Cuando la gente hable de ti, búscame."], "Te he visto llegar. Por el camino, yo cuido tu espalda con el arco: bandidos, bestias, lo que salga.");
          break;
        case "ferry":
          await this.ferryTalk(npc);
          break;
        case "stable":
          await this.upgradeTalk(npc, "horse", ["Mis caballos no cargan para cualquiera.", "Hazte un nombre en la calzada y hablamos."], "Tengo una yegua que carga sin quejarse. Más espacio y más paso en la ruta.");
          break;
        case "townguard": {
          const h = localHeat(reg, this.def);
          const extra = h >= 45 ? "Y tú… te estamos mirando." : h >= 20 ? "Se habla de contrabando por aquí." : "Tranquilo el día.";
          await this.ui.say([...npc.spec.talk, extra], { name });
          break;
        }
        default:
          await this.ui.say(npc.spec.talk, { name });
      }
    } finally {
      npc.talking = false;
    }
  }

  async upgradeTalk(npc, id, lockedLines, pitch) {
    const reg = this.registry;
    const item = UPGRADES[id];
    const name = npc.spec.name;
    if (hasUpgrade(reg, id)) {
      await this.ui.say([id === "horse" ? "¿Cómo va la yegua? Cuídala." : "El fondo falso aguanta. No lo presumas."], { name });
      return;
    }
    if (reputation(reg) < item.reputation) {
      await this.ui.say([...lockedLines, `(Necesitas fama ${item.reputation}. Tienes ${reputation(reg)}.)`], { name });
      return;
    }
    await this.ui.say([pitch], { name });
    const pick = await this.ui.choose(`${item.name} · ${item.cost} oro`, [
      { label: `Comprar (${item.cost} oro)`, disabled: gold(reg) < item.cost },
      { label: "Ahora no" },
    ], { note: item.effect });
    if (pick === 0) {
      const res = purchaseUpgrade(reg, id);
      tone(this, res.ok ? "chest" : "deny");
      if (res.ok) sfx(this, "coins");
      await this.ui.say([res.reason], { name });
      saveGame(reg);
    }
  }

  async openChest(spec, img, it) {
    const reg = this.registry;
    img.setFrame(1);
    it.hidden = true;
    setFlag(reg, `chest-${spec.id}`);
    tone(this, "chest");
    sfx(this, "latch", { volume: 0.4 });
    const lines = [];
    if (spec.loot.gold) {
      reg.inc("gold", spec.loot.gold);
      lines.push(`Adentro hay ${spec.loot.gold} monedas de oro.`);
      sfx(this, "coins");
    }
    if (spec.loot.heart) {
      addHeartContainer(reg);
      lines.push("¡Un corazón de piedra! Tu vida máxima sube un corazón.");
      tone(this, "heart");
    }
    const icon = this.add.image(img.x, img.y - 16, spec.loot.heart ? "heart-full" : "coin").setDepth(DEPTH.fx);
    this.tweens.add({ targets: icon, y: icon.y - 10, duration: 400, ease: "Quad.Out" });
    await this.ui.say(lines);
    icon.destroy();
    saveGame(reg);
  }

  async pullLever(spec, img, it) {
    img.setFrame(1);
    it.hidden = true;
    setFlag(this.registry, spec.id);
    sfx(this, "latch");
    const gate = this.gates?.[spec.id];
    if (gate) {
      const cam = this.cameras.main;
      cam.stopFollow();
      await new Promise((r) => { cam.pan(gate.x, gate.y, 450, "Sine.easeInOut", false, (c, p) => { if (p === 1) r(); }); });
      gate.img.setFrame(1);
      gate.bar.body.enable = false;
      this.fx.poof(gate.x, gate.y + 8);
      tone(this, "chest");
      await new Promise((r) => this.time.delayedCall(600, r));
      await new Promise((r) => { cam.pan(this.player.x, this.player.y, 400, "Sine.easeInOut", false, (c, p) => { if (p === 1) r(); }); });
      cam.startFollow(this.player.sprite, true, 0.16, 0.16, 0, 12);
      await this.ui.say(["La reja crujió y quedó abierta.", "La próxima vez, el camino corto está libre."]);
      saveGame(this.registry);
    }
  }

  async drink() {
    heal(this.registry);
    tone(this, "heart");
    await this.ui.say(["Agua fría del pozo. Recuperas toda la vida."]);
  }

  // ---------------------------------------------------------------- combate

  /** El bastón toca lo que esté en el rectángulo: enemigos, pasto alto, arbustos. */
  resolvePlayerHit(rect) {
    const p = this.player;
    if (p.state !== "attack") return;
    const c = p.center();
    for (const e of this.enemies) {
      if (e.dead || !e.body?.enable || p.hitThisSwing.has(e)) continue;
      const b = e.body;
      const r2 = new Phaser.Geom.Rectangle(b.x - 3, b.y - 12, b.width + 6, b.height + 14);
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, r2)) {
        p.hitThisSwing.add(e);
        e.hit(1, c.x, c.y);
        this.cameras.main.shake(50, 0.003);
      }
    }
    const x0 = Math.floor(rect.x / TILE);
    const x1 = Math.floor((rect.right - 1) / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const y1 = Math.floor((rect.bottom - 1) / TILE);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const key = `${x},${y}`;
        const g = this.world.tallGrass.get(key);
        if (g && !g.cut) {
          g.cut = true;
          g.img.anims.stop();
          g.img.setTexture("cutgrass").setOrigin(0, 1);
          this.fx.grassBurst(x * TILE + 8, (y + 1) * TILE);
          tone(this, "cut");
          this.maybeDrop(x * TILE + 8, y * TILE + 10, 0.12);
        }
        const bush = this.world.bushes.get(key);
        if (bush && !bush.cut) {
          bush.cut = true;
          bush.img.destroy();
          this.world.layer.removeTileAt(x, y);
          this.fx.grassBurst(x * TILE + 8, (y + 1) * TILE, true);
          sfx(this, "chop", { volume: 0.35 });
          this.maybeDrop(x * TILE + 8, y * TILE + 10, 0.3);
        }
      }
    }
  }

  damagePlayer(halves, source, { steal = false } = {}) {
    const reg = this.registry;
    const s = source.center ? source.center() : source;
    if (!this.player.hurt(halves, s.x, s.y)) return;
    hurt(reg, halves);
    if (steal && stones(reg) > 0) {
      const keep = 0.35 * ambushProtection(reg);
      if (Math.random() >= keep) this.dropStone(s);
      else this.ui.toast("La carga aguantó el golpe", "font-green");
    }
    if (hp(reg) <= 0) this.knockOut(source);
  }

  dropStone(from) {
    const reg = this.registry;
    const c = cargo(reg);
    const goods = Object.keys(c).filter((g) => c[g] > 0);
    if (!goods.length) return;
    const good = goods[Math.floor(Math.random() * goods.length)];
    reg.set("cargo", { ...c, [good]: c[good] - 1 });
    const dx = this.player.x - from.x;
    const dy = this.player.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    this.spawnPickup("stone", this.player.x, this.player.y - 6, { good, dx: (dx / len) * 26, dy: (dy / len) * 18 });
    this.ui.toast(`¡Se te cayó 1 ${GOODS[good].short}!`, "font-red");
    sfx(this, "sack", { volume: 0.5 });
  }

  maybeDrop(x, y, chance) {
    if (Math.random() > chance) return;
    const reg = this.registry;
    if (hp(reg) < maxHp(reg) && Math.random() < 0.5) this.spawnPickup("heart", x, y);
    else this.spawnPickup("coin", x, y, { value: 1 });
  }

  spawnPickup(kind, x, y, { good, value = 1, dx, dy } = {}) {
    const key = kind === "stone" ? `gem-${good}` : kind === "heart" ? "heart-full" : "coin";
    const img = kind === "coin" ? this.add.sprite(x, y, "coin", 0).play("coin") : this.add.image(x, y, key);
    img.setOrigin(0.5, 1).setDepth(y);
    const shadow = this.add.image(x, y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1).setScale(0.6);
    const tx = x + (dx ?? (Math.random() - 0.5) * 20);
    const ty = y + (dy ?? (Math.random() - 0.5) * 12);
    const p = { kind, good, value, img, shadow, x: tx, y: ty, age: 0, ready: false };
    this.tweens.add({ targets: [img, shadow], x: tx, duration: 380 });
    this.tweens.add({ targets: shadow, y: ty, duration: 380 });
    this.tweens.add({ targets: img, y: ty - 12, duration: 190, ease: "Quad.Out", yoyo: false, onComplete: () => {
      this.tweens.add({ targets: img, y: ty, duration: 190, ease: "Bounce.Out", onComplete: () => { p.ready = true; } });
    } });
    this.pickups.push(p);
    return p;
  }

  updatePickups(dt) {
    const reg = this.registry;
    const pl = this.player;
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.age += dt;
      p.img.setDepth(p.img.y);
      if (p.kind !== "stone" && p.age > 9000) p.img.setVisible(Math.floor(p.age / 90) % 2 === 0);
      if (p.kind !== "stone" && p.age > 12000) { this.removePickup(p); continue; }
      if (!p.ready || pl.state === "ko") continue;
      const d = Math.hypot(p.x - pl.x, p.y - pl.y + 4);
      if (d < 12) {
        if (p.kind === "stone") {
          if (stones(reg) >= capacity(reg)) continue;
          const c = cargo(reg);
          reg.set("cargo", { ...c, [p.good]: (c[p.good] ?? 0) + 1 });
          this.fx.float(p.x, p.y - 12, `+1 ${GOODS[p.good].short}`, "font-gold");
          tone(this, "pickup");
        } else if (p.kind === "heart") {
          heal(reg, 2);
          tone(this, "heart");
        } else {
          reg.inc("gold", p.value);
          this.fx.float(p.x, p.y - 10, `+${p.value}`, "font-gold");
          tone(this, "pickup");
        }
        this.removePickup(p);
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }

  removePickup(p) {
    p.taken = true;
    p.img.destroy();
    p.shadow.destroy();
  }

  nearestLoose(x, y, r) {
    let best = null;
    let bd = r;
    for (const p of this.pickups) {
      if (p.taken || p.kind !== "stone" || !p.ready) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  takeLoose(p) {
    this.removePickup(p);
    return p.good;
  }

  banditEscaped(b) {
    if (b.carrying) this.ui.toast(`Un bandido escapó con 1 ${GOODS[b.carrying].short}`, "font-red");
  }

  onEnemyDefeated(e) {
    const reg = this.registry;
    if (e.spec.kind === "bandit") {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i += 1) this.spawnPickup("coin", e.x, e.y - 4, { value: 2 });
      if (e.carrying) this.spawnPickup("stone", e.x, e.y - 4, { good: e.carrying });
      e.carrying = null;
    } else if (e.spec.kind === "boar") {
      this.maybeDrop(e.x, e.y - 4, 0.7);
    } else if (e.spec.kind === "guard") {
      this.addRouteHeat(20);
      this.ui.toast("Tumbaste a un guardia · el calor se dispara", "font-red");
    }
  }

  onGuardAlarm() {
    this.addRouteHeat(3);
    duckTheme(this, 0.12);
    this.time.delayedCall(2400, () => restoreTheme(this));
  }

  onGuardAttacked() {
    this.addRouteHeat(10);
    this.ui.toast("¡Atacaste a la Corona! Sube el calor", "font-red");
  }

  addRouteHeat(n) {
    const reg = this.registry;
    const towns = this.def.kind === "town" ? [this.def.town] : this.def.between;
    for (const t of towns) addHeat(reg, t, n);
  }

  heatLevel() {
    return heatLevel(localHeat(this.registry, this.def));
  }

  visibleCargo() {
    return this.passCleared ? 0 : visibleStones(this.registry);
  }

  cargoCount() {
    return stones(this.registry);
  }

  // ---------------------------------------------------------------- la Corona

  updateBarrier(dt) {
    const b = this.barrier;
    if (!b) return;
    b.cooldown = Math.max(0, b.cooldown - dt);
    const p = this.player;
    const near = Math.abs(p.x - b.cx) < 44 && Math.abs(p.y - b.cy) < 26;
    if (b.raised) {
      if (!near && Math.abs(p.y - b.cy) > 70) this.setBarrier(false);
      return;
    }
    if (!near || b.cooldown > 0 || p.state !== "move") return;
    b.cooldown = 1200;
    const guard = this.enemies.find((e) => e instanceof Guard && e.spec.barrier === b.id && !e.dead && !e.hostile);
    if (!guard) {
      this.setBarrier(true);
      return;
    }
    if (this.visibleCargo() === 0) {
      guard.showBubble("bubble-talk", 800);
      this.fx.float(guard.x, guard.y - 26, "Pasa.", "font-o");
      this.setBarrier(true);
    } else {
      this.runModal(() => this.inspection(guard, "barrier"));
    }
  }

  setBarrier(raised) {
    const b = this.barrier;
    b.raised = raised;
    b.img.setFrame(raised ? 1 : 0);
    b.solid.body.enable = !raised;
    sfx(this, "latch", { volume: 0.3 });
  }

  onGuardCatch(guard) {
    if (this.modal) return;
    this.runModal(() => this.inspection(guard, "patrol"));
  }

  bribeCost() {
    return 4 + Math.floor(localHeat(this.registry, this.def) / 25) * 2 + visibleStones(this.registry);
  }

  /** Revisión: dejar revisar, sobornar o escapar. */
  async inspection(guard, source) {
    const reg = this.registry;
    guard.body.setVelocity(0, 0);
    guard.faceToward(this.player.x, this.player.y);
    guard.walkAnim(false);
    guard.showBubble("bubble-alert", 700);
    duckTheme(this, 0.1);
    sfx(this, "horn", { volume: 0.3 });
    const vis = visibleStones(reg);
    const hidden = stones(reg) - vis;
    const cost = this.bribeCost();
    await this.ui.say(["¡Alto ahí! Revisión de la Corona.", `Llevas ${vis} ${vis === 1 ? "piedra" : "piedras"} a la vista. Eso se declara.`], { name: "Guardia" });
    const pick = await this.ui.choose("¿Qué haces?", [
      { label: "Dejar que revisen", note: `Confiscan ${vis} · el calor baja` },
      { label: `Sobornar · ${cost} oro`, disabled: gold(reg) < cost, note: gold(reg) < cost ? "No te alcanza" : "Te dejan pasar con todo" },
      { label: source === "barrier" ? "Dar media vuelta" : "Empujar y correr", note: source === "barrier" ? "Buscar otro camino" : "El calor sube mucho" },
    ], { name: "Guardia" });
    restoreTheme(this);
    if (pick === 0) {
      const lost = loseStones(reg, vis, true);
      this.addRouteHeat(-5);
      sfx(this, "sack");
      const lines = [`Confiscan ${lost} ${lost === 1 ? "piedra" : "piedras"}.`];
      if (hidden > 0) lines.push(`El fondo falso aguantó: no encontraron ${hidden}.`);
      lines.push("—Circula.");
      await this.ui.say(lines, { name: "Guardia" });
      this.clearGuard(guard, source);
    } else if (pick === 1) {
      pay(reg, cost);
      this.addRouteHeat(-3);
      sfx(this, "coins");
      await this.ui.say(["El guardia se guarda las monedas sin mirarte.", "—No vi nada. Anda."], { name: "Guardia" });
      this.passCleared = true;
      this.clearGuard(guard, source);
    } else if (source === "barrier") {
      this.player.body.reset(this.player.x, this.barrier.cy + (this.player.y > this.barrier.cy ? 30 : -30));
    } else {
      guard.shove();
      this.addRouteHeat(10);
      this.player.invuln = 900;
      tone(this, "hurt");
      this.ui.toast("¡Corre! El calor sube", "font-red");
    }
  }

  clearGuard(guard, source) {
    guard.suspicion = 0;
    guard.bubble?.destroy();
    guard.bubble = null;
    if (source === "barrier") this.setBarrier(true);
    else guard.setState("return");
    for (const e of this.enemies) if (e instanceof Guard && !e.hostile && e.state === "chase") { e.suspicion = 0; e.setState("return"); }
  }

  // ---------------------------------------------------------------- K.O.

  knockOut() {
    if (this.modal) return;
    this.runModal(async () => {
      const reg = this.registry;
      this.player.knockOut();
      duckTheme(this, 0.05);
      tone(this, "hurt");
      await new Promise((r) => this.time.delayedCall(1100, r));
      const total = stones(reg);
      const lose = Math.max(0, Math.ceil(total / 2) - ambushProtection(reg));
      const lost = loseStones(reg, lose);
      const goldLost = Math.floor(gold(reg) * 0.2);
      if (goldLost) reg.inc("gold", -goldLost);
      const town = reg.get("currentTown") ?? "ashfen";
      this.cameras.main.fadeOut(500, 18, 14, 23);
      await new Promise((r) => this.time.delayedCall(550, r));
      const lines = [`Despiertas en ${TOWNS[town].name}, con la cabeza zumbando.`];
      if (lost) lines.push(`Te faltan ${lost} ${lost === 1 ? "piedra" : "piedras"}.`);
      if (goldLost) lines.push(`Y ${goldLost} de oro.`);
      heal(reg);
      restoreTheme(this);
      await this.ui.say(lines);
      this.leaving = true;
      this.scene.restart({ map: town, entry: "start" });
    });
  }

  // ---------------------------------------------------------------- servicios de los pueblos

  /** El herrero: primero herrajes de alijo, luego fondo falso. */
  async smithTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const kit = UPGRADES.stashKit;
    const hide = UPGRADES.hideout;
    if (reputation(reg) < kit.reputation) {
      await this.ui.say(["No trabajo para desconocidos.", `(Necesitas fama ${kit.reputation}. Tienes ${reputation(reg)}.)`], { name });
      return;
    }
    const options = [];
    if (!hasUpgrade(reg, "stashKit")) options.push({ id: "stashKit", label: `Herrajes de alijo · ${kit.cost} oro`, disabled: gold(reg) < kit.cost, note: "Abren los huecos de los caminos para guardar piedras" });
    if (!hasUpgrade(reg, "hideout")) {
      const locked = reputation(reg) < hide.reputation;
      options.push({ id: "hideout", label: locked ? `Fondo falso (fama ${hide.reputation})` : `Fondo falso · ${hide.cost} oro`, disabled: locked || gold(reg) < hide.cost, note: "Dos piedras que ningún guardia encuentra" });
    }
    if (!options.length) {
      await this.ui.say(["Ya tienes todo lo que sé hacer. Cuídalo."], { name });
      return;
    }
    await this.ui.say(["Tu nombre ya suena en la calzada.", "Te puedo armar herrajes para esconder piedras en el camino. Y, más adelante, un fondo falso."], { name });
    const pick = await this.ui.choose("Oskar, herrero", [...options, { label: "Nada por ahora" }], { name });
    const choice = options[pick];
    if (!choice) return;
    const res = purchaseUpgrade(reg, choice.id);
    tone(this, res.ok ? "chest" : "deny");
    if (res.ok) sfx(this, "coins");
    const extra = choice.id === "stashKit" && res.ok
      ? ["En los caminos hay troncos huecos y rocas partidas. Con esto, cada uno es tu alijo.", "Lo que guardes ahí no te lo roba nadie. Pero si la Corona anda caliente en esa ruta, lo puede encontrar."]
      : [];
    await this.ui.say([res.reason, ...extra], { name });
    saveGame(reg);
  }

  async healerTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    await this.ui.say(npc.spec.talk, { name });
    const pick = await this.ui.choose("Tónico de raíz", [
      { label: `Comprar uno · ${TONIC.cost} oro`, disabled: gold(reg) < TONIC.cost || tonics(reg) >= TONIC.max, note: `Llevas ${tonics(reg)} de ${TONIC.max}. Con Q recuperas 2 corazones.` },
      { label: "Nada" },
    ], { name });
    if (pick !== 0) return;
    const res = buyTonic(reg);
    tone(this, res.ok ? "heart" : "deny");
    if (res.ok) sfx(this, "coins");
    await this.ui.say([res.reason], { name });
    saveGame(reg);
  }

  useTonic() {
    const reg = this.registry;
    if (!tonics(reg)) { this.ui.toast("No llevas tónicos", "font-dim"); return; }
    if (!drinkTonic(reg)) { this.ui.toast("Ya tienes la vida llena", "font-dim"); return; }
    tone(this, "heart");
    this.fx.float(this.player.x, this.player.y - 26, "+2 ♥", "font-green");
  }

  /** Barquero: en Frostholm se le conoce; desde entonces cruza en ambos sentidos. */
  async ferryTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const to = this.def.town === "frostholm" ? "ashfen" : "frostholm";
    if (!flag(reg, "met-ferry")) {
      setFlag(reg, "met-ferry");
      await this.ui.say(["¿Vienes a pie desde Duneshade? Qué valiente.", `Mi barca cruza el golfo hasta ${TOWNS[to].name} en una tarde. Desde hoy también paro en tu muelle.`], { name });
    }
    const pick = await this.ui.choose(`Cruzar el golfo a ${TOWNS[to].name}`, [
      { label: `Subir a la barca · ${BOAT_FARE} oro`, disabled: gold(reg) < BOAT_FARE, note: "Sin retenes ni bandidos. Cuenta como un viaje." },
      { label: "Ahora no" },
    ], { name });
    if (pick !== 0) return;
    pay(reg, BOAT_FARE);
    sfx(this, "coins");
    this.leaving = true;
    this.cameras.main.fadeOut(600, 18, 14, 23);
    await new Promise((r) => this.time.delayedCall(650, r));
    await this.ui.say(["La barca se aparta del muelle. El golfo está en calma.", `Al caer la tarde asoma ${TOWNS[to].name}.`]);
    this.scene.restart({ map: to, entry: "dock" });
  }

  // ---------------------------------------------------------------- alijos

  async useStash(spec, img) {
    const reg = this.registry;
    const key = `stash-${spec.id}`;
    if (!hasUpgrade(reg, "stashKit")) {
      await this.ui.say([spec.kind === "tree" ? "Un tronco hueco, seco por dentro." : "Una grieta honda en la roca.", "Con herrajes, aquí cabría un alijo. El herrero de Ashfen sabe hacerlos."]);
      return;
    }
    if (!flag(reg, key)) {
      setFlag(reg, key);
      img.setFrame(1);
      tone(this, "chest");
      sfx(this, "latch", { volume: 0.4 });
      await this.ui.say(["Clavas la tapa y la atas con soga. Este alijo es tuyo."]);
    }
    await this.ui.stash(spec.id, this.def, localHeat(reg, this.def));
    saveGame(reg);
  }

  /** Redada: con la ruta caliente, la Corona puede encontrar lo guardado. */
  checkRaids() {
    const reg = this.registry;
    if (!this.stashes?.length || this.leaving) return;
    const h = localHeat(reg, this.def);
    if (h < STASH_RAID_HEAT) return;
    for (const { spec } of this.stashes) {
      if (!stashCount(reg, spec.id)) continue;
      if (Math.random() < 0.5) {
        const lost = emptyStash(reg, spec.id);
        this.ui.toast(`Redada: la Corona encontró tu alijo (${lost} piedras)`, "font-red");
        saveGame(reg);
        return;
      }
    }
  }

  // ---------------------------------------------------------------- salidas

  checkExits() {
    const p = this.player;
    const cx = p.x / TILE;
    const cy = (p.y - 2) / TILE;
    for (const ex of this.def.exits ?? []) {
      if (cx >= ex.x - 0.3 && cx <= ex.x + ex.w + 0.3 && cy >= ex.y - 0.3 && cy <= ex.y + ex.h + 0.1) {
        const dir = ex.dir ?? (ex.y === 0 ? "up" : ex.x === 0 ? "left" : ex.x + ex.w >= this.world.cols ? "right" : "down");
        const v = p.body.velocity;
        const moving = { up: v.y < 0, down: v.y > 0, left: v.x < 0, right: v.x > 0 }[dir];
        if (!moving) continue;
        this.leaving = true;
        this.ui.prompt(null);
        this.cameras.main.fadeOut(240, 18, 14, 23);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.restart({ map: ex.to, entry: ex.entry });
        });
        return;
      }
    }
  }

  // ---------------------------------------------------------------- pausa y depuración

  openPause() {
    this.modal = true;
    this.player.freeze();
    this.ui.pause(this.def).then(() => {
      this.modal = false;
      this.player.unfreeze();
      this.controls.lock(3);
    });
  }

  toggleDebug() {
    this.debugOn = !this.debugOn;
    const w = this.physics.world;
    if (this.debugOn) {
      if (!w.debugGraphic) w.createDebugGraphic();
      w.drawDebug = true;
      w.debugGraphic.setVisible(true).setDepth(DEPTH.ui);
      this.ui.toast("Depuración: 1 oro · 2 carga · 3 calor · 4 vida · 5 fama · 6 caballo", "font-blue");
    } else if (w.debugGraphic) {
      w.drawDebug = false;
      w.debugGraphic.clear().setVisible(false);
    }
  }

  debugKeys() {
    const reg = this.registry;
    const kb = this.input.keyboard;
    const k = (n) => Phaser.Input.Keyboard.JustDown(kb.addKey(n));
    if (k("ONE")) reg.inc("gold", 50);
    if (k("TWO")) {
      const good = TOWNS[reg.get("currentTown") ?? "ashfen"].produce;
      reg.set("cargo", { ...cargo(reg), [good]: (cargo(reg)[good] ?? 0) + Math.max(0, capacity(reg) - stones(reg)) });
    }
    if (k("THREE")) this.addRouteHeat(20);
    if (k("FOUR")) heal(reg);
    if (k("FIVE")) reg.inc("reputation", 5);
    if (k("SIX")) reg.set("upgrades", { ...reg.get("upgrades"), horse: true });
    if (k("SEVEN")) reg.set("upgrades", { ...reg.get("upgrades"), escort: true, stashKit: true });
    if (k("EIGHT")) reg.set("tonics", TONIC.max);
  }
}

export { BUSH };
