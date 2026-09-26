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
import { makeEnemy, Guard, updateNightSpawns } from "../entities/enemies.js";
import { Escort } from "../entities/escort.js";
import { DEPTH, TILE, VIEW_W, VIEW_H, PLAYER, ENEMY } from "../config.js";
import { hitstop, shake } from "../engine/juice.js"; // jugo del combate
import { startMusic, startAmbience } from "../music.js";
import { online, request, send, ownerOf, playersIn } from "../net/online.js";
import { NetWorld } from "../net/worldnet.js";
import { Daylight, setHour, hourOf, WAKE_HOUR, DAY_SECONDS } from "../engine/daylight.js"; // luz del día
import { Bandit } from "../entities/enemies.js"; // matones del Gremio (deuda con dientes)
import {
  BOAT_COLD, coldAt, meltHours, debtCuota, thugsPending, clearThugs, thugsCollect, checkRumors, addFame,
} from "../state.js"; // el tiempo corre en la ruta, deuda con dientes, rumores comprobados
import { Ambient } from "../engine/ambient.js"; // ambiente
import { textWidth } from "../art/font.js"; // letreros de salida
import { CART_ANCHOR } from "../art/creatures.js"; // yegua con carreta

// Sonido de los pasos según la letra de la celda (si no está, según el bioma).
const STEP_BY_CELL = { "=": "stone", B: "wood", _: "sand", s: "snow", i: "snow", "#": "stone", g: "stone" };
const STEP_BY_BIOME = { desert: "sand", snow: "snow" };
import { sfx, tone, duckTheme, restoreTheme, footstep, stinger } from "../sfx.js";
import { contracts as myContracts, contractBoard } from "../state.js"; // contratos del tablón de la posada
import {
  GOODS, TOWNS, UPGRADES, STONE, TRAVEL_DAYS, DEBT, AMBER_TAX, addHeartContainer, addHeat, ambushProtection, cargo, cargoOf,
  flag, gold, hasUpgrade, heal, heatLevel, hp, hurt, localHeat, loseStones, maxHp, pay, purchaseUpgrade, reputation,
  saveGame, setFlag, stones, visibleStones, contrabandVisible, confiscateVisible, capacity, fits, stashCount, emptyStash,
  STASH_RAID_HEAT, buyTonic, drinkTonic, tonics, TONIC, BOAT_FARE, passDays, recordSeen, maybeBreakRune, day, debt,
  debtDue, payDebt, missDebt, fameTitle, load, hearRumor, econ, chill,
  REFUGES, REFUGE_UPGRADES, CREW, LODGING, crewAt, setCrewAt, partyHas, partySize, lodgingFee, ownsRefuge, refugeHas,
  stashCapacity, crewIn, townTips, peddlerFor, peddlerOnline, sellToPeddler, buyFromPeddler,
  TUTORIAL, tutorialStep, setTutorialStep, INN_SLEEP,
} from "../state.js";

// La partida nueva empieza con dos líneas y el tutorial (el lore largo se quitó: 25-sep).
const INTRO = [
  "Tu padre murió debiéndole 500 al Gremio de la Corona. La deuda ahora es tuya: el cobrador pasa cada siete días.",
  "Las piedras de hechizo se compran donde sobran y se venden donde las ocupan. Empecemos por la plaza.",
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
    this.waySigns = [];
    this.wayNear = null;
    this.tutArrow = null;
  }

  create(data) {
    const reg = this.registry;
    this.def = MAPS[this.mapId];
    const def = this.def;
    reg.set("mapId", this.mapId);
    this.ui = this.scene.get("ui");
    this.fx = new Fx(this);
    this.controls = new Controls(this);

    // El tiempo corre con el reloj en todos los mapas (26-sep): llegar a pie ya no pasa días fijos.
    // La barca sí salta 3 días de mar.
    this.arrival = null;
    if (def.kind === "route") reg.set("lastRoute", this.mapId);
    if (def.kind === "town") {
      const prev = reg.get("currentTown");
      const route = reg.get("lastRoute");
      const boat = data?.boat;
      if (route || boat) {
        // En línea el tiempo lo lleva el reloj del mundo: tampoco la barca pasa días.
        const days = boat && !online.on ? TRAVEL_DAYS.boat : 0;
        const report = days ? passDays(reg, days, { cold: BOAT_COLD }) : { ended: [], started: [], melted: 0 };
        if (prev !== def.town) reg.inc("trips", 1);
        this.arrival = { days, from: prev !== def.town ? prev : null, route, ...report };
        // Resultados del viaje: contra lo que llevabas al salir del pueblo (tripStart). Las horas de
        // camino salen del reloj; la escarcha derretida se fue anotando en tripStart.melted.
        const start = reg.get("tripStart");
        if (route && start) {
          const hours = start.hour != null ? Math.max(0, (day(reg) - start.day) * 24 + hourOf(reg) - start.hour) : null;
          this.arrival.trip = { ...start, to: def.town, hours, trip: reg.get("trips") ?? 0, melted: start.melted ?? 0, heat: localHeat(reg, MAPS[route]) };
        }
      }
      reg.set("lastRoute", null);
      reg.set("tripStart", null);
      reg.set("currentTown", def.town);
      recordSeen(reg, def.town);
      // Los rumores de este pueblo se comprueban al llegar: los falsos se tachan en el mapa.
      this.rumorCheck = checkRumors(reg, def.town);
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
    this.net = online.on ? new NetWorld(this) : null;
    this.physics.add.collider(this.enemyGroup, this.world.layer);
    this.physics.add.collider(this.enemyGroup, this.world.statics);
    this.physics.add.collider(this.npcGroup, this.world.layer);
    this.physics.add.collider(this.npcGroup, this.world.statics);
    this.physics.add.collider(this.player.sprite, this.npcGroup);

    this.setupCrew();
    if (def.kind === "route") this.time.delayedCall(1200, () => this.checkRaids());
    // Deuda con dientes: tras la 3ª falta, dos matones del Gremio esperan en la siguiente ruta.
    if (def.kind === "route" && thugsPending(reg)) this.time.delayedCall(1600, () => this.spawnThugs());
    this.speedBonus = this.horseSpeed(); // yegua: ×1.1 en rutas, ×1.2 con herraduras
    // luz del día: velo por hora y luces en faroles, fogatas, fraguas y ventanas (las cuevas, noche suave).
    this.daylight = new Daylight(this, def);

    const cam = this.cameras.main;
    // Un mapa más chico que la pantalla (refugios) se centra, con fondo del color del lugar.
    const bw = Math.max(this.world.W, VIEW_W);
    const bh = Math.max(this.world.H, VIEW_H);
    cam.setBounds(-(bw - this.world.W) / 2, -(bh - this.world.H) / 2, bw, bh);
    if (bw > this.world.W || bh > this.world.H) cam.setBackgroundColor(def.dark ? 0x1b1422 : 0x16372a);
    cam.startFollow(this.player.sprite, true, 0.16, 0.16, 0, 12);
    cam.setRoundPixels(true);
    cam.fadeIn(260, 18, 14, 23);
    this.ambient = new Ambient(this); // ambiente: partículas por bioma y sombras de nube

    startMusic(this, def.music);
    startAmbience(this, def.ambience);
    this.ui.enterMap(def);
    this.refreshSigns();
    if (def.kind === "route") this.spawnPeddler();
    this.buildWaySigns();
    // Todo lo que sale al llegar va en la cola de la interfaz, uno tras otro (ver onArrival).
    if (this.intro) this.startTutorial();
    else if (tutorialStep(reg) >= 0) this.ui.showTutorial(tutorialStep(reg), { done: this.tutorialHalf });
    else this.ui.hideTutorial();
    if (this.arrival) this.onArrival();
    else if (def.kind === "town") this.ui.queueNotice(async () => { await this.ui.afterBanner(); this.showNeeds(); });
    if (def.kind === "route") this.tutorialEvent("route");

    this.debugOn = false;
    this.input.keyboard.on("keydown", this.onDebugKey, this);
    // El modo depuración sigue prendido al cambiar de mapa hasta que se apague con F1.
    if (reg.get("debugMode")) this.toggleDebug(true);
    this.events.once("shutdown", () => this.ui.prompt(null));
    // Con el tutorial andando, sus pasos ya dicen cómo correr y agacharse.
    if (def.kind === "route" && !flag(reg, "hint-route") && tutorialStep(reg) < 0) {
      setFlag(reg, "hint-route");
      this.time.delayedCall(2600, () => this.ui.toast(`${keyName("attack")} golpear · ${keyName("roll")} rodar (mantén: correr) · ${keyName("hide")} agacharse`, "font-o"));
      this.time.delayedCall(5400, () => this.ui.toast("En el pasto alto, agachado, nadie te ve", "font-green"));
    }
  }

  // ---------------------------------------------------------------- objetos

  spawnObjects() {
    const reg = this.registry;
    const heatNow = localHeat(reg, this.def);
    this.chests = [];
    this.levers = [];
    this.def.objects.forEach((spec, index) => {
      const px = spec.x * TILE;
      const py = spec.y * TILE;
      switch (spec.type) {
        case "npc": {
          if (spec.onlyIf && !flag(reg, spec.onlyIf)) break;
          // Sahra ya contratada no está en su puesto: anda contigo (o donde la dejaste).
          if (spec.role === "escort" && hasUpgrade(reg, "escort")) break;
          // En línea hay una sola Sahra: si ya la contrató otro, no está.
          if (spec.role === "escort" && online.on && online.world.hires?.sahra) break;
          const npc = new Npc(this, spec);
          this.npcs.push(npc);
          this.npcGroup.add(npc.sprite);
          npc.sprite.body.setImmovable(true);
          const it = { get x() { return npc.x; }, get y() { return npc.y; }, r: 18, label: spec.role === "market" ? "Comerciar" : "Hablar", act: () => this.talkTo(npc) };
          npc.it = it;
          this.interactables.push(it);
          if (spec.role === "inn" && this.def.kind === "town") this.spawnContractBoard(spec);
          break;
        }
        case "stash": {
          const built = online.on ? Boolean(ownerOf(spec.id)) : hasUpgrade(reg, "stashKit") && flag(reg, `stash-${spec.id}`);
          const img = this.add.sprite(px, py + 3, `stash-${spec.kind}`, built ? 1 : 0).setOrigin(0.5, 1).setDepth(py + 3);
          this.world.addSolid(px - 9, py - 6, 18, 8);
          const it = { x: px, y: py, r: 20, label: "Alijo", act: () => this.useStash(spec, img) };
          this.interactables.push(it);
          this.stashes.push({ spec, img });
          break;
        }
        case "refuge": {
          const info = REFUGES[spec.id];
          const owned = online.on ? Boolean(ownerOf(spec.id)) : ownsRefuge(reg, spec.id);
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
          this.interactables.push({ x: px, y: py + 6, r: 22, get label() { return ownsRefuge(reg, spec.id) ? "Entrar" : ownerOf(spec.id) ? "Tocar" : "Mirar"; }, act: () => this.useRefugeDoor(spec, img) });
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
          this.chests.push({ spec, img, it });
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
          this.levers.push({ spec, img, it });
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
          // El mismo número en todos los aparatos: su lugar en la lista del mapa.
          e.netId = index;
          e.spawnState = e.state;
          this.enemies.push(e);
          this.enemyGroup.add(e.sprite);
          break;
        }
        default:
          break;
      }
    });
    // Noche: más bandidos y lobos (solo jugando solo). Se revisa cada segundo por si cae la noche o amanece.
    updateNightSpawns(this, true);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => updateNightSpawns(this) });
  }

  /** En línea: cofres, palancas, rejas, refugios y la arquera cambian cuando otro jugador los toca. */
  applyWorldFlags() {
    const reg = this.registry;
    for (const c of this.chests ?? []) {
      if (flag(reg, `chest-${c.spec.id}`) && !c.it.hidden) { c.img.setFrame(1); c.it.hidden = true; }
    }
    for (const l of this.levers ?? []) {
      if (!flag(reg, l.spec.id) || l.it.hidden) continue;
      l.img.setFrame(1);
      l.it.hidden = true;
      const gate = this.gates?.[l.spec.id];
      if (gate?.bar.body.enable) { gate.img.setFrame(1); gate.bar.body.enable = false; this.fx.poof(gate.x, gate.y + 8); sfx(this, "lever", { volume: 0.4 }); }
    }
    for (const s of this.stashes ?? []) {
      const taken = Boolean(ownerOf(s.spec.id));
      if (taken) s.img.setFrame(1);
      if (s.refuge && s.spec.bar) s.spec.bar.body.enable = !ownsRefuge(reg, s.spec.id);
    }
    if (online.world.hires?.sahra && online.world.hires.sahra !== online.name) {
      const sahra = this.npcs.find((n) => n.spec.role === "escort");
      if (sahra && sahra.sprite.active) {
        sahra.sprite.destroy();
        sahra.shadow?.destroy();
        if (sahra.it) sahra.it.hidden = true;
        this.npcs = this.npcs.filter((n) => n !== sahra);
      }
    }
  }

  // ---------------------------------------------------------------- blancos de los enemigos

  /** A quién persigue un enemigo: solo, a ti; en línea, al jugador más cercano del mapa. */
  targetFor(enemy) {
    if (!this.net || enemy.thug) return this.player; // los matones del Gremio vienen por ti

    let best = this.player;
    let bd = this.player.state === "ko" ? Infinity : Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
    for (const t of this.net.targets()) {
      if (t === this.player || t.state === "ko") continue;
      const d = Math.hypot(t.x - enemy.x, t.y - enemy.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  damageTarget(t, halves, source, opts) {
    if (t && t.remote) this.net?.damageRemote(t, halves, source, opts);
    else this.damagePlayer(halves, source, opts);
  }

  targetBusy(t) {
    return t?.remote ? t.busy : this.modal;
  }

  cargoOfTarget(t) {
    return t?.remote ? t.cargo : this.cargoCount();
  }

  visibleOfTarget(t) {
    return t?.remote ? t.vis : this.visibleCargo();
  }

  /** Cuánto más rápido vas con la yegua en una ruta (herraduras: ×1.2). */
  horseSpeed() {
    const reg = this.registry;
    if (this.def.kind !== "route" || !partyHas(reg, "horse")) return 1;
    return hasUpgrade(reg, "horseshoes") ? 1.2 : 1.1;
  }

  addHorse() {
    this.trail = [];
    // Con carreta: una tira por vista (cart-side/down/up) y el origen donde pisa la yegua.
    this.hasCart = hasUpgrade(this.registry, "cart");
    this.cartWait = null;
    this.horse = this.add.sprite(this.player.x - 20, this.player.y, this.hasCart ? "cart-side" : "horse", 0).setOrigin(0.5, 1);
    if (this.hasCart) this.setHorseView("side");
    this.horseShadow = this.add.image(this.horse.x, this.horse.y, "shadow-big").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1);
    this.speedBonus = this.horseSpeed();
  }

  /** Con carreta cada vista es otra textura con otro tamaño: se cambia y se ajusta el origen. */
  setHorseView(view) {
    const h = this.horse;
    if (!this.hasCart) return;
    const key = `cart-${view}`;
    if (h.texture.key !== key) h.setTexture(key, 0);
    const [ax, ay] = CART_ANCHOR[view];
    h.setOrigin(ax / h.frame.width, ay / h.frame.height);
  }

  /**
   * ¿La carreta no pasa por aquí? Bordes de salto, hielo y senderos de bosque (celda con bosque
   * tupido o pinos a menos de 2 celdas por los dos lados). La calzada ancha sí pasa.
   */
  cartBlockedAt(x, y) {
    const w = this.world;
    const cx = Math.floor(x / TILE);
    const cy = Math.floor((y - 2) / TILE);
    const ch = w.at(cx, cy);
    if (ch === "^" || ch === "i") return true;
    const forest = (dx, dy) => [1, 2].some((k) => { const c = w.at(cx + dx * k, cy + dy * k); return c === "T" || c === "P"; });
    return (forest(-1, 0) && forest(1, 0)) || (forest(0, -1) && forest(0, 1));
  }

  updateHorse() {
    if (!this.horse) return;
    const p = this.player;
    // Carreta esperando: vuelve a seguirte cuando regresas junto a ella por donde sí pasa.
    if (this.cartWait) {
      this.horse.anims.stop();
      if (Math.hypot(p.x - this.horse.x, p.y - this.horse.y) < 30 && !this.cartBlockedAt(p.x, p.y)) {
        this.cartWait = null;
        this.trail = [];
      } else {
        this.horse.setDepth(this.horse.y - 1);
        return;
      }
    }
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 16) {
      const t = this.trail[0];
      if (this.hasCart && this.def.kind === "route" && this.cartBlockedAt(t.x, t.y)) {
        // No cabe por el sendero ni salta el borde: se queda esperando donde está (como con el hielo).
        this.cartWait = { x: this.horse.x, y: this.horse.y };
        this.trail = [];
        this.horse.anims.stop();
        if (!this.cartWarned || this.time.now - this.cartWarned > 6000) {
          this.cartWarned = this.time.now;
          this.ui.toast("La carreta no pasa por aquí: la yegua te espera en el camino", "font-o");
        }
        return;
      }
      this.trail.shift();
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
      if (this.hasCart) {
        this.setHorseView(view);
        this.horse.play(`cart-${view}`, true);
      } else this.horse.play(`horse-${view}`, true);
    } else {
      this.horse.anims.stop();
    }
    this.horse.setDepth(this.horse.y - 1);
    this.horseShadow.setPosition(this.horse.x, this.horse.y);
  }

  // ---------------------------------------------------------------- bucle

  update(time, delta) {
    const dt = Math.min(delta, 50);
    this.daylight.update(delta); // luz del día: el reloj corre también con diálogos abiertos
    this.ambient?.update(dt); // ambiente
    this.controls.update();
    if (this.controls.pressed("debug")) this.toggleDebug();

    if (this.modal || this.leaving) {
      this.player.body.setVelocity(0, 0);
      if (!this.net?.auth) for (const e of this.enemies) if (!e.dead && !e.puppet) e.body?.setVelocity(0, 0);
      for (const n of this.npcs) n.freeze(); // NPC: quietos y sin caminar en su lugar
      this.ui.prompt(null);
      this.net?.update(dt, true);
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
    for (const e of this.enemies) if (!e.dead && !e.puppet) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.state === "down" || e.sprite.active);
    this.net?.update(dt, false);
    for (const n of this.npcs) n.update(dt);
    this.updatePickups(dt);
    this.updateHorse();
    this.updateBarrier(dt);
    this.ui.prompt(target && this.player.state === "move" ? target.label : null);
    this.updateGuides();
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
    // El retrato del diálogo: lo que diga con su nombre lleva su cara.
    this.ui.talkCast = npc.spec.cast;
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
        case "peddler":
          await this.peddlerTalk(npc);
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
      this.ui.talkCast = null;
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
      if (online.on && id === "escort" && gold(reg) >= item.cost) {
        const r = await request({ t: "hire", who: "sahra" });
        if (!r.ok) {
          await this.ui.say([`—Ya trabajo con ${r.by ?? "alguien más"}. Búscate otra escolta.`], { name });
          return;
        }
      }
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
    if (online.on) {
      const r = await request({ t: "claim", key: `chest-${spec.id}`, news: "abrió un cofre del camino." });
      if (!r.ok) {
        await this.ui.say(["Está vacío. Alguien llegó antes."]);
        return;
      }
    }
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
    // En línea la reja es del mundo: si ya la abrió otro, sólo se ve abierta.
    if (online.on && !(await request({ t: "claim", key: spec.id, news: "abrió la reja del farallón." })).ok) return;
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
        if (e.invuln > 0) continue;
        // Congelado antes del golpe, para que el enemigo que muere lo respete al aplastarse.
        const kills = !e.puppet && e.hp <= 1;
        hitstop(this, kills ? PLAYER.hitstop.kill : PLAYER.hitstop.hit, e);
        if (e.hit(1, c.x, c.y)) shake(this, kills ? "kill" : "hit");
      }
    }
    const x0 = Math.floor(rect.x / TILE);
    const x1 = Math.floor((rect.right - 1) / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const y1 = Math.floor((rect.bottom - 1) / TILE);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (this.applyCut(`g:${x},${y}`, true)) this.net?.cut(`g:${x},${y}`);
        if (this.applyCut(`b:${x},${y}`, true)) this.net?.cut(`b:${x},${y}`);
      }
    }
  }

  /** Corta pasto alto ("g:x,y") o un arbusto ("b:x,y"). `mine`: lo cortaste tú (suena y puede soltar algo). */
  applyCut(key, mine) {
    const [kind, pos] = key.split(":");
    const [x, y] = pos.split(",").map(Number);
    if (kind === "g") {
      const g = this.world.tallGrass.get(pos);
      if (!g || g.cut) return false;
      g.cut = true;
      g.img.anims.stop();
      g.img.setTexture("cutgrass").setOrigin(0, 1);
      if (mine) {
        this.fx.grassBurst(x * TILE + 8, (y + 1) * TILE);
        tone(this, "cut");
        this.maybeDrop(x * TILE + 8, y * TILE + 10, 0.12);
      }
      return true;
    }
    const bush = this.world.bushes.get(pos);
    if (!bush || bush.cut) return false;
    bush.cut = true;
    bush.img.destroy();
    this.world.layer.removeTileAt(x, y);
    this.fx.grassBurst(x * TILE + 8, (y + 1) * TILE, true);
    if (mine) {
      sfx(this, "chop", { volume: 0.35 });
      this.maybeDrop(x * TILE + 8, y * TILE + 10, 0.3);
    }
    return true;
  }

  damagePlayer(halves, source, { steal = false } = {}) {
    const reg = this.registry;
    const s = source.center ? source.center() : source;
    // Empujón según quién pega (el guardia más fuerte); una embestida pega más y sacude más.
    const charged = source.state === "charge";
    const push = (ENEMY[source.kind ?? source.spec?.kind]?.push ?? PLAYER.knockback) * (charged ? 1.2 : 1);
    if (!this.player.hurt(halves, s.x, s.y, push)) return;
    hitstop(this, PLAYER.hitstop.hurt, source.sprite ? source : null);
    shake(this, charged ? "charge" : "hurt");
    hurt(reg, halves);
    if (maybeBreakRune(reg)) {
      this.fx.float(this.player.x, this.player.y - 26, "¡crac!", "font-red");
      this.ui.toast("Se rompió un vidrio rúnico", "font-red");
      sfx(this, "chop", { volume: 0.3 });
    }
    if (steal && !source.thug && stones(reg) > 0) { // los matones no roban piedras: cobran
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

  spawnPickup(kind, x, y, { good, value = 1, dx, dy, netId } = {}) {
    const key = kind === "stone" ? `gem-${good}` : kind === "heart" ? "heart-full" : "coin";
    const img = kind === "coin" ? this.add.sprite(x, y, "coin", 0).play("coin") : this.add.image(x, y, key);
    img.setOrigin(0.5, 1).setDepth(y);
    const shadow = this.add.image(x, y, "shadow").setOrigin(0.5, 0.6).setDepth(DEPTH.decal + 1).setScale(0.6);
    const tx = x + (dx ?? (Math.random() - 0.5) * 20);
    const ty = y + (dy ?? (Math.random() - 0.5) * 12);
    const p = { kind, good, value, img, shadow, x: tx, y: ty, age: 0, ready: false, netId };
    // En línea lo que cae al suelo lo ven y lo pueden levantar todos.
    if (this.net && !netId) {
      p.netId = this.net.newPickupId();
      this.net.sharePickup(p);
    }
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
        if (p.kind === "stone" && !fits(reg, p.good)) continue;
        if (p.netId && this.net) {
          // El servidor dice quién llegó primero; mientras, no se vuelve a pedir.
          if (p.claiming) continue;
          p.claiming = true;
          this.net.claimPickup(p).then((ok) => {
            if (p.taken) return;
            if (ok) this.collectPickup(p);
            else this.removePickup(p);
          });
          continue;
        }
        this.collectPickup(p);
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);
  }

  collectPickup(p) {
    const reg = this.registry;
    if (p.kind === "stone") {
      if (!fits(reg, p.good)) { p.claiming = false; return; }
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
    if (p.netId && this.net) send({ t: "pickTake", map: this.mapId, id: p.netId });
    this.removePickup(p);
    return p.good;
  }

  banditEscaped(b) {
    if (b.carrying) this.ui.toast(`Un bandido escapó con 1 ${GOODS[b.carrying].short}`, "font-red");
  }

  onEnemyDefeated(e) {
    const reg = this.registry;
    if (e.thug) this.onThugDown(e);
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
    const t = guard.player();
    if (t?.remote) { this.net?.inspectRemote(guard, t); return; }
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
    if (guard.puppet) this.net?.enemyAct(guard, "clear");
    guard.suspicion = 0;
    guard.bubble?.destroy();
    guard.bubble = null;
    if (source === "barrier") this.setBarrier(true);
    else guard.setState("return");
    for (const e of this.enemies) if (e instanceof Guard && !e.hostile && e.state === "chase") { e.suspicion = 0; e.setState("return"); }
  }

  // ---------------------------------------------------------------- K.O.

  /**
   * K.O. con castigo real (26-sep): pierdes piedras y oro como siempre (los matones del Gremio, en
   * cambio, se cobran el 30 % del oro o la yegua), pasan 12 horas, la yegua se espanta y se queda en
   * esta ruta hasta que vuelvas por ella, y despiertas en tu refugio con catre de esta ruta (si
   * tienes) o en el último pueblo.
   */
  knockOut(source) {
    if (this.modal) return;
    this.runModal(async () => {
      const reg = this.registry;
      this.player.knockOut();
      duckTheme(this, 0.05);
      tone(this, "hurt");
      stinger("ko", this);
      await new Promise((r) => this.time.delayedCall(1100, r));
      const byThugs = Boolean(source?.thug);
      let lost = 0;
      let goldLost = 0;
      let took = null;
      if (byThugs) {
        took = thugsCollect(reg);
        this.thugsGone();
      } else {
        const total = stones(reg);
        const lose = Math.max(0, Math.ceil(total / 2) - ambushProtection(reg));
        lost = loseStones(reg, lose);
        goldLost = Math.floor(gold(reg) * 0.2);
        if (goldLost) reg.inc("gold", -goldLost);
      }
      const route = this.def.kind === "route" ? this.mapId : null;
      // La yegua se espanta y se queda en la ruta (si no se la llevó el Gremio).
      const scared = Boolean(route && partyHas(reg, "horse") && !took?.horse);
      if (scared) setCrewAt(reg, "horse", `scared:${route}`);
      const refuge = route
        ? Object.keys(REFUGES).find((id) => REFUGES[id].route === route && ownsRefuge(reg, id) && refugeHas(reg, id, "cot"))
        : null;
      const town = reg.get("currentTown") ?? "ashfen";
      // Se va medio día.
      const t = this.advanceClock(12, { cold: coldAt(this.def) });
      this.cameras.main.fadeOut(500, 18, 14, 23);
      await new Promise((r) => this.time.delayedCall(550, r));
      const where = refuge ? `en tu refugio, ${REFUGES[refuge].name}` : `en ${TOWNS[town].name}`;
      const lines = [online.on
        ? `Despiertas ${where}, con la cabeza zumbando.`
        : `Despiertas ${where}, medio día después, con la cabeza zumbando.${t.days ? ` Ya es el día ${day(reg)}.` : ""}`];
      if (byThugs) {
        lines.unshift("—El Gremio cobra. Por las buenas o por las malas.");
        if (took.gold) lines.push(`Los matones se cobraron ${took.gold} de oro. Te quedan ${debt(reg).owed} de deuda.`);
        else if (took.horse) lines.push(`No traías oro: se llevaron a la yegua. Nella la tiene en el establo de Valkeep (${DEBT.horseFine} oro).`);
      }
      if (lost) lines.push(`Te faltan ${lost} ${lost === 1 ? "piedra" : "piedras"}.`);
      if (goldLost) lines.push(`Y ${goldLost} de oro.`);
      if (t.melted) lines.push(`Se te derritió la escarcha (${t.melted}).`);
      if (scared) lines.push(`La yegua se espantó y se quedó en ${this.def.name}. Vuelve por ella.`);
      heal(reg);
      restoreTheme(this);
      await this.ui.say(lines);
      // Sin resultados de viaje: ya se contó todo aquí.
      reg.set("tripStart", null);
      saveGame(reg);
      this.leaving = true;
      this.scene.restart(refuge ? { map: refuge, entry: "door" } : { map: town, entry: "start" });
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
      await this.ui.say(["¿Vienes a pie por el Paso del Hielo? Qué valiente.", `Mi barca cruza el golfo hasta ${TOWNS[to].name} en una tarde. Desde hoy también paro en tu muelle.`], { name });
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
    this.cameras.main.fadeOut(300, 18, 14, 23);
    await new Promise((r) => this.time.delayedCall(320, r));
    await this.ui.boatTrip(this.def.town, to, online.on ? 0 : TRAVEL_DAYS.boat, day(reg));
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

  /**
   * Al llegar a un pueblo, en fila (cola de la interfaz): el cartel del lugar → los resultados del
   * viaje (o el aviso de días, si llegaste en barca) → el cobrador → "HOY EN …".
   */
  onArrival() {
    const reg = this.registry;
    const a = this.arrival;
    if (!a) return;
    const ui = this.ui;
    this.tutorialEvent("town");
    // Llegar tras el camino: fanfarria corta y, detrás, la campana del pueblo (suave).
    if (a.trip || a.days) {
      stinger("llegada", this);
      this.time.delayedCall(1600, () => this.sys.isActive() && sfx(this, "bell", { volume: 0.22 }));
    }
    ui.queueNotice(() => ui.afterBanner());
    if (a.trip) {
      ui.queueNotice(() => this.runModal(() => ui.tripReport(a.trip)));
    } else {
      if (a.days) ui.queueNotice(() => ui.noticeToast(`Pasaron ${a.days} ${a.days === 1 ? "día" : "días"} · día ${day(reg)}`, "font-gold"));
      if (a.melted) ui.queueNotice(() => ui.noticeToast(`Se te derritió la escarcha (${a.melted})`, "font-red"));
    }
    // Lo que oíste de este pueblo: aquí se ve si era cierto.
    if (this.rumorCheck?.falses?.length) ui.queueNotice(() => ui.noticeToast("El rumor de aquí era falso: tachado en el mapa", "font-red"));
    if (this.rumorCheck?.trues?.length) ui.queueNotice(() => ui.noticeToast("Lo que se decía de aquí era cierto", "font-green"));
    ui.queueNotice(async () => {
      if (debtDue(reg)) await this.runModal(() => this.debtCollector());
    });
    // Traes un contrato para aquí: que se sepa dónde se entrega.
    const here = myContracts(reg).filter((c) => c.to === this.def.town);
    if (here.length) {
      const ready = here.some((c) => cargoOf(reg, c.good) >= c.qty);
      ui.queueNotice(() => ui.noticeToast(ready ? "Contrato: entrégalo en el mercado" : "Contrato para aquí: te faltan piedras", ready ? "font-green" : "font-gold"));
    }
    ui.queueNotice(() => {
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

  // ---------------------------------------------------------------- el tiempo corre (26-sep)

  /** Cada hora del reloj (fuera de línea): la escarcha que llevas se derrite un poco. */
  onClockHour() {
    const reg = this.registry;
    const melted = meltHours(reg, 1, coldAt(this.def));
    if (!melted) return;
    this.noteTripMelt(melted);
    this.ui.toast(`Se te derritió la escarcha (${melted})`, "font-red");
  }

  /** Medianoche (fuera de línea): pasa un día donde estés, también en la ruta. */
  onMidnight() {
    if (online.on) return;
    const report = passDays(this.registry, 1, { cold: coldAt(this.def), meltCargo: false });
    this.afterNewDay(report);
  }

  /** Lo que se avisa al empezar un día: el día nuevo, sucesos que empiezan y, en un pueblo, el cobrador. */
  afterNewDay(report, { toast = true } = {}) {
    const reg = this.registry;
    const ui = this.ui;
    if (toast) ui.queueNotice(() => ui.noticeToast(`Amanece el día ${day(reg)}`, "font-gold"));
    for (const ev of report.started ?? []) {
      if (ev.label) ui.queueNotice(() => ui.noticeToast(`Se oye: ${ev.label.toLowerCase()}`, "font-o"));
    }
    if (this.def.kind === "town") {
      ui.queueNotice(async () => {
        if (debtDue(reg)) await this.runModal(() => this.debtCollector());
      });
      ui.queueNotice(() => {
        this.refreshSigns();
        this.showNeeds();
      });
    }
    saveGame(reg);
  }

  /** Lo que se derritió en camino cuenta para los resultados del viaje. */
  noteTripMelt(n) {
    const start = this.registry.get("tripStart");
    if (start) this.registry.set("tripStart", { ...start, melted: (start.melted ?? 0) + n });
  }

  /**
   * Adelanta el reloj `hours` horas de golpe (K.O., dormir): pasa los días que toquen y derrite la
   * escarcha de esas horas. En línea no hace nada (el reloj es de todos).
   */
  advanceClock(hours, { cold = 0 } = {}) {
    const reg = this.registry;
    if (online.on || hours <= 0) return { days: 0, melted: 0, started: [], ended: [] };
    const total = hourOf(reg) + hours;
    const days = Math.floor(total / 24);
    const melted = meltHours(reg, hours, cold);
    const report = days ? passDays(reg, days, { cold, meltCargo: false }) : { started: [], ended: [] };
    setHour(reg, total % 24);
    if (melted) this.noteTripMelt(melted);
    return { ...report, days, melted };
  }

  /** Dormir (posada o catre): despiertas a las 7 del día siguiente (o de hoy, si ya pasó la medianoche). */
  sleepUntilMorning() {
    const reg = this.registry;
    if (online.on) return { days: 0, melted: 0 };
    const h = hourOf(reg);
    const hours = h < WAKE_HOUR - 2 ? WAKE_HOUR - h : 24 - h + WAKE_HOUR;
    const t = this.advanceClock(hours, { cold: coldAt(this.def) });
    if (t.days) this.afterNewDay(t, { toast: false });
    return t;
  }

  // ---------------------------------------------------------------- matones del Gremio

  /**
   * Tras la 3ª falta, dos matones del Gremio (bandidos de morado, 4 golpes) salen a tu encuentro en
   * la siguiente ruta. No roban piedras: si te tumban, se cobran el 30 % del oro o la yegua.
   */
  spawnThugs() {
    const reg = this.registry;
    if (this.leaving || !this.sys.isActive() || this.def.kind !== "route" || !thugsPending(reg)) return;
    clearThugs(reg);
    const w = this.world;
    const p = this.player;
    const open = (c, r) => [":", "=", "s", ".", ",", "_"].includes(w.at(c, r)) && !w.solidAt(c * TILE + 8, r * TILE + 8);
    const spots = [];
    for (let r = 2; r < w.rows - 2; r += 1) {
      for (let c = 2; c < w.cols - 2; c += 1) {
        if (!open(c, r) || !open(c + 1, r) || !open(c, r + 1)) continue;
        const d = Math.hypot(c * TILE + 8 - p.x, r * TILE + 12 - p.y) / TILE;
        if (d >= 6 && d <= 11) spots.push({ c, r, d });
      }
    }
    if (!spots.length) return;
    // El primero de frente a donde vas; el segundo, a unos pasos de él.
    spots.sort((a, b) => a.d - b.d);
    const first = spots[Math.floor(spots.length / 2)];
    const second = spots.find((s) => Math.hypot(s.c - first.c, s.r - first.r) >= 2 && Math.hypot(s.c - first.c, s.r - first.r) <= 4) ?? spots[0];
    this.thugs = [];
    for (const s of [first, second].slice(0, DEBT.thugs)) {
      const e = new Bandit(this, { type: "enemy", kind: "bandit", x: s.c + 0.5, y: s.r + 0.8, dir: "down" });
      e.thug = true;
      e.hp = DEBT.thugHp;
      e.cast = "thug";
      e.sprite.setTexture("cast-thug", e.sprite.frame.name);
      e.puppet = false; // en línea son sólo tuyos: no se sincronizan
      e.faceToward(p.x, p.y);
      e.setState("chase");
      e.showBubble("bubble-alert", 900);
      this.fx.poof(e.x, e.y - 6);
      this.enemies.push(e);
      this.enemyGroup.add(e.sprite);
      this.thugs.push(e);
    }
    duckTheme(this, 0.12);
    this.time.delayedCall(2200, () => restoreTheme(this));
    sfx(this, "horn", { volume: 0.3 });
    this.ui.toast("¡Matones del Gremio! Vienen a cobrar", "font-red");
    saveGame(reg);
  }

  /** Tumbaste a un matón. Si caen todos, se van de vacío (la deuda sigue ahí). */
  onThugDown(e) {
    this.thugs = (this.thugs ?? []).filter((t) => t !== e && !t.dead);
    if (!this.thugs.length) this.ui.toast("Los matones se van de vacío. La deuda sigue", "font-gold");
  }

  /** Los matones cobraron: se retiran. */
  thugsGone() {
    for (const t of this.thugs ?? []) {
      if (t.dead) continue;
      t.dead = true;
      t.destroy();
    }
    this.thugs = [];
  }

  // ---------------------------------------------------------------- buhonero de camino

  /**
   * A veces anda un buhonero por la ruta (una tirada por ruta y por día). Se para sobre el camino,
   * lejos de la entrada, de los enemigos, del retén y de las salidas.
   */
  async spawnPeddler() {
    const reg = this.registry;
    const route = this.mapId;
    let p;
    if (online.on) {
      p = await peddlerOnline(reg, route);
      // Mientras contestaba el servidor pudiste cambiar de mapa (la escena se reutiliza).
      if (this.mapId !== route || !this.sys.isActive() || this.leaving) return;
    } else {
      p = peddlerFor(reg, route);
    }
    if (!p || this.npcs.some((n) => n.spec.role === "peddler")) return;
    let spot = p.spot;
    if (!spot) {
      const w = this.world;
      const far = (x, y, list, d) => list.every((o) => Math.hypot(o.x - x, o.y - y) > d * TILE);
      const enemies = this.enemies.map((e) => ({ x: e.x ?? e.sprite.x, y: e.y ?? e.sprite.y }));
      const posts = this.def.objects.filter((o) => ["barrier", "gate", "lever", "stash", "refuge"].includes(o.type)).map((o) => ({ x: o.x * TILE, y: o.y * TILE }));
      const exits = (this.def.exits ?? []).map((e) => ({ x: (e.x + e.w / 2) * TILE, y: (e.y + e.h / 2) * TILE }));
      const open = (c, r) => [":", "=", "s"].includes(w.at(c, r)) && !w.solidAt(c * TILE + 8, r * TILE + 8);
      const spots = [];
      for (let r = 4; r < w.rows - 4; r += 1) {
        for (let c = 3; c < w.cols - 3; c += 1) {
          if (!open(c, r) || !open(c - 1, r) || !open(c + 1, r) || !open(c, r - 1) || !open(c, r + 1)) continue;
          const x = c * TILE + 8;
          const y = r * TILE + 12;
          if (!far(x, y, [this.player], 12) || !far(x, y, enemies, 7) || !far(x, y, posts, 6) || !far(x, y, exits, 8)) continue;
          spots.push({ x: (c * TILE + 8) / TILE, y: (r * TILE + 12) / TILE });
        }
      }
      if (!spots.length) return;
      spot = spots[(p.day * 7 + p.name.length * 13) % spots.length];
      if (online.on) {
        // El primero que lo propone se queda; los demás usan el que guardó el servidor.
        const r = await request({ t: "peddler", route, op: "spot", spot });
        if (this.mapId !== route || !this.sys.isActive() || this.leaving) return;
        if (r.ok && r.p?.spot) spot = r.p.spot;
        if (this.npcs.some((n) => n.spec.role === "peddler")) return;
      }
      reg.set("peddler", { ...(reg.get("peddler") ?? p), spot });
    }
    const npc = new Npc(this, { type: "npc", cast: "peddler", name: p.name, x: spot.x, y: spot.y, dir: "down", role: "peddler", talk: [] });
    this.npcs.push(npc);
    this.npcGroup.add(npc.sprite);
    npc.sprite.body.setImmovable(true);
    this.interactables.push({ get x() { return npc.x; }, get y() { return npc.y; }, r: 18, label: "Comerciar", act: () => this.talkTo(npc) });
    // Burbuja con una moneda: se ve de lejos que ahí se compra y se vende.
    const box = this.add.container(Math.round(npc.x), Math.round(npc.y - 27)).setDepth(DEPTH.fx);
    box.add(this.add.image(0, 0, this.ui.panelKey("ui-tag", 16, 16)).setOrigin(0.5, 1));
    box.add(this.add.sprite(0, -3, "coin", 0).setOrigin(0.5, 1));
    this.tweens.add({ targets: box, y: box.y - 2, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.peddlerSign = box;
    this.time.delayedCall(1500, () => this.ui.toast(`Por aquí anda un buhonero: ${p.name}`, "font-gold"));
  }

  async peddlerTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const short = (g) => GOODS[g].short.toLowerCase();
    await this.ui.say([`¡Buenas! Soy ${name}, ando de camino en camino.`, "Te compro caro y te vendo barato. Poquito, eso sí."], { name });
    let last = null;
    for (;;) {
      const p = reg.get("peddler");
      const have = cargoOf(reg, p.buys.good);
      const broke = gold(reg) < p.sells.price;
      const full = !fits(reg, p.sells.good);
      const pick = await this.ui.choose(`${name}, buhonero`, [
        {
          label: `Venderle ${short(p.buys.good)} · ${p.buys.price} oro`,
          disabled: !have || p.buys.left <= 0,
          note: p.buys.left <= 0 ? "Ya no quiere más." : have ? `Llevas ${have}. Te compra hasta ${p.buys.left}.` : `No llevas ${short(p.buys.good)}.`,
        },
        {
          label: `Comprarle ${short(p.sells.good)} · ${p.sells.price} oro`,
          disabled: p.sells.left <= 0 || broke || full,
          note: p.sells.left <= 0 ? "Ya no le quedan." : `Le quedan ${p.sells.left}.${broke ? " No te alcanza." : full ? " No te cabe." : ""}`,
        },
        { label: "Adiós" },
      ], { start: last });
      last = pick;
      if (pick === 0) {
        const r = sellToPeddler(reg);
        if (r) {
          sfx(this, "coins-sell", { volume: 0.5 });
          this.ui.toast(`+${r.price} oro`, "font-gold");
        }
      } else if (pick === 1) {
        const r = buyFromPeddler(reg);
        if (r) {
          sfx(this, "gem", { volume: 0.5 });
          this.ui.toast(`-${r.price} oro · ${r.good.short}`, "font-o");
        }
      } else {
        break;
      }
      saveGame(reg);
    }
    await this.ui.say(["¡Buen camino! Otro día quizá me topas en otra ruta."], { name });
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

  /**
   * El cobrador. Deuda con dientes (26-sep): las faltas seguidas cuentan. 1ª: aviso; 2ª: +10 % de lo
   * que debes; 3ª y siguientes: matones en la siguiente ruta. Pagar la cuota borra las faltas.
   * Pagar todo: "Mercader libre".
   */
  async debtCollector() {
    const reg = this.registry;
    const d = debt(reg);
    const cuota = debtCuota(reg);
    const name = "Cobrador del Gremio";
    const missed = d.missed ?? 0;
    stinger("cobrador", this);
    const warn = missed >= 2 ? "Ya van dos. A la próxima no vengo yo." : missed === 1 ? "La vez pasada no pagaste." : null;
    await this.ui.say(["Un hombre con el sello del Gremio te cierra el paso.", `—Le debes ${d.owed} al Gremio. Toca la cuota: ${cuota}.`, ...(warn ? [`—${warn}`] : [])], { name, cast: null });
    const g = gold(reg);
    const next = missed + 1;
    const missNote = next >= DEBT.thugsAt ? "Sube 10 % y el Gremio manda matones" : next === 2 ? "Sube 10 % de lo que debes" : `Sube ${DEBT.interest} y la próxima mandan a alguien`;
    const options = [
      { id: "cuota", label: `Pagar la cuota · ${cuota}`, disabled: g < cuota, note: `Vuelvo en ${DEBT.every} días` },
      { id: "all", label: `Pagar todo · ${d.owed}`, disabled: g < d.owed, note: "Y quedas libre" },
    ];
    // Con algo de oro pero sin la cuota: abonar lo que traes (cuenta como falta, sin intereses).
    if (g > 0 && g < cuota) options.push({ id: "part", label: `Darle lo que traigo · ${g}`, note: "Cuenta como falta, pero sin intereses" });
    options.push({ id: "miss", label: "No tengo", note: missNote });
    const opt = options[await this.ui.choose("Deuda con el Gremio", options, { name })] ?? options[options.length - 1];
    if (opt.id !== "miss") {
      const r = payDebt(reg, opt.id === "cuota" ? cuota : opt.id === "all" ? d.owed : g);
      sfx(this, "coins");
      if (r.free) {
        await this.freeMerchant(name);
      } else if (opt.id === "part") {
        tone(this, "deny");
        await this.ui.say([`—Algo es algo. Quedan ${debt(reg).owed}.`, `—Vuelvo el día ${debt(reg).due}.`, ...this.debtThreat(r.missed)], { name, cast: null });
      } else {
        await this.ui.say([`—Quedan ${debt(reg).owed}. Nos vemos el día ${debt(reg).due}.`], { name, cast: null });
      }
    } else {
      const nd = missDebt(reg);
      tone(this, "deny");
      await this.ui.say([`—Mala respuesta. Son ${nd.added} más: ahora debes ${nd.owed}.`, `—Vuelvo el día ${nd.due}. Ten el oro.`, ...this.debtThreat(nd.missed)], { name, cast: null });
    }
    saveGame(reg);
  }

  /** Lo que dice el cobrador según las faltas seguidas. */
  debtThreat(missed) {
    if (missed >= DEBT.thugsAt) return ["—El Gremio ya mandó a sus muchachos. Te esperan en el camino."];
    if (missed === 2) return ["—Dos faltas. Lo que debes ya cobra intereses: diez por ciento cada vez.", "(Una falta más y el Gremio manda matones.)"];
    if (missed === 1) return ["—La próxima vez que no pagues, el Gremio manda a alguien."];
    return [];
  }

  /** Pagaste toda la deuda: Mercader libre. Fama, ceremonia y nunca más cobrador. */
  async freeMerchant(name) {
    const reg = this.registry;
    setFlag(reg, "debt-paid");
    duckTheme(this, 0.05);
    sfx(this, "jingle-free", { volume: 0.55 });
    this.time.delayedCall(3500, () => restoreTheme(this));
    await this.ui.say(["—Cuenta saldada. El Gremio ya no te busca.", "El cobrador rompe el pagaré de tu padre frente a ti."], { name, cast: null });
    await this.ui.freeCeremony(DEBT.freeFame);
    addFame(reg, DEBT.freeFame);
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
    if (online.on) {
      const owner = ownerOf(spec.id);
      if (owner && !ownsRefuge(reg, spec.id)) {
        await this.ui.say([`Un alijo con tapa clavada. Es de ${owner}.`, "Si te invita, lo puedes usar."]);
        return;
      }
      if (!owner) {
        const r = await request({ t: "own", id: spec.id });
        if (!r.ok) { await this.ui.say([`Alguien se te adelantó: ahora es de ${r.owner ?? "otro"}.`]); return; }
        img.setFrame(1);
        tone(this, "chest");
        sfx(this, "latch", { volume: 0.4 });
        await this.ui.say(["Clavas la tapa y la atas con soga. Este alijo es tuyo."]);
      } else if (ownerOf(spec.id) === online.name && (await this.inviteMenu(spec.id, "Alijo")) === "cancel") return;
    } else if (!flag(reg, key)) {
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
        continue;
      }
      const lost = emptyStash(reg, spec.id);
      stinger("redada", this);
      this.ui.toast(`Redada: la Corona encontró tu refugio (${lost} piedras)`, "font-red");
      saveGame(reg);
      // Sigue revisando: con dos refugios en la misma ruta se evalúan los dos.
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
    // La yegua que se espantó cuando caíste aquí te estaba esperando.
    if (def.kind === "route" && crewAt(reg, "horse") === `scared:${this.mapId}`) {
      setCrewAt(reg, "horse", "party");
      this.time.delayedCall(900, () => this.ui.toast("La yegua te estaba esperando, todavía asustada", "font-green"));
    }
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
    const cart = who === "horse" && hasUpgrade(this.registry, "cart");
    const sprite = who === "horse"
      ? (cart ? this.add.sprite(x, y, "cart-down", 0).setOrigin(CART_ANCHOR.down[0] / 32, 1) : this.add.sprite(x, y, "horse", 4).setOrigin(0.5, 1))
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

  /**
   * Tablón de contratos junto al posadero (M4): se busca un hueco libre a un lado (sin pared ni otro
   * objeto) y se pone el tablón con su letrero "Contratos". Con pliegos si hoy queda algo que tomar.
   */
  spawnContractBoard(spec) {
    const reg = this.registry;
    const town = this.def.town;
    const tries = [[1.7, -0.3], [-1.7, -0.3], [1.7, 0.8], [-1.7, 0.8], [0, -1.6], [2.6, 0], [-2.6, 0]];
    const busy = (x, y) => this.def.objects.some((o) => o !== spec && Math.abs(o.x - x) < 1.3 && Math.abs(o.y - y) < 1.3);
    // Libre: sin pared del mapa y sin tocar casas, cercas ni nada sólido (con 3 px de aire).
    const solids = this.world.statics.getChildren().map((r) => ({ x0: r.x - r.width / 2, y0: r.y - r.height / 2, x1: r.x + r.width / 2, y1: r.y + r.height / 2 }));
    const free = (px, py) => [[-9, -4], [9, -4], [-9, 3], [9, 3], [0, 0]].every(([dx, dy]) => !this.world.solidAt(px + dx, py + dy))
      && !solids.some((b) => px + 14 > b.x0 && px - 14 < b.x1 && py + 9 > b.y0 && py - 22 < b.y1);
    const spot = tries.map(([dx, dy]) => [spec.x + dx, spec.y + dy]).find(([x, y]) => !busy(x, y) && free(x * TILE, y * TILE));
    if (!spot) return;
    const px = Math.round(spot[0] * TILE);
    const py = Math.round(spot[1] * TILE);
    const any = () => contractBoard(reg, town).some((o) => !o.taken);
    const img = this.add.sprite(px, py + 6, "contract-board", any() ? 1 : 0).setOrigin(0.5, 1).setDepth(py + 6);
    this.world.addSolid(px - 9, py - 2, 18, 7);
    this.contractBoardImg = img;
    this.interactables.push({
      x: px, y: py + 4, r: 20, label: "Contratos",
      act: () => this.runModal(async () => {
        await this.ui.contractBoard(town);
        img.setFrame(any() ? 1 : 0);
      }),
    });
  }

  /** Posadero: aquí se queda tu gente (cobra por día) y se oyen los rumores más confiables. */
  async innTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const here = `inn:${this.def.town}`;
    const guests = Object.keys(CREW).filter((w) => crewAt(reg, w) === here);
    const r = hearRumor(reg, 0.95);
    await this.ui.say([...(npc.spec.talk ?? []), r.text], { name });
    // El tablón de contratos (también se lee directo, junto al posadero) y una noche de cama.
    const open = contractBoard(reg, this.def.town).filter((o) => !o.taken).length;
    const bed = await this.ui.choose("Posada", [
      { label: `Tablón de contratos · ${open ? `${open} ${open === 1 ? "nuevo" : "nuevos"}` : "nada hoy"}`, note: "Lleva piedras a otro pueblo por buena paga y fama" },
      { label: `Dormir · ${INN_SLEEP} oro`, disabled: gold(reg) < INN_SLEEP, note: online.on ? "Te curas (en línea el día no se salta)" : "Te curas y despiertas a las 7 del día siguiente" },
      { label: "Ahora no" },
    ]);
    if (bed === 0) await this.ui.contractBoard(this.def.town);
    if (bed === 1) await this.sleepAtInn();
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

  /** Dormir en la posada: fundido a negro, el reloj corre hasta las 7 del día siguiente, cura y cobra. */
  async sleepAtInn() {
    const reg = this.registry;
    if (!pay(reg, INN_SLEEP)) return false;
    sfx(this, "coins", { volume: 0.4 });
    this.cameras.main.fadeOut(450, 0, 0, 0);
    await new Promise((r) => this.time.delayedCall(700, r));
    // En línea el día no se salta: el reloj es de todos.
    const report = this.sleepUntilMorning();
    heal(reg);
    recordSeen(reg, this.def.town);
    saveGame(reg);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.ui.toast(`Dormiste. Día ${day(reg)}`, "font-gold");
    if (report.melted) this.ui.toast(`Se te derritió la escarcha (${report.melted})`, "font-red");
    // Si amaneció otro día, sleepUntilMorning ya dejó en la cola el cobrador y lo que quiere el pueblo.
    return true;
  }

  /** Nella vende mejoras para la yegua: alforjas, herraduras y la carreta (M11). */
  async horseGearShop(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const ids = ["saddlebags", "horseshoes", "cart"].filter((id) => !hasUpgrade(reg, id));
    if (!ids.length) return;
    const options = ids.map((id) => {
      const u = UPGRADES[id];
      const locked = reputation(reg) < u.reputation;
      return { id, label: locked ? `${u.name} (fama ${u.reputation})` : `${u.name} · ${u.cost} oro`, disabled: locked || gold(reg) < u.cost, note: u.effect };
    });
    const pick = await this.ui.choose("Nella, caballeriza", [...options, { label: "Nada por ahora" }], { name });
    const choice = options[pick];
    if (!choice) return;
    const res = purchaseUpgrade(reg, choice.id);
    tone(this, res.ok ? "chest" : "deny");
    if (res.ok) sfx(this, "coins");
    const extra = !res.ok ? []
      : choice.id === "cart" ? ["Aguanta cuatro cargas más. Pero por los senderos del bosque no cabe, ni brinca bordes: ahí la yegua te espera en el camino."]
      : choice.id === "horseshoes" ? ["Con herraduras nuevas pisa firme y va más ligera por la calzada."]
      : ["Unas alforjas de cuero: un lugar más."];
    await this.ui.say([res.reason, ...extra], { name });
    // La yegua que ya te sigue se engancha a la carreta en el momento.
    if (res.ok && choice.id === "cart" && this.horse) {
      const { x, y } = this.horse;
      this.horse.destroy();
      this.horseShadow.destroy();
      this.addHorse();
      this.horse.setPosition(x, y);
    }
    this.speedBonus = this.horseSpeed();
    saveGame(reg);
  }

  /** Nella: además de vender la yegua, la cuida en el establo. */
  async stableTalk(npc) {
    const reg = this.registry;
    const name = npc.spec.name;
    const at = crewAt(reg, "horse");
    // Embargada por el Gremio: vuelve pagando la multa.
    if (at === "seized") {
      await this.ui.say(["Los del Gremio me dejaron tu yegua en prenda.", `Me dijeron que te la diera cuando pagaras ${DEBT.horseFine}.`], { name });
      const pick = await this.ui.choose("Tu yegua, embargada", [
        { label: `Pagar y llevármela · ${DEBT.horseFine} oro`, disabled: gold(reg) < DEBT.horseFine },
        { label: "Ahora no" },
      ], { name });
      if (pick !== 0 || !pay(reg, DEBT.horseFine)) return;
      setCrewAt(reg, "horse", "party");
      sfx(this, "coins");
      this.addHorse();
      this.horse.setPosition(npc.x - 18, npc.y + 6);
      this.followerTalkable("horse");
      saveGame(reg);
      return;
    }
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
      await this.horseGearShop(npc);
      return;
    }
    const where = at?.startsWith("refuge:") ? REFUGES[at.slice(7)]?.name
      : at?.startsWith("wait:") ? "afuera de una cueva"
      : at?.startsWith("scared:") ? `${MAPS[at.slice(7)]?.name ?? "un camino"}, espantada` : "por ahí";
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
    if (online.on && ownerOf("refugio-r3")) {
      await this.ui.say([`Ya se lo vendí a ${ownerOf("refugio-r3")}.`, "Si te invita, te dejo pasar."], { name });
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
    if (online.on) {
      const r = await request({ t: "own", id: "refugio-r3", news: "compró una tierra escondida en la selva." });
      if (!r.ok) { await this.ui.say([`Uy, se me adelantó ${r.owner ?? "alguien"}. Ya es suya.`], { name }); return; }
    }
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
    if (online.on && ownerOf(spec.id)) {
      if (!ownsRefuge(reg, spec.id)) {
        await this.ui.say([`${info.name}: la puerta está cerrada.`, `Es de ${ownerOf(spec.id)}. Si te invita, puedes entrar.`]);
        return;
      }
      if (ownerOf(spec.id) === online.name && (await this.inviteMenu(spec.id, info.name)) === "cancel") return;
      this.enterMap(spec.id, "door");
      return;
    }
    if (!ownsRefuge(reg, spec.id)) {
      if (info.kind === "plot") {
        await this.ui.say(["Una reja entre la selva. Del otro lado se ve un claro.", "Es de Aurelio, el campesino de aquí al lado."]);
        return;
      }
      if (!hasUpgrade(reg, "stashKit")) {
        await this.ui.say(["Una cueva seca y honda. Aquí adentro nadie te vería.", "Con puerta y cerrojo sería tu refugio. Oskar, el herrero de Ashfen, hace herrajes."]);
        return;
      }
      if (online.on) {
        const r = await request({ t: "own", id: spec.id, news: `se quedó con la ${info.name}.` });
        if (!r.ok) { await this.ui.say([`Alguien se te adelantó: ${info.name} ya es de ${r.owner ?? "otro"}.`]); return; }
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

  /**
   * En línea, el dueño de un refugio o alijo puede invitar a los otros jugadores (o quitarles la
   * invitación). Devuelve "enter" para seguir, o "cancel".
   */
  async inviteMenu(id, title) {
    const invited = online.world.owners[id]?.invited ?? [];
    const others = [...new Set([...online.players.values()].map((p) => p.name).filter((n) => n && n !== online.name))];
    const options = [{ id: "enter", label: "Entrar" }];
    for (const n of others) options.push({ id: n, label: invited.includes(n) ? `Quitar la invitación a ${n}` : `Invitar a ${n}`, note: invited.includes(n) ? "Ya no podrá entrar ni usar el estante" : "Podrá entrar y usar el estante" });
    for (const n of invited.filter((x) => !others.includes(x))) options.push({ id: n, label: `Quitar la invitación a ${n}` });
    if (options.length === 1) return "enter";
    options.push({ id: "cancel", label: "Nada" });
    const pick = await this.ui.choose(title, options);
    const opt = options[pick];
    if (!opt || opt.id === "cancel") return "cancel";
    if (opt.id === "enter") return "enter";
    const on = !invited.includes(opt.id);
    const r = await request({ t: "invite", id, who: opt.id, on });
    tone(this, r.ok ? "confirm" : "deny");
    this.ui.toast(r.ok ? (on ? `${opt.id} ya puede entrar` : `${opt.id} ya no puede entrar`) : "No se pudo", r.ok ? "font-gold" : "font-red");
    return "cancel";
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
    if (online.on && !(await request({ t: "upgrade", id: spec.id, up: opt.id })).ok) {
      await this.ui.say(["No se pudo. ¿Sigues invitado?"]);
      return;
    }
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
    const pick = await this.ui.choose("Catre", [{ label: online.on ? "Descansar" : "Dormir hasta mañana", note: online.on ? "Te curas; el mundo sigue" : "Te curas y despiertas a las 7" }, { label: "Ahora no" }]);
    if (pick !== 0) return;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    await new Promise((r) => this.time.delayedCall(450, r));
    // En línea el día no se salta: el reloj es de todos.
    const report = this.sleepUntilMorning();
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

  /** Hacia dónde se sale por un borde: up, down, left o right. */
  exitDir(ex) {
    return ex.dir ?? (ex.y === 0 ? "up" : ex.x === 0 ? "left" : ex.x + ex.w >= this.world.cols ? "right" : "down");
  }

  checkExits() {
    const p = this.player;
    const cx = p.x / TILE;
    const cy = (p.y - 2) / TILE;
    for (const ex of this.def.exits ?? []) {
      if (cx >= ex.x - 0.3 && cx <= ex.x + ex.w + 0.3 && cy >= ex.y - 0.3 && cy <= ex.y + ex.h + 0.1) {
        const dir = this.exitDir(ex);
        const v = p.body.velocity;
        const moving = { up: v.y < 0, down: v.y > 0, left: v.x < 0, right: v.x > 0 }[dir];
        if (!moving) continue;
        this.leaving = true;
        this.ui.prompt(null);
        // Sales del pueblo a la ruta: se guarda cómo ibas, para los resultados del viaje al llegar.
        if (this.def.kind === "town" && MAPS[ex.to]?.kind === "route") {
          const reg = this.registry;
          reg.set("tripStart", { from: this.def.town, gold: gold(reg), stones: stones(reg), fame: reputation(reg), day: day(reg), hour: hourOf(reg), melted: 0 });
        }
        this.cameras.main.fadeOut(240, 18, 14, 23);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.restart({ map: ex.to, entry: ex.entry });
        });
        return;
      }
    }
  }

  // ---------------------------------------------------------------- salidas señaladas

  /**
   * A dónde lleva una salida y cuánto se tarda a pie ("Valkeep", ~3 h). Ya no hay días fijos por
   * ruta (26-sep): el tiempo corre con el reloj, así que se estima con el largo del camino.
   */
  exitInfo(ex) {
    const dest = MAPS[ex.to];
    if (!dest) return null;
    let name = dest.name;
    let hours = 0;
    if (dest.kind === "route" && this.def.kind === "town") {
      const other = dest.between.find((t) => t !== this.def.town) ?? dest.between[0];
      name = TOWNS[other].name;
      hours = this.walkHours(dest);
    }
    return { name, hours, label: `${name}${hours ? ` · ~${hours} h a pie` : ""}` };
  }

  /** Horas del juego para cruzar una ruta caminando (de boca a boca, con las vueltas del camino). */
  walkHours(route) {
    const mouths = (route.exits ?? []).filter((e) => MAPS[e.to]?.kind === "town");
    if (mouths.length < 2) return 0;
    const [a, b] = mouths;
    const tiles = Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
    const seconds = (tiles * TILE * 1.5) / (PLAYER.walk * (partyHas(this.registry, "horse") ? 1.1 : 1));
    const secondsPerDay = online.on ? (online.dayMs ?? 180000) / 1000 : DAY_SECONDS;
    return Math.max(1, Math.round((seconds * 24) / secondsPerDay));
  }

  /**
   * Un letrero con flecha junto a cada salida (a un lado del camino, donde haya piso libre) y,
   * encima, una placa con el destino y los días.
   */
  buildWaySigns() {
    const w = this.world;
    const OPEN = new Set([".", ",", ":", "=", "_", "s", "g", '"']);
    const free = (c, r) => {
      const cc = Math.floor(c);
      const rr = Math.floor(r);
      return cc >= 0 && rr >= 0 && cc < w.cols && rr < w.rows && OPEN.has(w.at(cc, rr)) && !w.solidAt(cc * TILE + 8, rr * TILE + 8);
    };
    const ARROW = { up: "↑", down: "↓", left: "←", right: "→" };
    for (const ex of this.def.exits ?? []) {
      const info = this.exitInfo(ex);
      if (!info) continue;
      const dir = this.exitDir(ex);
      // Lugares posibles (en celdas), del mejor al peor; la tabla apunta hacia la abertura.
      const spots = dir === "up" || dir === "down"
        ? [0.9, 1.9, -0.9, -1.9].map((d) => ({ c: d > 0 ? ex.x + ex.w + d - 1 : ex.x + d, r: dir === "up" ? ex.y + 3 : ex.y - 1.4, flip: d > 0 }))
        : [-1.2, -2.2, 1.2, 2.2].map((d) => ({ c: dir === "left" ? ex.x + 2 : ex.x - 1.5, r: d < 0 ? ex.y + d : ex.y + ex.h + d - 1, flip: dir === "left" }));
      const spot = spots.find((s) => free(s.c + 0.5, s.r + 0.5)) ?? spots[0];
      const px = Math.round((spot.c + 0.5) * TILE);
      const py = Math.round((spot.r + 1) * TILE);
      const sign = this.add.image(px, py, "way-sign").setOrigin(0.5, 1).setFlipX(spot.flip).setDepth(py);
      const text = `${ARROW[dir]} ${info.label}`;
      const tw = Math.ceil(textWidth(text) / 2) * 2 + 10;
      // La placa no se sale del mapa (en las salidas de los lados quedaría cortada).
      const tx = Phaser.Math.Clamp(px, tw / 2 + 2, w.W - tw / 2 - 2);
      const tag = this.add.container(tx, py - 22).setDepth(py + 1);
      tag.add(this.add.image(0, 0, this.ui.panelKey("ui-tag", tw, 13)).setOrigin(0.5, 1));
      tag.add(this.add.bitmapText(Math.round(-tw / 2) + 5, -11, "font-o", text));
      this.waySigns.push({ ex, info, sign, tag, x: (ex.x + ex.w / 2) * TILE, y: (ex.y + ex.h / 2) * TILE });
    }
    // Si entraste junto a una salida, su aviso no sale hasta que te alejes y vuelvas.
    const p = this.player;
    this.wayNear = this.waySigns.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 80) ?? null;
  }

  /** Cada cuadro: el aviso al acercarte a una salida y la flecha del tutorial. */
  updateGuides() {
    const p = this.player;
    let near = null;
    for (const s of this.waySigns) if (Math.hypot(s.x - p.x, s.y - p.y) < 48) near = s;
    if (near && this.wayNear !== near) {
      const h = near.info.hours;
      const eta = h ? `, ~${h} h a pie · llegas hacia las ${Math.round(hourOf(this.registry) + h) % 24} h` : "";
      this.ui.toast(`→ ${near.info.name}${eta}`, "font-gold");
    }
    if (near) this.wayNear = near;
    else if (this.wayNear && Math.hypot(this.wayNear.x - p.x, this.wayNear.y - p.y) > 80) this.wayNear = null;
    this.updateTutorial();
  }

  // ---------------------------------------------------------------- tutorial (partida nueva)

  /** Dos líneas de historia y el primer paso. Reemplaza a las siete páginas de lore. */
  startTutorial() {
    const reg = this.registry;
    setTutorialStep(reg, 0);
    setFlag(reg, "tutorial-ran", false);
    setFlag(reg, "tutorial-crouch", false);
    const lines = online.on
      ? [...INTRO, "Y no estás solo: otros contrabandistas andan por el golfo. Enter para escribirles; mantén T para hablarles."]
      : INTRO;
    this.ui.queueNotice(async () => {
      await this.ui.afterBanner();
      await this.runModal(() => this.ui.say(lines));
    });
    this.ui.queueNotice(() => {
      if (tutorialStep(reg) < 0) return;
      this.ui.showTutorial(tutorialStep(reg));
      tone(this, "confirm");
    });
  }

  /** En la ruta del tutorial ya corriste y te agachaste. */
  get tutorialHalf() {
    return flag(this.registry, "tutorial-ran") && flag(this.registry, "tutorial-crouch");
  }

  /** Algo que cuenta para el tutorial: "shop", "buy", "sell" (del mercado), "route", "town". */
  tutorialEvent(kind) {
    const reg = this.registry;
    const step = tutorialStep(reg);
    if (step < 0) return;
    let next = null;
    if (kind === "shop" && step === 0) next = 1;
    else if (kind === "buy" && step <= 1) next = 2;
    else if (kind === "route" && step <= 2) next = 3;
    else if (kind === "town" && step === 3) next = 4;
    else if (kind === "sell" && step === 4) { this.endTutorial(false); return; }
    if (next == null) return;
    setTutorialStep(reg, next);
    saveGame(reg);
    this.ui.showTutorial(next, { done: next === 3 && this.tutorialHalf });
    tone(this, "confirm");
  }

  /** Se acabó el tutorial (o se saltó desde la pausa). */
  endTutorial(skipped) {
    const reg = this.registry;
    setTutorialStep(reg, -1);
    if (!skipped) setFlag(reg, "hint-route");
    this.tutArrow?.setVisible(false);
    this.ui.hideTutorial();
    saveGame(reg);
    if (!skipped) {
      this.ui.queueNotice(() => {
        sfx(this, "jingle-mission", { volume: 0.4 });
        return this.ui.noticeToast("¡Listo! Compra donde sobra, vende donde ocupan y paga al cobrador", "font-gold");
      });
    }
  }

  /** A dónde apunta la flecha del paso: {x, y, dir} en el mundo (dir = hacia dónde apunta). */
  tutorialTarget(step) {
    const reg = this.registry;
    if (step === 0 || step === 1 || step === 4) {
      const m = this.npcs.find((n) => n.spec.role === "market");
      return m ? { x: m.x, y: m.y - 42, dir: "down" } : null; // encima de la burbuja con la gema
    }
    const town = reg.get("currentTown");
    const ex = step === 2
      ? (this.def.exits ?? []).find((e) => MAPS[e.to]?.kind === "route")
      : step === 3 ? (this.def.exits ?? []).find((e) => MAPS[e.to]?.kind === "town" && MAPS[e.to].town !== town) : null;
    if (!ex) return null;
    const dir = this.exitDir(ex);
    const [ix, iy] = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[dir];
    return { x: (ex.x + ex.w / 2) * TILE + ix * 18, y: (ex.y + ex.h / 2) * TILE + iy * 18, dir };
  }

  /** La flecha que rebota sobre el objetivo (o en el borde de la pantalla, apuntando hacia él). */
  updateTutorial() {
    const reg = this.registry;
    const step = tutorialStep(reg);
    // Paso de la ruta: se cumple a medias corriendo y agachándote; luego, a Valkeep.
    if (step === 3 && !this.tutorialHalf) {
      if (this.player.running) setFlag(reg, "tutorial-ran");
      if (this.player.crouching) setFlag(reg, "tutorial-crouch");
      if (this.tutorialHalf) { this.ui.showTutorial(3, { done: true }); tone(this, "confirm"); saveGame(reg); }
    }
    const t = step >= 0 ? this.tutorialTarget(step) : null;
    if (!t) { this.tutArrow?.setVisible(false); return; }
    if (!this.tutArrow) this.tutArrow = this.add.image(0, 0, "ui-guide-arrow").setDepth(DEPTH.ui - 1);
    const view = this.cameras.main.worldView;
    // Márgenes: arriba quedan el letrero del tutorial y el HUD; abajo, los avisos.
    const [ml, mr, mt, mb] = [12, 12, 30, 34];
    let { x, y, dir } = t;
    if (x < view.x + ml || x > view.right - mr || y < view.y + mt || y > view.bottom - mb) {
      const dx = x - view.centerX;
      const dy = y - view.centerY;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      x = Phaser.Math.Clamp(x, view.x + ml, view.right - mr);
      y = Phaser.Math.Clamp(y, view.y + mt, view.bottom - mb);
    }
    const [vx, vy] = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[dir];
    const back = 8 + Math.round((Math.sin(this.time.now / 130) + 1) * 2);
    this.tutArrow.setVisible(true).setAngle({ down: 0, left: 90, up: 180, right: -90 }[dir])
      .setPosition(Math.round(x - vx * back), Math.round(y - vy * back));
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
        const good = TOWNS[reg.get("currentTown") ?? "ashfen"]?.produce ?? "amber";
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
