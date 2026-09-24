/**
 * El mundo: un mapa a la vez (pueblo o ruta). Aquí se juntan jugador, enemigos, gente,
 * objetos y reglas del contrabando. La interfaz vive aparte, en la escena "ui".
 */

import Phaser from "phaser";
import { MAPS } from "../maps/index.js";
import { buildMap, BUSH, biomeOf } from "../engine/mapbuild.js";
import { Controls, keyName } from "../engine/input.js";
import { Fx } from "../engine/fx.js";
import { Player, DIRS } from "../entities/player.js";
import { Npc } from "../entities/npc.js";
import { makeEnemy, Guard } from "../entities/enemies.js";
import { Escort } from "../entities/escort.js";
import { DEPTH, TILE, VIEW_W, VIEW_H } from "../config.js";
import { startMusic, startAmbience } from "../music.js";

// Sonido de los pasos según la letra de la celda (si no está, según el bioma).
const STEP_BY_CELL = { "=": "stone", B: "wood", _: "sand", s: "snow", i: "snow", "#": "stone", g: "stone" };
const STEP_BY_BIOME = { desert: "sand", snow: "snow" };
import { sfx, tone, duckTheme, restoreTheme, footstep } from "../sfx.js";
import {
  GOODS, TOWNS, UPGRADES, STONE, TRAVEL_DAYS, DEBT, AMBER_TAX, addHeartContainer, addHeat, ambushProtection, cargo, cargoOf,
  flag, gold, hasUpgrade, heal, heatLevel, hp, hurt, localHeat, loseStones, maxHp, pay, purchaseUpgrade, reputation,
  saveGame, setFlag, stones, visibleStones, contrabandVisible, confiscateVisible, capacity, fits, stashCount, emptyStash,
  STASH_RAID_HEAT, buyTonic, drinkTonic, tonics, TONIC, BOAT_FARE, passDays, recordSeen, maybeBreakRune, day, debt,
  debtDue, payDebt, missDebt, fameTitle, load, hearRumor, econ, chill,
  REFUGES, REFUGE_UPGRADES, CREW, LODGING, crewAt, setCrewAt, partyHas, partySize, lodgingFee, ownsRefuge, refugeHas,
  stashCapacity, crewIn, townTips,
} from "../state.js";

const INTRO = [
  "Las piedras de hechizo calientan casas, guardan el agua y salvan la cosecha.",
  "La Corona y su Gremio las venden caras, pocas y tarde.",
  "Por eso los pueblos le compran a quien se atreva a llevarlas por la calzada.",
  "Tu padre le debía 500 al Gremio. Murió el invierno pasado y la deuda ahora es tuya.",
  "Cada diez días pasa el cobrador.",
  "Tienes 40 de oro, un bastón y una mochila con cuatro lugares.",
  "Los comerciantes de cada plaza pagan extra a quien lleve lo que le falta a otro pueblo.",
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
    this.horseView = "side";
    this.chaseOn = false;
    this.trail = [];
    this.barrier = null;
    this.gates = {};
    this.stashes = [];
  }

  create(data) {
    const reg = this.registry;
    this.def = MAPS[this.mapId];
    const def = this.def;
    reg.set("mapId", this.mapId);
    this.ui = this.scene.get("ui");
    this.fx = new Fx(this);
    this.controls = new Controls(this);

    // Llegar a un pueblo desde una ruta pasa días: el mercado se mueve y la escarcha se derrite.
    this.arrival = null;
    if (def.kind === "route") reg.set("lastRoute", this.mapId);
    if (def.kind === "town") {
      const prev = reg.get("currentTown");
      const route = reg.get("lastRoute");
      const boat = data?.boat;
      if (route || boat) {
        const days = boat ? TRAVEL_DAYS.boat : prev === def.town ? TRAVEL_DAYS.back : TRAVEL_DAYS.route;
        const cold = route === "ruta4" ? 0.5 : 0;
        const report = passDays(reg, days, { cold });
        if (prev !== def.town) reg.inc("trips", 1);
        this.arrival = { days, from: prev !== def.town ? prev : null, ...report };
      }
      reg.set("lastRoute", null);
      reg.set("currentTown", def.town);
      recordSeen(reg, def.town);
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

    this.setupCrew();
    if (def.kind === "route") this.time.delayedCall(1200, () => this.checkRaids());
    this.speedBonus = def.kind === "route" && partyHas(reg, "horse") ? 1.1 : 1;
    // Cuevas: más oscuras que afuera.
    if (def.dark) this.add.rectangle(0, 0, this.world.W, this.world.H, 0x0a0712, 0.3).setOrigin(0, 0).setDepth(DEPTH.fx - 1);

    const cam = this.cameras.main;
    // Un mapa más chico que la pantalla (refugios) se centra, con fondo del color del lugar.
    const bw = Math.max(this.world.W, VIEW_W);
    const bh = Math.max(this.world.H, VIEW_H);
    cam.setBounds(-(bw - this.world.W) / 2, -(bh - this.world.H) / 2, bw, bh);
    if (bw > this.world.W || bh > this.world.H) cam.setBackgroundColor(def.dark ? 0x1b1422 : 0x16372a);
    cam.startFollow(this.player.sprite, true, 0.16, 0.16, 0, 12);
    cam.setRoundPixels(true);
    cam.fadeIn(260, 18, 14, 23);

    startMusic(this, def.music);
    startAmbience(this, def.ambience);
    this.ui.enterMap(def);
    this.refreshSigns();
    if (this.arrival) this.time.delayedCall(700, () => this.onArrival());
    else if (def.kind === "town") this.time.delayedCall(2900, () => this.showNeeds());

    this.debugOn = false;
    this.input.keyboard.on("keydown", this.onDebugKey, this);
    // El modo depuración sigue prendido al cambiar de mapa hasta que se apague con F1.
    if (reg.get("debugMode")) this.toggleDebug(true);
    this.events.once("shutdown", () => this.ui.prompt(null));
    if (this.intro) this.time.delayedCall(900, () => this.runModal(() => this.ui.say(INTRO)));
    if (def.kind === "route" && !flag(reg, "hint-route")) {
      setFlag(reg, "hint-route");
      this.time.delayedCall(2600, () => this.ui.toast(`${keyName("attack")} golpear · ${keyName("roll")} rodar (mantén: correr) · ${keyName("hide")} agacharse`, "font-o"));
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
          // Sahra ya contratada no está en su puesto: anda contigo (o donde la dejaste).
          if (spec.role === "escort" && hasUpgrade(reg, "escort")) break;
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
          this.stashes.push({ spec, img });
          break;
        }
        case "refuge": {
          const info = REFUGES[spec.id];
          const owned = ownsRefuge(reg, spec.id);
          let img;
          if (info.kind === "cave") {
            img = this.add.sprite(px, py, spec.snow ? "cave-door-snow" : "cave-door", owned ? 1 : 0).setOrigin(0.5, 1).setDepth(py);
            this.world.addSolid(px - 16, py - 26, 32, 22);
          } else {
            img = this.add.sprite(px, py, "gate", owned ? 1 : 0).setOrigin(0.5, 1).setDepth(py);
            this.world.addSolid(px - 24, py - 14, 8, 12);
            this.world.addSolid(px + 16, py - 14, 8, 12);
            spec.bar = this.world.addSolid(px - 16, py - 14, 32, 12);
            if (owned) spec.bar.body.enable = false;
          }
          this.interactables.push({ x: px, y: py + 6, r: 22, get label() { return ownsRefuge(reg, spec.id) ? "Entrar" : "Mirar"; }, act: () => this.useRefugeDoor(spec, img) });
          this.stashes.push({ spec, img, refuge: true });
          break;
        }
        case "store": {
          const img = this.add.sprite(px, py + 4, "shelf", stashCount(reg, spec.id) ? 1 : 0).setOrigin(0.5, 1).setDepth(py + 4);
          this.world.addSolid(px - 11, py - 8, 22, 10);
          this.interactables.push({ x: px, y: py + 4, r: 20, label: "Estante", act: () => this.useStore(spec, img) });
          break;
        }
        case "bench": {
          this.add.image(px, py + 4, "workbench").setOrigin(0.5, 1).setDepth(py + 4);
          this.world.addSolid(px - 12, py - 6, 24, 8);
          this.interactables.push({ x: px, y: py + 4, r: 20, label: "Mejoras", act: () => this.useBench(spec) });
          break;
        }
        case "cot": {
          if (!refugeHas(reg, spec.id, "cot")) break;
          this.add.image(px, py + 4, "cot").setOrigin(0.5, 1).setDepth(py + 4);
          this.world.addSolid(px - 12, py - 6, 24, 8);
          this.interactables.push({ x: px, y: py + 2, r: 20, label: "Descansar", act: () => this.useCot(spec) });
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
      // Hacia dónde va: se mira unos pasos adelante para no parpadear en diagonales.
      const ahead = this.trail[Math.min(4, this.trail.length - 1)] ?? t;
      const dx = ahead.x - this.horse.x;
      const dy = ahead.y - this.horse.y;
      this.horse.setPosition(t.x, t.y);
      if (Math.abs(dx) > Math.abs(dy) * 1.4) this.horseView = "side";
      else if (Math.abs(dy) > Math.abs(dx) * 1.4) this.horseView = dy < 0 ? "up" : "down";
      const view = this.horseView ?? "side";
      if (view === "side" && Math.abs(dx) > 0.2) this.horse.setFlipX(dx < 0);
      if (view !== "side") this.horse.setFlipX(false);
      this.horse.play(`horse-${view}`, true);
    } else {
      this.horse.anims.stop();
    }
    this.horse.setDepth(this.horse.y - 1);
    this.horseShadow.setPosition(this.horse.x, this.horse.y);
  }

  // ---------------------------------------------------------------- bucle

  update(time, delta) {
    const dt = Math.min(delta, 50);
    this.controls.update();
    if (this.controls.pressed("debug")) this.toggleDebug();

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
    // Un solo botón de acción: con alguien o algo enfrente, hablas o usas; si no, golpeas.
    const target = this.interactTarget();
    if (target && this.controls.pressed("interact")) {
      this.runModal(() => target.act());
      return;
    }
    this.keepHorseOffIce();
    this.updateChaseMusic(dt);
    this.player.update(dt, this.controls, this.world);
    this.escort?.update(dt);
    for (const e of this.enemies) if (!e.dead) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.state === "down" || e.sprite.active);
    for (const n of this.npcs) n.update(dt);
    this.updatePickups(dt);
    this.updateHorse();
    this.updateBarrier(dt);
    this.ui.prompt(target && this.player.state === "move" ? target.label : null);
    this.checkExits();
  }

  // ---------------------------------------------------------------- interacción

  /** Lo que tienes enfrente para hablar o usar (o nada). */
  interactTarget() {
    const p = this.player;
    if (p.state !== "move") return null;
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
    return best;
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
          recordSeen(reg, this.def.town);
          if (this.def.town === "frostholm" && !hasUpgrade(reg, "icebox")) await this.iceboxOffer(npc);
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
          if (hasUpgrade(reg, "horse")) await this.stableTalk(npc);
          else await this.upgradeTalk(npc, "horse", ["Mis caballos no cargan para cualquiera.", "Hazte un nombre en la calzada y hablamos."], "Tengo una yegua que carga sin quejarse. Más espacio y más paso en la ruta.");
          break;
        case "inn":
          await this.innTalk(npc);
          break;
        case "landseller":
          await this.landTalk(npc);
          break;
        case "townguard": {
          const h = localHeat(reg, this.def);
          const extra = h >= 45 ? "Y tú… te estamos mirando." : h >= 20 ? "Se habla de contrabando por aquí." : "Tranquilo el día.";
          await this.ui.say([...npc.spec.talk, extra], { name });
          break;
        }
        case "tutorial":
          await this.ui.say(npc.spec.talk, { name });
          break;
        default: {
          // La gente del pueblo cuenta rumores; unos dicen la verdad más que otros.
          const honest = 0.6 + (name.length % 4) * 0.12;
          const r = hearRumor(reg, honest);
          await this.ui.say([...npc.spec.talk, r.text], { name });
        }
      }
    } finally {
      npc.talking = false;
      this.refreshSigns();
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
      await this.ui.say([...lockedLines, `(Necesitas fama ${item.reputation}. Tienes ${reputation(reg)}. Sube vendiendo lo que un pueblo ocupa.)`], { name });
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
    sfx(this, "chest", { volume: 0.5 });
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
    sfx(this, "lever", { volume: 0.6 });
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
    if (maybeBreakRune(reg)) {
      this.fx.float(this.player.x, this.player.y - 26, "¡crac!", "font-red");
      this.ui.toast("Se rompió un vidrio rúnico", "font-red");
      sfx(this, "chop", { volume: 0.3 });
    }
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
          if (!fits(reg, p.good)) continue;
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
    const reg = this.registry;
    // La piedra solar está muy vigilada: comprar el silencio cuesta más.
    const suns = Math.min(cargoOf(reg, "sun"), contrabandVisible(reg));
    return 4 + Math.floor(localHeat(reg, this.def) / 25) * 2 + contrabandVisible(reg) + suns * 2;
  }

  /** Sólo ámbar a la vista: tiene sello, así que la Corona cobra impuesto en vez de confiscar. */
  async amberTax(guard, source, amber) {
    const reg = this.registry;
    const tax = amber * AMBER_TAX;
    await this.ui.say(["Ámbar con sello. Eso paga impuesto, no cárcel.", `Son ${tax} de oro por ${amber} ${amber === 1 ? "piedra" : "piedras"}.`], { name: "Guardia" });
    if (pay(reg, tax)) {
      sfx(this, "coins");
      await this.ui.say(["—Circula."], { name: "Guardia" });
    } else {
      loseStones(reg, 1, true);
      await this.ui.say(["—¿No traes con qué? Me quedo con una."], { name: "Guardia" });
    }
    this.passCleared = true;
    this.clearGuard(guard, source);
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
    const contra = contrabandVisible(reg);
    if (contra === 0) {
      restoreTheme(this);
      await this.amberTax(guard, source, vis);
      return;
    }
    const cost = this.bribeCost();
    const suns = Math.min(cargoOf(reg, "sun"), contra);
    await this.ui.say(["¡Alto ahí! Revisión de la Corona.", `Llevas ${contra} ${contra === 1 ? "piedra" : "piedras"} sin sello a la vista. Eso se confisca.`], { name: "Guardia" });
    const pick = await this.ui.choose("¿Qué haces?", [
      { label: "Dejar que revisen", note: suns ? `Confiscan ${contra} · con solar el calor sube` : `Confiscan ${contra} · el calor baja` },
      { label: `Sobornar · ${cost} oro`, disabled: gold(reg) < cost, note: gold(reg) < cost ? "No te alcanza" : "Te dejan pasar con todo" },
      { label: source === "barrier" ? "Dar media vuelta" : "Empujar y correr", note: source === "barrier" ? "Buscar otro camino" : "El calor sube mucho" },
    ], { name: "Guardia" });
    restoreTheme(this);
    if (pick === 0) {
      const taken = confiscateVisible(reg);
      // Agarrar piedra solar es noticia: la Corona se pone más atenta.
      this.addRouteHeat(taken.sun ? taken.sun * 8 : -5);
      sfx(this, "sack");
      const what = Object.entries(taken).filter(([, n]) => n).map(([g, n]) => `${n} ${GOODS[g].short}`).join(", ");
      const lines = [`Confiscan ${what}.`];
      if (cargoOf(reg, "amber")) lines.push("El ámbar con sello te lo dejan.");
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
      await this.ui.say(["No trabajo para desconocidos.", `(Necesitas fama ${kit.reputation}. Tienes ${reputation(reg)}. Sube vendiendo lo que un pueblo ocupa.)`], { name });
      return;
    }
    const options = [];
    if (!hasUpgrade(reg, "stashKit")) options.push({ id: "stashKit", label: `Herrajes de alijo · ${kit.cost} oro`, disabled: gold(reg) < kit.cost, note: "Puerta y cerrojo para las cuevas de los caminos" });
    if (!hasUpgrade(reg, "hideout")) {
      const locked = reputation(reg) < hide.reputation;
      options.push({ id: "hideout", label: locked ? `Fondo falso (fama ${hide.reputation})` : `Fondo falso · ${hide.cost} oro`, disabled: locked || gold(reg) < hide.cost, note: "Dos piedras que ningún guardia encuentra" });
    }
    if (!options.length) {
      await this.ui.say(["Ya tienes todo lo que sé hacer. Cuídalo."], { name });
      return;
    }
    await this.ui.say(["Tu nombre ya suena en la calzada.", "Te puedo forjar herrajes para cerrar una cueva y hacerla tu refugio. Y, más adelante, un fondo falso."], { name });
    const pick = await this.ui.choose("Oskar, herrero", [...options, { label: "Nada por ahora" }], { name });
    const choice = options[pick];
    if (!choice) return;
    const res = purchaseUpgrade(reg, choice.id);
    tone(this, res.ok ? "chest" : "deny");
    if (res.ok) sfx(this, "coins");
    const extra = choice.id === "stashKit" && res.ok
      ? ["En el Paso Alto y junto al lago del paso hay cuevas secas. Con esto, cada una es tu refugio.", "Adentro guardas piedras y hasta gente. Pero si la Corona anda caliente en esa ruta, sin buen cerrojo la encuentra."]
      : [];
    await this.ui.say([res.reason, ...extra], { name });
    saveGame(reg);
  }

  async healerTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    await this.ui.say(npc.spec.talk, { name });
    const pick = await this.ui.choose("Tónico de raíz", [
      { label: `Comprar uno · ${TONIC.cost} oro`, disabled: gold(reg) < TONIC.cost || tonics(reg) >= TONIC.max, note: `Llevas ${tonics(reg)} de ${TONIC.max}. Con ${keyName("tonic")} recuperas 2 corazones.` },
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
    // Con caballo, la barca cobra el doble: ocupa lo que dos pasajeros.
    const fare = BOAT_FARE * (partyHas(reg, "horse") ? 2 : 1);
    const pick = await this.ui.choose(`Cruzar el golfo a ${TOWNS[to].name}`, [
      { label: `Subir a la barca · ${fare} oro`, disabled: gold(reg) < fare, note: `Sin retenes ni bandidos. Son ${TRAVEL_DAYS.boat} días de mar.` },
      { label: "Ahora no" },
    ], { name });
    if (pick !== 0) return;
    pay(reg, fare);
    sfx(this, "coins");
    this.leaving = true;
    this.cameras.main.fadeOut(600, 18, 14, 23);
    await new Promise((r) => this.time.delayedCall(650, r));
    await this.ui.say(["La barca se aparta del muelle. El golfo está en calma.", `Al caer la tarde asoma ${TOWNS[to].name}.`]);
    this.scene.restart({ map: to, entry: "dock", boat: true });
  }

  /** En Frostholm venden hieleras de serrín: la escarcha aguanta el viaje. */
  async iceboxOffer(npc) {
    const reg = this.registry;
    const item = UPGRADES.icebox;
    const pick = await this.ui.choose(`${item.name} · ${item.cost} oro`, [
      { label: "Comprarla", disabled: gold(reg) < item.cost, note: "La escarcha se derrite tres veces más lento" },
      { label: "No, gracias" },
    ], { name: npc.spec.name });
    if (pick !== 0) return;
    const res = purchaseUpgrade(reg, "icebox");
    tone(this, res.ok ? "chest" : "deny");
    if (res.ok) sfx(this, "coins");
    await this.ui.say([res.ok ? "Serrín seco y tablas gruesas. Con esto llega fría hasta Ashfen." : res.reason], { name: npc.spec.name });
    saveGame(reg);
  }

  // ---------------------------------------------------------------- llegada y deuda

  /** Al llegar a un pueblo: días que pasaron, escarcha y el cobrador. */
  onArrival() {
    const reg = this.registry;
    const a = this.arrival;
    if (!a) return;
    this.ui.toast(`Pasaron ${a.days} ${a.days === 1 ? "día" : "días"} · día ${day(reg)}`, "font-gold");
    if (a.melted) this.time.delayedCall(500, () => this.ui.toast(`Se te derritió la escarcha (${a.melted})`, "font-red"));
    this.runModal(async () => {
      if (debtDue(reg)) await this.debtCollector();
      this.refreshSigns();
      this.showNeeds();
    });
  }

  /** "Oye, aquí ocupan esto": una vez por pueblo y por día, para no repetirlo a cada rato. */
  showNeeds() {
    if (this.def.kind !== "town" || !this.scene.isActive()) return;
    const key = `${this.def.town}-${day(this.registry)}`;
    if (this.ui.needsShown === key) return;
    this.ui.needsShown = key;
    this.ui.townNeeds(this.def.town);
  }

  /** Burbuja sobre cada comerciante, para ver de lejos lo que aquí ocupan (te lo pagan bien). */
  refreshSigns() {
    for (const s of this.signs ?? []) s.destroy();
    this.signs = [];
    if (this.def.kind !== "town") return;
    const want = townTips(this.registry, this.def.town).wanted[0];
    for (const npc of this.npcs) {
      if (npc.spec.role !== "market" || !want) continue;
      const box = this.add.container(Math.round(npc.x), Math.round(npc.y - 27)).setDepth(DEPTH.fx);
      box.add(this.add.image(0, 0, this.ui.panelKey("ui-tag", 16, 16)).setOrigin(0.5, 1));
      box.add(this.add.image(0, -3, `gem-${want.good}`).setOrigin(0.5, 1));
      this.tweens.add({ targets: box, y: box.y - 2, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.signs.push(box);
    }
  }

  async debtCollector() {
    const reg = this.registry;
    const d = debt(reg);
    const cuota = Math.min(DEBT.cuota, d.owed);
    const name = "Cobrador del Gremio";
    await this.ui.say(["Un hombre con el sello del Gremio te cierra el paso.", `—Le debes ${d.owed} al Gremio. Toca la cuota: ${cuota}.`], { name });
    const pick = await this.ui.choose("Deuda con el Gremio", [
      { label: `Pagar la cuota · ${cuota}`, disabled: gold(reg) < cuota, note: `Vuelvo en ${DEBT.every} días` },
      { label: `Pagar todo · ${d.owed}`, disabled: gold(reg) < d.owed, note: "Y quedas libre" },
      { label: "No tengo", note: `La deuda sube ${DEBT.interest} y vuelvo pronto` },
    ], { name });
    if (pick === 0 || pick === 1) {
      payDebt(reg, pick === 0 ? cuota : d.owed);
      sfx(this, "coins");
      if (debt(reg).owed <= 0) {
        setFlag(reg, "debt-paid");
        duckTheme(this, 0.05);
        sfx(this, "jingle-free", { volume: 0.55 });
        this.time.delayedCall(3500, () => restoreTheme());
        await this.ui.say(["—Cuenta saldada. El Gremio ya no te busca.", "(Eres libre. Lo que ganes ahora es tuyo.)"], { name });
      } else {
        await this.ui.say([`—Quedan ${debt(reg).owed}. Nos vemos el día ${debt(reg).due}.`], { name });
      }
    } else {
      missDebt(reg);
      tone(this, "deny");
      await this.ui.say([`—Mala respuesta. Ahora son ${debt(reg).owed}.`, `—Vuelvo el día ${debt(reg).due}. Ten el oro.`], { name });
    }
    saveGame(reg);
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
      if (refugeHas(reg, spec.id, "lock")) continue;
      if (Math.random() >= 0.5) continue;
      // Quien se quedó cuidando el refugio espanta a la patrulla.
      const guard = crewIn(reg, spec.id).find((w) => !CREW[w].animal);
      if (guard) {
        this.ui.toast(`Una patrulla rondó tu refugio. ${CREW[guard].name} la espantó.`, "font-green");
        return;
      }
      const lost = emptyStash(reg, spec.id);
      this.ui.toast(`Redada: la Corona encontró tu refugio (${lost} piedras)`, "font-red");
      saveGame(reg);
      return;
    }
  }

  // ---------------------------------------------------------------- tripulación

  /** Quién te sigue en este mapa, quién espera afuera y quién se quedó en este refugio. */
  setupCrew() {
    const reg = this.registry;
    const def = this.def;
    this.crewStatics = [];
    // El caballo que esperaba afuera de la cueva se vuelve a juntar.
    if (def.kind === "route" && crewAt(reg, "horse") === `wait:${this.mapId}`) setCrewAt(reg, "horse", "party");
    if (def.kind === "refuge" && partyHas(reg, "horse") && !refugeHas(reg, def.refuge, "corral")) {
      setCrewAt(reg, "horse", `wait:${REFUGES[def.refuge].route}`);
      this.time.delayedCall(900, () => this.ui.toast("La yegua no cabe: espera afuera", "font-o"));
    }
    if (partyHas(reg, "horse")) this.addHorse();
    this.escort = partyHas(reg, "sahra") ? new Escort(this, this.player.x, this.player.y + 10) : null;
    // En pueblos y refugios se les puede hablar para dejarlos.
    this.crewIts = {};
    if (def.kind !== "route") {
      if (this.escort) this.followerTalkable("sahra");
      if (this.horse) this.followerTalkable("horse");
    }
    if (def.kind === "refuge") for (const who of crewIn(reg, def.refuge)) this.spawnCrewStatic(who);
  }

  /** Al que te sigue se le puede hablar (en pueblos y refugios) para dejarlo. */
  followerTalkable(who) {
    if (this.def.kind === "route") return;
    const scene = this;
    const it = {
      get x() { return who === "horse" ? scene.horse?.x ?? -999 : scene.escort?.sprite.x ?? -999; },
      get y() { return who === "horse" ? scene.horse?.y ?? -999 : scene.escort?.sprite.y ?? -999; },
      r: who === "horse" ? 20 : 16,
      label: who === "horse" ? "Yegua" : "Hablar",
      act: () => this.crewTalk(who),
    };
    this.crewIts[who] = it;
    this.interactables.push(it);
  }

  /** Alguien que se quedó en este refugio: está parado ahí hasta que vuelvas por él. */
  spawnCrewStatic(who) {
    const [cx, cy] = this.def.crewSpots?.[who] ?? [8, 6];
    const x = cx * TILE;
    const y = cy * TILE;
    const sprite = who === "horse"
      ? this.add.sprite(x, y, "horse", 4).setOrigin(0.5, 1)
      : this.add.sprite(x, y, "cast-archer", 0).setOrigin(0.5, 1).play("archer-idle-down");
    sprite.setDepth(y);
    const shadow = this.add.image(x, y, who === "horse" ? "shadow-big" : "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.world.addSolid(x - 6, y - 5, 12, 6);
    const it = { x, y, r: 20, label: "Hablar", act: () => this.crewTalk(who, { sprite, shadow, it }) };
    this.interactables.push(it);
    this.crewStatics.push({ who, sprite, shadow, it });
  }

  /** Hablar con alguien de tu gente: dejarlo aquí o llevártelo. */
  async crewTalk(who, still = null) {
    const reg = this.registry;
    const def = this.def;
    const c = CREW[who];
    const name = who === "horse" ? "Yegua" : "Sahra";
    if (still) {
      const pick = await this.ui.choose(who === "horse" ? "La yegua te mira" : "Sahra afila flechas", [
        { label: "Vámonos", note: "Se viene contigo" },
        { label: "Quédate", note: who === "horse" ? "" : "Cuida el refugio de redadas" },
      ], { name });
      if (pick !== 0) return;
      setCrewAt(reg, who, "party");
      still.sprite.destroy();
      still.shadow.destroy();
      still.it.hidden = true;
      if (who === "horse") { this.addHorse(); this.horse.setPosition(still.sprite.x, still.sprite.y); }
      else this.escort = new Escort(this, still.sprite.x, still.sprite.y);
      this.followerTalkable(who);
      tone(this, "confirm");
      saveGame(reg);
      return;
    }
    const options = [];
    if (def.kind === "refuge") {
      const canStay = !c.animal || refugeHas(reg, def.refuge, "corral");
      options.push({ id: "stay", label: "Quédate aquí", disabled: !canStay, note: canStay ? (c.animal ? "En el corral" : "Cuida el refugio de redadas") : "Sin corral no cabe" });
    } else if (def.kind === "town") {
      if (c.animal) {
        const stable = def.town === "valkeep";
        options.push({ id: "stable", label: `Déjala en el establo · ${LODGING.stable}/día`, disabled: !stable, note: stable ? "Nella la cuida" : "Sólo hay establo en Valkeep" });
      } else {
        options.push({ id: "inn", label: `Espérame en la posada · ${LODGING.inn}/día`, note: "Se paga al recogerla" });
      }
    }
    options.push({ id: "go", label: "Sigue conmigo" });
    const pick = await this.ui.choose(who === "horse" ? "La yegua" : "Sahra", options, { name });
    const opt = options[pick];
    if (!opt || opt.id === "go") return;
    if (opt.id === "stay") setCrewAt(reg, who, `refuge:${def.refuge}`);
    if (opt.id === "stable") setCrewAt(reg, who, "stable:valkeep");
    if (opt.id === "inn") setCrewAt(reg, who, `inn:${def.town}`);
    // Se aparta: deja de seguirte.
    if (who === "horse" && this.horse) {
      const h = this.horse;
      this.tweens.add({ targets: [h, this.horseShadow], alpha: opt.id === "stay" ? 1 : 0, duration: 400 });
      if (opt.id === "stay") { this.horse.destroy(); this.horseShadow.destroy(); this.horse = null; this.spawnCrewStatic("horse"); }
      else this.time.delayedCall(420, () => { h.destroy(); this.horseShadow?.destroy(); this.horse = null; });
    }
    if (who === "sahra" && this.escort) {
      const e = this.escort;
      this.escort = null;
      e.sprite.destroy();
      e.shadow.destroy();
      if (opt.id === "stay") this.spawnCrewStatic("sahra");
    }
    if (this.crewIts?.[who]) this.crewIts[who].hidden = true;
    if (who === "horse") this.speedBonus = 1;
    tone(this, "confirm");
    this.ui.toast(opt.id === "stay" ? `${c.name} se queda en el refugio` : opt.id === "stable" ? "La yegua se queda en el establo" : "Sahra te espera en la posada", "font-o");
    saveGame(reg);
  }

  /** Posadero: aquí se queda tu gente (cobra por día) y se oyen los rumores más confiables. */
  async innTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const here = `inn:${this.def.town}`;
    const guests = Object.keys(CREW).filter((w) => crewAt(reg, w) === here);
    const r = hearRumor(reg, 0.95);
    await this.ui.say([...(npc.spec.talk ?? []), r.text], { name });
    for (const who of guests) {
      const fee = lodgingFee(reg, who);
      const pick = await this.ui.choose(`${CREW[who].name} está arriba`, [
        { label: `Llamarla · ${fee} oro`, disabled: gold(reg) < fee, note: `${LODGING.inn} por día` },
        { label: "Que se quede" },
      ], { name });
      if (pick !== 0) continue;
      pay(reg, fee);
      setCrewAt(reg, who, "party");
      sfx(this, "coins");
      this.escort = new Escort(this, npc.x, npc.y + 12);
      this.followerTalkable(who);
      saveGame(reg);
    }
  }

  /** Nella: además de vender la yegua, la cuida en el establo. */
  async stableTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const at = crewAt(reg, "horse");
    if (at === "stable:valkeep") {
      const fee = lodgingFee(reg, "horse");
      const pick = await this.ui.choose("Tu yegua está en el establo", [
        { label: `Llevármela · ${fee} oro`, disabled: gold(reg) < fee, note: `${LODGING.stable} por día` },
        { label: "Que se quede" },
      ], { name });
      if (pick !== 0) return;
      pay(reg, fee);
      setCrewAt(reg, "horse", "party");
      sfx(this, "coins");
      this.addHorse();
      this.horse.setPosition(npc.x - 18, npc.y + 6);
      this.followerTalkable("horse");
      saveGame(reg);
      return;
    }
    if (at === "party") {
      await this.ui.say(["¿Cómo va la yegua? Si un día no la necesitas, déjamela aquí.", `(Háblale a la yegua para dejarla: ${LODGING.stable} oro por día.)`], { name });
      return;
    }
    const where = at?.startsWith("refuge:") ? REFUGES[at.slice(7)]?.name : at?.startsWith("wait:") ? "afuera de una cueva" : "por ahí";
    await this.ui.say([`¿Y la yegua? Me dicen que la dejaste en ${where}.`], { name });
  }

  /** Aurelio vende su claro escondido: un refugio con corral. */
  async landTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const info = REFUGES["refugio-r3"];
    if (ownsRefuge(reg, "refugio-r3")) {
      await this.ui.say(["El claro es tuyo. Nadie más sabe de la reja.", "Yo no he visto nada, como siempre."], { name });
      return;
    }
    await this.ui.say(npc.spec.talk, { name });
    if (reputation(reg) < info.fame) {
      await this.ui.say(["Pero no se lo vendo a cualquiera.", `(Necesitas fama ${info.fame}. Tienes ${reputation(reg)}. Sube vendiendo lo que un pueblo ocupa.)`], { name });
      return;
    }
    const pick = await this.ui.choose(`${info.name} · ${info.price} oro`, [
      { label: "Comprarla", disabled: gold(reg) < info.price, note: "Choza, corral y reja. Cabe el caballo." },
      { label: "Ahora no" },
    ], { name });
    if (pick !== 0) return;
    pay(reg, info.price);
    setFlag(reg, "refuge-refugio-r3");
    tone(this, "chest");
    sfx(this, "coins");
    const door = this.stashes.find((s) => s.spec.id === "refugio-r3");
    if (door) { door.img.setFrame(1); if (door.spec.bar) door.spec.bar.body.enable = false; }
    await this.ui.say(["Aquí tienes la llave de la reja.", "Lo que guardes ahí es tuyo. Hasta la yegua cabe."], { name });
    saveGame(reg);
  }

  // ---------------------------------------------------------------- refugios

  async useRefugeDoor(spec, img) {
    const reg = this.registry;
    const info = REFUGES[spec.id];
    if (!ownsRefuge(reg, spec.id)) {
      if (info.kind === "plot") {
        await this.ui.say(["Una reja entre la selva. Del otro lado se ve un claro.", "Es de Aurelio, el campesino de aquí al lado."]);
        return;
      }
      if (!hasUpgrade(reg, "stashKit")) {
        await this.ui.say(["Una cueva seca y honda. Aquí adentro nadie te vería.", "Con puerta y cerrojo sería tu refugio. Oskar, el herrero de Ashfen, hace herrajes."]);
        return;
      }
      setFlag(reg, `refuge-${spec.id}`);
      if (info.cold) reg.set("stashes", { ...(reg.get("stashes") ?? {}), [spec.id]: { cold: true } });
      img.setFrame(1);
      tone(this, "chest");
      sfx(this, "latch", { volume: 0.5 });
      await this.ui.say(["Clavas los herrajes de Oskar: puerta, bisagras y un cerrojo.", `${info.name}: ahora es tuya.`]);
      saveGame(reg);
    }
    this.enterMap(spec.id, "door");
  }

  /** Cambia de mapa con un fundido. */
  enterMap(map, entry) {
    this.leaving = true;
    sfx(this, "door-open", { volume: 0.45 });
    this.cameras.main.fadeOut(220, 18, 14, 23);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ map, entry }));
  }

  async useStore(spec, img) {
    const reg = this.registry;
    await this.ui.stash(spec.id, this.def, localHeat(reg, this.def), stashCapacity(reg, spec.id), `ESTANTE · ${REFUGES[spec.id].name.toUpperCase()}`);
    img.setFrame(stashCount(reg, spec.id) ? 1 : 0);
    saveGame(reg);
  }

  /** Mesa de trabajo: mejoras del refugio. El herrero manda las piezas con un arriero. */
  async useBench(spec) {
    const reg = this.registry;
    const info = REFUGES[spec.id];
    const ids = Object.keys(REFUGE_UPGRADES).filter((u) => !(u === "corral" && info.corral));
    const options = ids.map((u) => {
      const up = REFUGE_UPGRADES[u];
      const owned = refugeHas(reg, spec.id, u);
      return { id: u, label: owned ? `${up.name} · listo` : `${up.name} · ${up.cost} oro`, disabled: owned || gold(reg) < up.cost, note: up.effect };
    });
    options.push({ label: "Nada" });
    const pick = await this.ui.choose(`${info.name}: mejoras`, options);
    const opt = options[pick];
    if (!opt?.id) return;
    pay(reg, REFUGE_UPGRADES[opt.id].cost);
    setFlag(reg, `${spec.id}-${opt.id}`);
    tone(this, "chest");
    sfx(this, "chop", { volume: 0.4 });
    await this.ui.say([`${REFUGE_UPGRADES[opt.id].name}: listo. ${REFUGE_UPGRADES[opt.id].effect}.`]);
    saveGame(reg);
    // Lo nuevo se ve: se vuelve a armar el cuarto.
    if (opt.id === "cot" || opt.id === "corral") this.enterMap(this.mapId, "door");
  }

  async useCot() {
    const reg = this.registry;
    const pick = await this.ui.choose("Catre", [{ label: "Dormir un día", note: "Te curas; el mundo sigue" }, { label: "Ahora no" }]);
    if (pick !== 0) return;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    await new Promise((r) => this.time.delayedCall(450, r));
    const report = passDays(reg, 1, { cold: this.def.cold ? 1 : 0 });
    heal(reg);
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.ui.toast(`Dormiste. Día ${day(reg)}`, "font-gold");
    if (report.melted) this.ui.toast("Se te derritió la escarcha", "font-red");
    saveGame(reg);
  }

  /** Paso del jugador: pasto, piedra, madera, arena o nieve según dónde pisa. */
  stepSound(x, y, running) {
    const ch = this.world.cellAt(x, y - 2);
    const cx = Math.floor(x / TILE);
    const cy = Math.floor((y - 2) / TILE);
    let ground = STEP_BY_CELL[ch] ?? STEP_BY_BIOME[biomeOf(this.def, cx, cy)] ?? "grass";
    if (this.def.kind === "refuge" && this.def.dark && ground === "grass") ground = "stone";
    footstep(this, ground, running ? 0.2 : 0.14);
  }

  /**
   * Si un guardia te persigue suena la música de persecución; cuando ninguno te sigue por 3 s,
   * vuelve la del lugar.
   */
  updateChaseMusic(dt) {
    const chased = this.enemies.some((e) => e instanceof Guard && !e.dead && (e.state === "chase" || e.hostile) && e.distToPlayer() < 260);
    if (chased) {
      this.calmFor = 0;
      if (!this.chaseOn) { this.chaseOn = true; startMusic(this, "chase"); }
    } else if (this.chaseOn) {
      this.calmFor = (this.calmFor ?? 0) + dt;
      if (this.calmFor > 3000) { this.chaseOn = false; startMusic(this, this.def.music); }
    }
  }

  /** La yegua no pisa el hielo: con ella no se cruza el lago. */
  keepHorseOffIce() {
    if (!this.horse) return;
    const p = this.player;
    const onIce = this.world.cellAt(p.x, p.y - 2) === "i";
    if (!onIce) {
      this.lastDry = { x: p.x, y: p.y };
      return;
    }
    if (!this.lastDry) return;
    p.body.reset(this.lastDry.x, this.lastDry.y);
    if (p.state === "slide") p.setState("move");
    if (!this.iceWarned || this.time.now - this.iceWarned > 4000) {
      this.iceWarned = this.time.now;
      this.ui.toast("La yegua no pisa el hielo: déjala en la cueva o ve por el retén", "font-o");
    }
  }

  /** Mientras más gente llevas, de más lejos te ven los guardias. */
  groupSight() {
    return 1 + 0.2 * partySize(this.registry);
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

  toggleDebug(quiet = false) {
    this.debugOn = !this.debugOn;
    this.registry.set("debugMode", this.debugOn);
    const w = this.physics.world;
    if (this.debugOn) {
      if (!w.debugGraphic) w.createDebugGraphic();
      w.drawDebug = true;
      w.debugGraphic.setVisible(true).setDepth(DEPTH.ui);
      if (!quiet) {
        this.ui.toast("Depuración: 1 oro · 2 carga · 3 calor · 4 vida", "font-blue");
        this.ui.toast("5 fama · 6 caballo · 7 arquera y alijos · 8 tónicos", "font-blue");
      }
    } else if (w.debugGraphic) {
      w.drawDebug = false;
      w.debugGraphic.clear().setVisible(false);
    }
  }

  /** Teclas de depuración por evento: un toque rápido no se pierde entre cuadros,
   *  y sirven igual los números de arriba que los del teclado numérico. */
  onDebugKey(event) {
    if (!this.debugOn) return;
    const m = /^(?:Digit|Numpad)([1-8])$/.exec(event.code);
    if (!m) return;
    const reg = this.registry;
    const say = (t) => this.ui.toast(t, "font-blue");
    switch (Number(m[1])) {
      case 1: reg.inc("gold", 50); say("+50 oro"); break;
      case 2: {
        const good = TOWNS[reg.get("currentTown") ?? "ashfen"].produce;
        const room = Math.floor((capacity(reg) - load(reg)) / STONE[good].slots);
        reg.set("cargo", { ...cargo(reg), [good]: (cargo(reg)[good] ?? 0) + Math.max(0, room) });
        say(`Carga llena de ${GOODS[good].short}`);
        break;
      }
      case 3: this.addRouteHeat(20); say("+20 calor"); break;
      case 4: heal(reg); say("Vida llena"); break;
      case 5: reg.inc("reputation", 5); say(`Fama ${reputation(reg)}`); break;
      case 6: reg.set("upgrades", { ...reg.get("upgrades"), horse: true }); say("Caballo (sale al entrar a una ruta)"); break;
      case 7: reg.set("upgrades", { ...reg.get("upgrades"), escort: true, stashKit: true }); say("Arquera y herrajes de alijo"); break;
      case 8: reg.set("tonics", TONIC.max); say(`${TONIC.max} tónicos`); break;
      default: break;
    }
    tone(this, "pickup");
  }
}

export { BUSH };
