/**
 * Interfaz encima del mundo: HUD, cartel de lugar, indicador de acción, avisos,
 * diálogos, elecciones, mercado y pausa. Todo en píxeles, con la fuente propia.
 */

import Phaser from "phaser";
import { Controls, keyName } from "../engine/input.js";
import { VIEW_H, VIEW_W } from "../config.js";
import { centerX, textWidth } from "../art/font.js";
import { WORLD_MAP, WORLD_PINS, WORLD_ROADS, panelDark, panelPaper, panelTag } from "../art/ui.js";
import { ninePatch } from "../art/pixel.js";
import { touch } from "../engine/touch.js";
import { online, send } from "../net/online.js";
import { isNight, hourOf } from "../engine/daylight.js"; // luz del día: sol / luna junto al día
import { MAPS } from "../maps/index.js";
import { tone, sfx, setVolume, getVolume } from "../sfx.js";
import {
  GOODS, GOOD_IDS, STONE, TOWNS, UPGRADES, buy, canBuy, capacity, cargo, cargoOf, chill, day, debt, flag, gold,
  hasUpgrade, heatLevel, hiddenCapacity, hp, load, localHeat, maxHp, priceOf, reputation, saveGame, sell, setFlag,
  seenOf, stones, rumors, fameTitle, nextFameTitle, moveStash, stashOf, stashCount, STASH_CAPACITY, STASH_RAID_HEAT,
  tonics, TONIC, townTips, FAME_TITLES, REFUGES, TUTORIAL, tutorialStep, setTutorialStep, bestLead,
  eventList, rumorMarks, DEBT, thugsPending,
  contracts, contractCarried, contractDaysLeft, contractBoard, acceptContract, deliverContract, expireContracts, contractLog,
  CONTRACT, priceHistory, caravanNews, stonesText,
} from "../state.js";

const D = 20000;
/** Líneas de objetivo a la derecha del HUD, como mucho (más taparían el mapa). */
const HUD_LINES = 3;
const PANEL_SRC = { "ui-dark": [panelDark, 5], "ui-paper": [panelPaper, 5], "ui-tag": [panelTag, 3] };
/** Ancho par: al centrar, la mitad cae en píxel entero. */
const even = (n) => Math.ceil(n / 2) * 2;

export class UIScene extends Phaser.Scene {
  constructor() {
    super("ui");
  }

  create() {
    this.controls = new Controls(this);
    this.mode = null;
    this.def = null;
    this.toasts = [];
    this.bornAt = this.time.now; // lo que llega al cargar la partida no es "pagar" ni "subir de fama"
    // La escena se reutiliza al volver del título: lo recordado de la partida anterior se olvida.
    this.lastDay = this.lastGold = this.lastHp = this.lastRank = this.lastRep = null;
    this.pauseState = this.shopState = this.boardState = this.dialog = this.choice = this.stashState = this.report = null;
    // Cola de avisos: lo que sale al llegar (resultados, días, cobrador, HOY EN) va uno tras otro.
    this.noticeQ = [];
    this.noticeGen = 0;
    this.noticeBusy = false;
    this.buildHud();
    this.buildPrompt();
    this.registry.events.on("changedata", () => this.refresh(), this);
    this.events.once("shutdown", () => this.registry.events.off("changedata", undefined, this));
    this.refresh();
  }

  // ------------------------------------------------------------------ HUD

  buildHud() {
    this.hud = this.add.container(0, 0).setDepth(D);
    this.hearts = [];
    this.coinIcon = this.add.sprite(7, 19, "coin", 0).setOrigin(0, 0);
    this.goldText = this.add.bitmapText(18, 17, "font-o", "0");
    this.slots = [];
    this.slotGems = [];
    this.eye = this.add.image(VIEW_W - 64, 6, "ui-eye-0").setOrigin(0, 0);
    this.pips = [0, 1, 2, 3, 4].map((i) => this.add.image(VIEW_W - 49 + i * 6, 8, "ui-pip-off").setOrigin(0, 0));
    this.star = this.add.image(VIEW_W - 63, 18, "ui-star").setOrigin(0, 0);
    this.fameText = this.add.bitmapText(VIEW_W - 51, 17, "font-o", "0");
    this.dayText = this.add.bitmapText(VIEW_W - 6, 29, "font-o", "").setOrigin(1, 0);
    this.skyIcon = this.add.sprite(0, 30, "ui-sky", 0).setOrigin(0, 0); // luz del día
    this.tonicIcon = this.add.image(7, 28, "tonic").setOrigin(0, 0);
    this.tonicText = this.add.bitmapText(18, 29, "font-o", "");
    // Objetivo bajo "Día N": el cobrador y la mejor pista de venta (o el paso del tutorial).
    this.goalText = this.add.bitmapText(VIEW_W - 6, 40, "font-o", "").setOrigin(1, 0);
    this.leadText = this.add.bitmapText(VIEW_W - 6, 51, "font-green", "").setOrigin(1, 0);
    // Suceso que le pega al pueblo donde estás ("Helada aquí · quedan 3 d").
    this.eventText = this.add.bitmapText(VIEW_W - 6, 62, "font-gold", "").setOrigin(1, 0);
    // Contratos que llevas: "Contrato: 2/3 Solar → Frostholm · quedan 2 d" (hasta dos).
    this.contractTexts = [0, 1].map(() => this.add.bitmapText(VIEW_W - 6, 51, "font-o", "").setOrigin(1, 0));
    this.hud.add([this.goalText, this.leadText, this.eventText, ...this.contractTexts]);
    this.hud.add([this.coinIcon, this.goldText, this.eye, ...this.pips, this.star, this.fameText, this.dayText, this.skyIcon, this.tonicIcon, this.tonicText]);
  }

  refresh() {
    const reg = this.registry;
    if (!this.hud) return;
    // Corazones
    const total = Math.ceil(maxHp(reg) / 2);
    while (this.hearts.length < total) {
      const h = this.add.image(6 + this.hearts.length * 9, 5, "heart-full").setOrigin(0, 0);
      this.hearts.push(h);
      this.hud.add(h);
    }
    const life = hp(reg);
    const prevLife = this.lastHp;
    this.hearts.forEach((h, i) => {
      const v = life - i * 2;
      h.setTexture(v >= 2 ? "heart-full" : v === 1 ? "heart-half" : "heart-empty");
      h.setVisible(i < total);
      if (prevLife == null || i >= total) return;
      const was = Math.max(0, Math.min(2, prevLife - i * 2));
      const now = Math.max(0, Math.min(2, v));
      if (now < was) this.heartHurt(h);
      else if (now > was) this.heartHeal(h, i);
    });
    if (prevLife != null && life < prevLife) {
      this.tweens.add({ targets: this.hearts, y: 7, duration: 60, yoyo: true });
    }
    this.lastHp = life;

    // Oro: el número cuenta hasta el nuevo valor; al pagar, las monedas salen del HUD.
    const g = gold(reg);
    if (this.lastGold != null && g !== this.lastGold) {
      if (g < this.lastGold && this.settled()) this.coinsOut(3);
      this.countGold(g);
    } else if (this.lastGold == null) {
      this.goldShown = g;
      this.goldText.setText(String(g));
    }
    this.lastGold = g;

    // Fama: un título nuevo merece ceremonia.
    const rep = reputation(reg);
    const rank = FAME_TITLES.filter((t) => rep >= t.min).length;
    if (this.lastRank != null && rank > this.lastRank && this.settled()) this.fameCeremony(this.lastRep ?? 0, rep);
    this.lastRank = rank;
    this.lastRep = rep;

    // Carga: una casilla por lugar; las primeras N son del fondo falso.
    const cap = capacity(reg);
    const hid = hiddenCapacity(reg);
    // Mientras el oro cuenta, deja lugar para el número más ancho de los dos.
    const x0 = 22 + Math.max(textWidth(String(g)), textWidth(String(Math.round(this.goldShown ?? g)))) + 8;
    while (this.slots.length < cap) {
      const s = this.add.image(0, 16, "ui-slot").setOrigin(0, 0);
      const gem = this.add.image(0, 17, "gem-amber").setOrigin(0, 0);
      this.slots.push(s);
      this.slotGems.push(gem);
      this.hud.add([s, gem]);
    }
    // Una casilla por lugar; la perla de lluvia, que pesa, ocupa dos.
    const list = [];
    const c = cargo(reg);
    for (const id of GOOD_IDS) for (let i = 0; i < (c[id] ?? 0) * STONE[id].slots; i += 1) list.push(id);
    this.slots.forEach((s, i) => {
      s.setVisible(i < cap).setPosition(x0 + i * 13, 16);
      s.setTexture(i < hid ? "ui-slot-hidden" : "ui-slot");
      const gem = this.slotGems[i];
      gem.setPosition(x0 + i * 13 + 1, 16).setVisible(i < cap && i < list.length);
      if (list[i]) gem.setTexture(`gem-${list[i]}`);
    });

    // Tónicos: sólo si llevas.
    const tn = tonics(reg);
    this.tonicIcon.setVisible(tn > 0);
    this.tonicText.setVisible(tn > 0).setText(`${tn} · ${keyName("tonic")}`);

    // Alerta
    const heat = localHeat(reg, this.def);
    const lvl = heatLevel(heat);
    this.eye.setTexture(`ui-eye-${lvl}`);
    const on = Math.min(5, Math.ceil(heat / 20));
    this.pips.forEach((p, i) => p.setTexture(i < on ? "ui-pip-on" : "ui-pip-off"));
    this.fameText.setText(String(reputation(reg)));
    this.dayText.setText(`Día ${day(reg)}`);
    this.skyIcon.setFrame(isNight(reg) ? 1 : 0).setX(VIEW_W - 6 - this.dayText.width - 10); // luz del día
    this.refreshGoal();
    // Día nuevo (también el que manda el servidor en línea): los contratos vencidos se pierden.
    const today = day(reg);
    if (this.lastDay !== today) {
      this.lastDay = today;
      this.checkContracts();
    }
  }

  /** Contratos vencidos: aviso en la cola y −fama. Y uno que vence hoy, se avisa una vez. */
  checkContracts() {
    const reg = this.registry;
    const late = expireContracts(reg);
    for (const c of late) {
      this.queueNotice(() => {
        tone(this, "deny");
        return this.noticeToast(`Contrato vencido: ${stonesText(c.good, c.qty)} a ${TOWNS[c.to].name} · -${c.penalty} fama`, "font-red");
      });
    }
    for (const c of contracts(reg)) {
      if (contractDaysLeft(reg, c) !== 0) continue;
      this.queueNotice(() => this.noticeToast(`Contrato: hoy vence el de ${TOWNS[c.to].name}`, "font-gold"));
    }
    if (late.length) saveGame(reg);
  }

  /** La línea de objetivo: "Cobrador en 3 días · deuda 420" y "Ocupan ámbar en Valkeep". */
  refreshGoal() {
    const reg = this.registry;
    const step = tutorialStep(reg);
    if (step >= 0) {
      this.goalText.setText(`Tutorial ${step + 1}/${TUTORIAL.length} · ${keyName("pause")}: saltar`).setFont("font-o");
      this.leadText.setText("");
      this.eventText.setText("");
      for (const t of this.contractTexts) t.setText("");
      return;
    }
    // Candidatas (texto, letra, prioridad; menos = más importante). Se ven 3 como mucho, para que la
    // columna no tape el mapa: contrato que vence hoy > cobrador en ≤2 días > suceso aquí > contrato >
    // cobrador lejos > lo que ocupan. Se dibujan en su orden de siempre (cobrador, contratos, pista, suceso).
    const lines = [];
    const d = debt(reg);
    if (d.owed > 0) {
      const left = d.due - day(reg);
      const when = left <= 0 ? "Cobrador: hoy" : `Cobrador en ${left} ${left === 1 ? "día" : "días"}`;
      // Deuda con dientes: las faltas se ven (y los matones, si ya te esperan).
      const missed = d.missed ?? 0;
      const warn = thugsPending(reg) ? " · ¡matones!" : missed ? ` · ${missed} ${missed === 1 ? "falta" : "faltas"}` : "";
      const urgent = left <= 2 || missed >= 2 || thugsPending(reg);
      lines.push({ obj: this.goalText, text: `${when} · deuda ${d.owed}${warn}`, font: urgent ? "font-red" : "font-o", prio: urgent ? 1 : 4 });
    }
    // Contratos, el que vence antes primero.
    const list = [...contracts(reg)].sort((a, b) => a.due - b.due);
    this.contractTexts.forEach((t, i) => {
      const c = list[i];
      if (!c) return;
      const left = contractDaysLeft(reg, c);
      const have = contractCarried(reg, c);
      const when = left <= 0 ? "vence hoy" : `quedan ${left} d`;
      lines.push({ obj: t, text: `Contrato: ${have}/${c.qty} ${GOODS[c.good].short} → ${TOWNS[c.to].name} · ${when}`, font: left <= 0 ? "font-red" : have >= c.qty ? "font-green" : "font-o", prio: left <= 0 ? 0 : 3 });
    });
    const lead = bestLead(reg, this.def?.kind === "town" ? this.def.town : null);
    if (lead) lines.push({ obj: this.leadText, text: `Ocupan ${GOODS[lead.good].short.toLowerCase()} en ${TOWNS[lead.town].name}`, font: "font-green", prio: 5 });
    // Un suceso en este pueblo: una línea corta con lo que le queda.
    const here = this.def?.kind === "town" ? this.def.town : null;
    const ev = here ? eventList(reg).find((e) => e.town === here) : null;
    if (ev) lines.push({ obj: this.eventText, text: `${ev.label} · quedan ${ev.days} d`, font: "font-gold", prio: 2 });
    const shown = new Set([...lines].sort((a, b) => a.prio - b.prio).slice(0, HUD_LINES).map((l) => l.obj));
    let y = 40;
    for (const l of lines) {
      if (!shown.has(l.obj)) continue;
      l.obj.setText(l.text).setFont(l.font).setY(y);
      y += 11;
    }
    for (const t of [this.goalText, ...this.contractTexts, this.leadText, this.eventText]) if (!shown.has(t)) t.setText("");
    // Hasta dónde llegan las líneas del HUD: el cartel "HOY EN …" se pone debajo.
    this.goalBottom = y;
  }

  // ------------------------------------------------------------------ juice del HUD

  settled() {
    return this.time.now - this.bornAt > 1500;
  }

  /**
   * El oro cuenta hasta `to` (350-500 ms; más si la diferencia es grande) y brilla dorado al llegar.
   * `goldDelay` (lo pone el mercado al vender) hace esperar a que lleguen las monedas.
   */
  countGold(to) {
    const from = this.goldShown ?? to;
    this.goldCount?.stop();
    this.goldFlash?.remove();
    const delay = this.goldDelay ?? 0;
    this.goldDelay = 0;
    const k = { v: from };
    const dur = Phaser.Math.Clamp(350 + Math.abs(to - from) * 2, 350, 500);
    this.goldCount = this.tweens.add({
      targets: k, v: to, delay, duration: dur, ease: "Quad.Out",
      onUpdate: () => {
        const n = Math.round(k.v);
        if (n === this.goldShown) return;
        this.goldShown = n;
        this.goldText.setText(String(n));
      },
      onComplete: () => {
        this.goldCount = null;
        this.goldShown = to;
        this.goldText.setText(String(to)).setFont("font-gold");
        this.tweens.add({ targets: this.goldText, y: 15, duration: 70, yoyo: true });
        this.goldFlash = this.time.delayedCall(160, () => { this.goldText.setFont("font-o"); this.goldFlash = null; });
        this.refresh(); // vuelve a acomodar las casillas al ancho final
      },
    });
  }

  /** Monedas en arco de (x, y) al contador de oro, con 40 ms entre una y otra; suenan al llegar. */
  coinsIn(x, y, n = 3) {
    const tx = 11;
    const ty = 23;
    let rang = false;
    for (let i = 0; i < n; i += 1) {
      const c = this.add.sprite(x + (i - n / 2) * 3, y, "coin", i % 4).setDepth(D + 25).play("coin");
      const sx = c.x;
      const sy = c.y;
      const peak = Math.min(sy, ty) - 26 - i * 3;
      const k = { t: 0 };
      this.tweens.add({
        targets: k, t: 1, delay: i * 40, duration: 360, ease: "Sine.In",
        onUpdate: () => {
          const t = k.t;
          const u = 1 - t;
          c.setPosition(Math.round(u * u * sx + 2 * u * t * ((sx + tx) / 2) + t * t * tx), Math.round(u * u * sy + 2 * u * t * peak + t * t * ty));
        },
        onComplete: () => {
          c.destroy();
          if (!rang) { rang = true; sfx(this, "coins", { volume: 0.35 }); }
          this.coinIcon.setScale(1.2);
          this.tweens.add({ targets: this.coinIcon, scale: 1, duration: 90 });
        },
      });
    }
  }

  /** Pagaste: monedas que salen del contador hacia el centro y se desvanecen. */
  coinsOut(n = 3) {
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2 - 10;
    for (let i = 0; i < n; i += 1) {
      const c = this.add.sprite(11, 23, "coin", i % 4).setDepth(D + 25).play("coin");
      const ex = cx + (i - (n - 1) / 2) * 14;
      const ey = cy + (i % 2) * 6;
      const k = { t: 0 };
      this.tweens.add({
        targets: k, t: 1, delay: i * 40, duration: 420, ease: "Quad.Out",
        onUpdate: () => {
          const t = k.t;
          c.setPosition(Math.round(11 + (ex - 11) * t), Math.round(23 + (ey - 23) * t - Math.sin(t * Math.PI) * 18));
          c.setAlpha(t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
        },
        onComplete: () => c.destroy(),
      });
    }
  }

  /** Corazón perdido: se enciende rojo 120 ms. */
  heartHurt(h) {
    h.setTint(0xe03a3a).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(120, () => h.active && h.clearTint());
  }

  /** Corazón que vuelve: brilla y crece 1.3 → 1 (desde su centro). */
  heartHeal(h, i) {
    const bx = 6 + i * 9;
    const k = { s: 1.3 };
    const apply = () => h.setScale(k.s).setX(Math.round(bx - ((k.s - 1) * 9) / 2));
    apply();
    h.setTint(0x806040).setTintMode(Phaser.TintModes.ADD);
    this.tweens.add({ targets: k, s: 1, duration: 220, ease: "Back.Out", onUpdate: apply, onComplete: () => { apply(); h.clearTint(); } });
  }

  /**
   * Título nuevo de fama: panel al centro 2.4 s con la estrella que rebota, el nombre en oro y lo
   * que abre. Mientras está, el mercado no compra ni vende.
   */
  fameCeremony(fromRep, rep) {
    const title = fameTitle(rep);
    const opens = [
      ...Object.values(UPGRADES).filter((u) => u.reputation > fromRep && u.reputation <= rep).map((u) => u.name),
      ...Object.values(REFUGES).filter((r) => r.fame > fromRep && r.fame <= rep).map((r) => r.name),
    ];
    const next = Object.values(UPGRADES).filter((u) => u.reputation > rep).sort((a, b) => a.reputation - b.reputation)[0];
    const line = opens.length ? `Ya puedes: ${opens.join(" · ")}` : next ? `Con fama ${next.reputation}: ${next.name}` : "Todo el golfo sabe tu nombre.";
    if (this.ceremony) { this.killTree(this.ceremony.box); this.ceremony.box.destroy(); this.ceremony.timer.remove(); }
    const w = even(Math.max(textWidth(title), textWidth(line), 120) + 28);
    const h = 88;
    const x = Math.round(VIEW_W / 2 - w / 2);
    const y = Math.round(VIEW_H / 2 - h / 2 - 8);
    const sy = y + 18;
    const box = this.add.container(0, 0).setDepth(D + 40);
    // Fondo casi opaco: el marco es translúcido y encima del mercado se leería revuelto.
    box.add(this.add.rectangle(x + 2, y + 2, w - 4, h - 4, 0x120e17, 0.92).setOrigin(0, 0));
    box.add(this.panel(x, y, "ui-dark", w, h));
    box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 38, "font-dim", "Nuevo título")));
    box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 51, "font-gold", title)));
    box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 68, opens.length ? "font-green" : "font-o", line)));
    const star = this.add.image(VIEW_W / 2, sy, "ui-star").setScale(0);
    box.add(star);
    // Chispas que salen de la estrella.
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const sp = this.add.image(VIEW_W / 2, sy, "sparkle").setAlpha(0);
      box.add(sp);
      this.tweens.add({ targets: sp, x: VIEW_W / 2 + Math.cos(a) * 28, y: sy + Math.sin(a) * 16, alpha: { from: 1, to: 0 }, delay: 140, duration: 520, ease: "Quad.Out" });
    }
    this.openBox(box, VIEW_W / 2, y + h / 2);
    this.tweens.add({ targets: star, scale: 3, duration: 420, ease: "Back.Out", easeParams: [3] });
    sfx(this, "jingle-fame", { volume: 0.4 });
    const timer = this.time.delayedCall(2400, () => this.endCeremony());
    this.ceremony = { box, timer, at: this.time.now };
  }

  endCeremony() {
    const c = this.ceremony;
    if (!c) return;
    this.ceremony = null;
    c.timer.remove();
    this.closeBox(c.box);
  }

  // ------------------------------------------------------------------ abrir y cerrar ventanas

  /** Abre una ventana: escala 0.96 → 1 alrededor de (cx, cy) y alpha 0 → 1, 110 ms, Back.Out suave. */
  openBox(box, cx = VIEW_W / 2, cy = VIEW_H / 2) {
    const k = { s: 0.96 };
    box.boxPivot = [cx, cy];
    const apply = (tw) => {
      if (!box.scene) return;
      box.setScale(k.s).setPosition(cx * (1 - k.s), cy * (1 - k.s));
      box.setAlpha(tw ? Math.min(1, tw.progress * 1.6) : 0);
    };
    apply();
    box.boxTween = this.tweens.add({
      targets: k, s: 1, duration: 110, ease: "Back.Out", easeParams: [1.1],
      onUpdate: (tw) => apply(tw),
      onComplete: () => { box.boxTween = null; if (box.scene) box.setScale(1).setPosition(0, 0).setAlpha(1); },
    });
    return box;
  }

  /** Cierra una ventana: escala 1 → 0.96 y alpha → 0 en 90 ms; luego la destruye y llama `cb`. */
  closeBox(box, cb) {
    if (!box || !box.active || box.closing) { cb?.(); return; }
    box.closing = true;
    box.boxTween?.stop();
    this.killTree(box);
    const [cx, cy] = box.boxPivot ?? [VIEW_W / 2, VIEW_H / 2];
    const k = { s: box.scaleX, a: box.alpha };
    this.tweens.add({
      targets: k, s: 0.96, a: 0, duration: 90, ease: "Quad.In",
      onUpdate: () => box.scene && box.setScale(k.s).setPosition(cx * (1 - k.s), cy * (1 - k.s)).setAlpha(k.a),
      onComplete: () => { box.destroy(); cb?.(); },
    });
  }

  /** Quita los tweens de un objeto y de todo lo que lleva dentro (para no dejar tweens vivos). */
  killTree(obj) {
    this.tweens.killTweensOf(obj);
    if (obj.boxTween) { obj.boxTween.stop(); obj.boxTween = null; }
    if (obj.list) for (const c of obj.list) this.killTree(c);
  }

  /** Cierra cualquier ventana abierta (por si el mapa cambió con una abierta). */
  resetModals() {
    for (const [key, obj] of [["dialog", this.dialog], ["choice", this.choice], ["shopState", this.shopState], ["pauseState", this.pauseState], ["stashState", this.stashState], ["report", this.report], ["boardState", this.boardState]]) {
      if (!obj) continue;
      this.killTree(obj.box);
      obj.box.destroy();
      this[key] = null;
      obj.resolve(key === "choice" ? -1 : undefined);
    }
    this.mode = null;
  }

  enterMap(def) {
    this.resetModals();
    this.clearNotices();
    // El cartel "HOY EN …" es del lugar que dejaste: se va.
    this.needsObj?.destroy();
    this.needsObj = null;
    this.def = def;
    if (def.kind === "town") setFlag(this.registry, `visited-${def.town}`);
    this.refresh();
    // En línea el refugio puede ser de otro jugador que te invitó.
    const owner = online.on && def.kind === "refuge" ? online.world.owners[def.refuge]?.owner : null;
    this.banner(def.name, owner && owner !== online.name ? `Refugio de ${owner}` : def.subtitle);
  }

  banner(name, sub) {
    this.bannerObj?.destroy();
    const w = even(Math.max(textWidth(name), textWidth(sub)) + 28);
    const c = this.add.container(VIEW_W / 2, -40).setDepth(D + 5);
    const bg = this.panel(0, 0, "ui-dark", w, 32).setOrigin(0.5, 0);
    const t1 = centerX(this.add.bitmapText(0, 5, "font-gold", name));
    const t2 = centerX(this.add.bitmapText(0, 17, "font-dim", sub));
    c.add([bg, t1, t2]);
    this.bannerObj = c;
    this.bannerAt = this.time.now;
    this.tweens.add({ targets: c, y: 34, duration: 320, ease: "Back.Out" });
    this.tweens.add({ targets: c, y: -40, delay: 2400, duration: 280, ease: "Quad.In", onComplete: () => c.destroy() });
  }

  /**
   * Lo que conviene en este pueblo hoy, con sus gemas: lo tuyo que aquí pagan bien, lo que ocupan
   * (venderlo da fama) y lo que sobra. Sale solo al llegar y se va.
   */
  /** Las filas de "HOY EN …": lo tuyo que aquí pagan bien, lo que ocupan y lo que sobra. */
  needsRows(townId) {
    const tips = townTips(this.registry, townId);
    const short = (g) => GOODS[g].short.toLowerCase();
    const rows = [];
    const mine = tips.yours[0];
    const mineFame = mine && tips.fameToday && tips.wanted.some((q) => q.good === mine.good);
    if (mine) rows.push({ good: mine.good, font: "font-gold", text: `Vende aquí tu ${short(mine.good)}: ${mine.sell} c/u${mineFame ? " · +fama" : ""}` });
    const want = tips.wanted.find((q) => q.good !== mine?.good);
    if (want) rows.push({ good: want.good, font: "font-green", text: `Ocupan ${short(want.good)} · pagan ${want.sell}${tips.fameToday ? " · +fama" : ""}` });
    const cheap = tips.cheap.find((q) => q.good !== want?.good);
    if (cheap) rows.push({ good: cheap.good, font: "font", text: `Sobra ${short(cheap.good)} · cuesta ${cheap.buy}` });
    if (!rows.length) rows.push({ good: null, font: "font-dim", text: "Hoy no hay gran negocio aquí" });
    return rows.slice(0, 3);
  }

  townNeeds(townId, delay = 0) {
    this.needsObj?.destroy();
    const list = this.needsRows(townId);
    const title = `HOY EN ${TOWNS[townId].name.toUpperCase()}`;
    const w = even(Math.max(textWidth(title), ...list.map((r) => textWidth(r.text) + 14)) + 16);
    const h = 18 + list.length * 13;
    const x = VIEW_W - w - 6;
    // Encima de los diálogos (D+10) y bajo las líneas de objetivo del HUD (que crecen con los contratos).
    const c = this.add.container(VIEW_W + 4, Math.max(64, (this.goalBottom ?? 0) + 3)).setDepth(D + 11);
    c.add(this.panel(0, 0, "ui-dark", w, h));
    c.add(this.add.bitmapText(8, 5, "font-gold", title));
    list.forEach((r, i) => {
      const y = 18 + i * 13;
      if (r.good) c.add(this.add.image(8, y, `gem-${r.good}`).setOrigin(0, 0));
      c.add(this.add.bitmapText(r.good ? 21 : 8, y + 1, r.font, r.text));
    });
    this.needsObj = c;
    this.tweens.add({ targets: c, x, delay, duration: 280, ease: "Back.Out", onStart: () => sfx(this, "coin", { volume: 0.25 }) });
    this.tweens.add({ targets: c, x: VIEW_W + 4, delay: delay + 7000, duration: 260, ease: "Quad.In", onComplete: () => c.destroy() });
  }

  /** El mercado ya dice lo mismo en grande: el cartel "HOY EN" se aparta. */
  hideNeeds() {
    const c = this.needsObj;
    if (!c?.active) return;
    this.needsObj = null;
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, x: VIEW_W + 4, duration: 160, ease: "Quad.In", onComplete: () => c.destroy() });
  }

  // ------------------------------------------------------------------ cola de avisos

  /**
   * Pone un aviso en la cola. `fn` puede devolver una promesa: el siguiente espera a que termine.
   * Cada aviso espera además a que no haya ventana abierta (diálogo, elección, mercado, pausa) ni
   * modal del mundo. Cambiar de mapa vacía la cola.
   */
  queueNotice(fn) {
    this.noticeQ.push(fn);
    if (!this.noticeBusy) this.runNotices(this.noticeGen);
  }

  async runNotices(gen) {
    this.noticeBusy = true;
    while (this.noticeQ.length && gen === this.noticeGen) {
      await this.untilFree(gen);
      if (gen !== this.noticeGen) return;
      const fn = this.noticeQ.shift();
      try {
        await fn();
      } catch (e) {
        console.error(e);
      }
    }
    if (gen === this.noticeGen) this.noticeBusy = false;
  }

  clearNotices() {
    this.noticeGen += 1;
    this.noticeQ = [];
    this.noticeBusy = false;
  }

  /** Nada abierto: ni ventanas de la interfaz ni un modal o fundido del mundo. */
  isFree() {
    const w = this.scene.get("world");
    const worldBusy = w?.sys.isActive() && (w.modal || w.leaving);
    return !this.mode && !worldBusy;
  }

  untilFree(gen) {
    return new Promise((resolve) => {
      const check = () => {
        if (gen !== this.noticeGen || this.isFree()) resolve();
        else this.time.delayedCall(80, check);
      };
      check();
    });
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** Espera a que el cartel del lugar empiece a irse (los avisos no le caen encima). */
  afterBanner() {
    const left = (this.bannerAt ?? 0) + 2300 - this.time.now;
    return left > 0 ? this.wait(left) : Promise.resolve();
  }

  /** Un aviso corto como parte de la cola: sale y deja 900 ms antes del siguiente. */
  noticeToast(text, font) {
    this.toast(text, font);
    return this.wait(900);
  }

  // ------------------------------------------------------------------ tutorial

  /** Letrero de arriba al centro con el paso del tutorial. `done`: el paso ya se cumplió a medias. */
  showTutorial(step, { done = false } = {}) {
    const old = this.tutObj;
    this.tutObj = null;
    if (old) { this.tweens.killTweensOf(old); old.destroy(); }
    this.refreshGoal();
    if (step < 0 || !TUTORIAL[step]) return;
    const t = TUTORIAL[step];
    // Si hoy nada sobra en este pueblo, que compre lo más barato.
    const noCheap = t.id === "buy" && this.def?.kind === "town" && !townTips(this.registry, this.def.town).cheap.length;
    const text = (done && t.done ? t.done : noCheap ? t.alt ?? t.text : t.text).replace(/\{(\w+)\}/g, (_, a) => keyName(a) || a);
    const num = `${step + 1}/${TUTORIAL.length}`;
    const w = even(textWidth(num) + textWidth(text) + 26);
    const c = this.add.container(0, -22).setDepth(D + 13);
    c.add(this.panel(VIEW_W / 2 - w / 2, 0, "ui-dark", w, 17));
    c.add(this.add.bitmapText(VIEW_W / 2 - w / 2 + 8, 3, "font-dim", num));
    c.add(this.add.bitmapText(VIEW_W / 2 - w / 2 + 16 + textWidth(num), 3, done ? "font-green" : "font-gold", text));
    this.tutObj = c;
    this.tweens.add({ targets: c, y: 3, duration: 300, ease: "Back.Out" });
  }

  hideTutorial() {
    const c = this.tutObj;
    this.tutObj = null;
    this.refreshGoal();
    if (!c) return;
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, y: -22, duration: 220, ease: "Quad.In", onComplete: () => c.destroy() });
  }

  /** Avisa al mundo de algo que cuenta para el tutorial ("shop", "buy", "sell"). */
  tutorialEvent(kind) {
    const w = this.scene.get("world");
    if (w?.sys.isActive()) w.tutorialEvent?.(kind);
  }

  // ------------------------------------------------------------------ resultados del viaje

  /**
   * Al llegar tras una ruta: días, oro ganado o perdido, piedras que llevas, calor de la ruta y fama.
   * Se cierra con cualquier botón (tras un momento) o solo a los 7 s. Resuelve al cerrarse.
   */
  tripReport(r) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "report";
      const reg = this.registry;
      const lines = [];
      const sign = (n) => (n > 0 ? `+${n}` : String(n));
      if (r.hours != null) {
        const h = Math.round(r.hours);
        const took = h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${Math.max(1, h)} h`;
        lines.push({ label: "Camino", text: `${took} · día ${day(reg)}, ${String(Math.floor(hourOf(reg))).padStart(2, "0")}:00`, font: "font" });
      } else if (r.days) lines.push({ label: "Días", text: `${r.days} de camino · hoy es el día ${day(reg)}`, font: "font" });
      const dg = gold(reg) - r.gold;
      lines.push({ label: "Oro", text: `${r.gold} → ${gold(reg)}  (${sign(dg)})`, font: dg > 0 ? "font-green" : dg < 0 ? "font-red" : "font" });
      const now = stones(reg);
      lines.push({ label: "Piedras", text: now ? "" : "ninguna", font: "font", gems: now > 0, after: r.stones !== now ? `(antes ${r.stones})` : "" });
      const lvl = heatLevel(r.heat);
      lines.push({ label: "Calor", text: ["tranquila", "vigilada", "caliente", "ardiente"][lvl], font: ["font-green", "font", "font-gold", "font-red"][lvl], eye: lvl });
      const df = reputation(reg) - r.fame;
      lines.push({ label: "Fama", text: `${reputation(reg)}${df ? `  (${sign(df)})` : ""} · ${fameTitle(reputation(reg))}`, font: df > 0 ? "font-green" : "font" });
      if (r.melted) lines.push({ label: "Escarcha", text: `se te derritieron ${r.melted}`, font: "font-red" });
      const title = r.from && r.from !== r.to ? `${TOWNS[r.from].name} → ${TOWNS[r.to].name}` : `De vuelta en ${TOWNS[r.to].name}`;
      const w = 250;
      const h = 34 + lines.length * 15 + 18;
      const x = Math.round(VIEW_W / 2 - w / 2);
      const y = Math.round(VIEW_H / 2 - h / 2 - 6);
      const box = this.add.container(0, 0).setDepth(D + 14);
      box.add(this.add.rectangle(x + 2, y + 2, w - 4, h - 4, 0x120e17, 0.9).setOrigin(0, 0));
      box.add(this.panel(x, y, "ui-dark", w, h));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-dim", r.trip ? `VIAJE ${r.trip}` : "VIAJE"));
      box.add(this.add.bitmapText(x + w - 10, y + 7, "font-gold", title).setOrigin(1, 0));
      box.add(this.add.rectangle(x + 8, y + 21, w - 16, 1, 0x8c5e13, 0.7).setOrigin(0, 0));
      lines.forEach((l, i) => {
        const ly = y + 28 + i * 15;
        box.add(this.add.bitmapText(x + 12, ly, "font-dim", l.label));
        let tx = x + 72;
        if (l.eye != null) { box.add(this.add.image(tx, ly - 1, `ui-eye-${l.eye}`).setOrigin(0, 0)); tx += 16; }
        if (l.gems) {
          const c = cargo(reg);
          for (const g of GOOD_IDS) {
            if (!c[g]) continue;
            box.add(this.add.image(tx, ly - 1, `gem-${g}`).setOrigin(0, 0));
            box.add(this.add.bitmapText(tx + 11, ly, "font", `×${c[g]}`));
            tx += 11 + textWidth(`×${c[g]}`) + 7;
          }
        }
        if (l.text) box.add(this.add.bitmapText(tx, ly, l.font, l.text));
        if (l.after) box.add(this.add.bitmapText(tx + (l.text ? textWidth(l.text) + 6 : 0), ly, "font-dim", l.after));
      });
      box.add(this.add.bitmapText(x + w - 10, y + h - 15, "font-dim", `${keyName("confirm")} seguir`).setOrigin(1, 0));
      this.openBox(box, VIEW_W / 2, y + h / 2);
      sfx(this, "coin", { volume: 0.25 });
      const finish = () => {
        if (this.report?.box !== box) return;
        this.report = null;
        this.mode = null;
        timer.remove();
        this.closeBox(box, () => resolve());
      };
      const timer = this.time.delayedCall(7000, finish);
      this.report = { box, finish, resolve };
    });
  }

  updateReport() {
    if (this.time.now - this.openedAt < 450) return;
    if (this.controls.pressed("confirm") || this.controls.pressed("interact") || this.controls.pressed("cancel")) {
      tone(this, "select");
      this.report.finish();
    }
  }

  /**
   * Cruce en barca: el mapa del mundo con la barquita yendo de un muelle al otro por el golfo,
   * mientras corren los días. Unos 3 segundos; A (o cualquier tecla de acción) lo adelanta.
   */
  boatTrip(from, to, days, startDay) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "boat";
      const S = 2;
      const mw = WORLD_MAP.w * S;
      const mh = WORLD_MAP.h * S;
      const x0 = Math.round((VIEW_W - mw) / 2);
      const y0 = Math.round((VIEW_H - mh) / 2) + 6;
      const box = this.add.container(0, 0).setDepth(D + 14).setAlpha(0);
      box.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x120e17, 1).setOrigin(0, 0));
      box.add(this.add.image(x0, y0, "worldmap").setOrigin(0, 0).setScale(S));
      const g = this.add.graphics();
      box.add(g);
      const pin = (id, color) => {
        const [px, py] = WORLD_PINS[id];
        g.fillStyle(0x1b1422, 1).fillRect(x0 + px * S - 5, y0 + py * S - 5, 10, 10);
        g.fillStyle(color, 1).fillRect(x0 + px * S - 3, y0 + py * S - 3, 6, 6);
      };
      pin(from, 0x9b896f);
      pin(to, 0xe6b736);
      const title = `${TOWNS[from].name} → ${TOWNS[to].name}`;
      const w = even(textWidth(title) + 24);
      box.add(this.panel(VIEW_W / 2 - w / 2, 4, "ui-dark", w, 17));
      box.add(centerX(this.add.bitmapText(VIEW_W / 2, 7, "font-gold", title)));
      const dayText = this.add.bitmapText(VIEW_W - 10, VIEW_H - 16, "font-o", `Día ${startDay}`).setOrigin(1, 0);
      box.add(dayText);
      // Barquita en píxeles: casco de madera, vela crema, banderín rojo.
      const boat = this.add.container(0, 0);
      const px = (x, y, w2, h2, c) => boat.add(this.add.rectangle(x, y, w2, h2, c, 1).setOrigin(0, 0));
      px(-7, 0, 14, 3, 0x683c24);
      px(-5, 3, 10, 2, 0x48291b);
      px(-1, -10, 2, 10, 0x2c1813);
      px(1, -9, 5, 7, 0xfaf3e1);
      px(1, -3, 5, 1, 0xc7b799);
      px(-1, -12, 4, 2, 0xb6292f);
      box.add(boat);
      // Curva por dentro del golfo, de muelle a muelle.
      const [ax, ay] = WORLD_PINS[from];
      const [bx, by] = WORLD_PINS[to];
      const cx = (ax + bx) / 2;
      const cy = Math.max(ay, by) + 34;
      const at = (t) => ({
        x: x0 + S * ((1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx),
        y: y0 + S * ((1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by),
      });
      const trail = { t: 0 };
      let lastDot = -1;
      const place = () => {
        const p = at(trail.t);
        const bob = Math.round(Math.sin(trail.t * 40) * 1);
        boat.setPosition(Math.round(p.x), Math.round(p.y) + bob);
        const ahead = at(Math.min(1, trail.t + 0.02));
        boat.setScale(ahead.x < p.x ? -1 : 1, 1);
        const dot = Math.floor(trail.t * 40);
        if (dot !== lastDot && dot % 2 === 0) {
          lastDot = dot;
          g.fillStyle(0xd6f3f5, 0.8).fillRect(Math.round(p.x) - 1, Math.round(p.y) + 4, 2, 2);
        }
        dayText.setText(`Día ${startDay + Math.min(days, Math.floor(trail.t * (days + 0.999)))}`);
      };
      place();
      this.tweens.add({ targets: box, alpha: 1, duration: 200 });
      sfx(this, "splash", { volume: 0.35 });
      const done = () => {
        if (this.boatState?.finished) return;
        this.boatState.finished = true;
        this.boatState.tween.stop();
        trail.t = 1;
        place();
        this.tweens.add({
          targets: box, alpha: 0, delay: 350, duration: 250,
          onComplete: () => {
            box.destroy();
            this.boatState = null;
            this.mode = null;
            resolve();
          },
        });
      };
      const tween = this.tweens.add({ targets: trail, t: 1, duration: 2800, ease: "Sine.InOut", onUpdate: place, onComplete: done });
      this.time.delayedCall(1400, () => this.boatState && !this.boatState.finished && sfx(this, "splash", { volume: 0.25 }));
      this.boatState = { box, tween, done, finished: false };
    });
  }

  updateBoat() {
    if (this.time.now - this.openedAt < 400) return;
    if (this.controls.pressed("confirm") || this.controls.pressed("cancel")) this.boatState.done();
  }

  // ------------------------------------------------------------------ indicador y avisos

  buildPrompt() {
    this.promptBox = this.add.container(VIEW_W / 2, VIEW_H - 22).setDepth(D).setVisible(false);
    this.promptBg = this.panel(0, 0, "ui-tag", 60, 16).setOrigin(0.5, 0.5);
    this.promptKey = this.add.image(0, 0, "ui-key").setOrigin(0, 0.5);
    this.promptKeyText = this.add.bitmapText(0, 0, "font-dark", "E").setOrigin(0, 0);
    this.promptText = this.add.bitmapText(0, 0, "font-o", "").setOrigin(0, 0);
    this.promptBox.add([this.promptBg, this.promptKey, this.promptKeyText, this.promptText]);
    this.promptLabel = null;
  }

  prompt(label) {
    if (label === this.promptLabel) return;
    this.promptLabel = label;
    if (!label || this.mode) {
      this.promptBox.setVisible(false);
      return;
    }
    const w = even(textWidth(label) + 26);
    this.promptKeyText.setText(keyName("interact"));
    this.promptBg.setTexture(this.panelKey("ui-tag", w, 16));
    this.promptKey.setPosition(-w / 2 + 3, 0);
    this.promptKeyText.setPosition(-w / 2 + 6, -6);
    this.promptText.setText(label).setPosition(-w / 2 + 17, -6);
    this.promptBox.setVisible(true).setScale(0.8);
    this.tweens.add({ targets: this.promptBox, scale: 1, duration: 120, ease: "Back.Out" });
  }

  toast(text, font = "font-o") {
    const y = VIEW_H - 46 - this.toasts.length * 16;
    const w = even(textWidth(text) + 14);
    const t = this.add.container(VIEW_W / 2, y + 6).setDepth(D + 2).setAlpha(0);
    t.add(this.panel(-w / 2, -8, "ui-tag", w, 15));
    t.add(centerX(this.add.bitmapText(0, -6, font, text)));
    this.toasts.push(t);
    this.tweens.add({ targets: t, y, alpha: 1, duration: 160 });
    this.tweens.add({
      targets: t, alpha: 0, y: y - 8, delay: 2200, duration: 300,
      onComplete: () => {
        t.destroy();
        this.toasts = this.toasts.filter((x) => x !== t);
      },
    });
  }

  // ------------------------------------------------------------------ diálogo

  /** Muestra páginas de texto. Resuelve al cerrar la última. */
  /**
   * `cast`: el personaje que habla, para su retrato junto al nombre. Si no viene, se usa el de la
   * persona con la que estás hablando (`talkCast`, lo pone el mundo).
   */
  say(lines, { name, cast } = {}) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "dialog";
      this.prompt(null);
      const box = this.add.container(0, 0).setDepth(D + 10);
      const bg = this.panel(8, VIEW_H - 70, "ui-paper", VIEW_W - 16, 62).setOrigin(0, 0);
      box.add(bg);
      if (name) {
        const who = cast === undefined ? this.talkCast : cast;
        const face = who && this.textures.exists(`portrait-${who}`) ? `portrait-${who}` : null;
        const nx = face ? 42 : 16;
        if (face) box.add(this.add.image(16, VIEW_H - 94, face).setOrigin(0, 0));
        const tw = textWidth(name) + 14;
        const tag = this.panel(nx, VIEW_H - 82, "ui-dark", tw, 17).setOrigin(0, 0);
        const tt = this.add.bitmapText(nx + 7, VIEW_H - 79, "font-gold", name);
        box.add([tag, tt]);
      }
      const text = this.add.bitmapText(20, VIEW_H - 62, "font-dark", "").setMaxWidth(VIEW_W - 44).setLineSpacing(2);
      const arrow = this.add.bitmapText(VIEW_W - 26, VIEW_H - 22, "font-dark", "▼").setVisible(false);
      box.add([text, arrow]);
      this.tweens.add({ targets: arrow, y: VIEW_H - 20, duration: 300, yoyo: true, repeat: -1 });
      this.openBox(box, VIEW_W / 2, VIEW_H - 39);
      const keys = (l) => l.replace(/\{(\w+)\}/g, (_, a) => keyName(a) || a);
      this.dialog = { box, text, arrow, lines: lines.map(keys), page: -1, shown: 0, full: "", resolve, tick: 0 };
      this.nextPage();
    });
  }

  nextPage() {
    const d = this.dialog;
    d.page += 1;
    if (d.page >= d.lines.length) {
      this.closeBox(d.box);
      this.dialog = null;
      this.mode = null;
      d.resolve();
      return;
    }
    d.full = d.lines[d.page];
    d.shown = 0;
    d.text.setText("");
    d.arrow.setVisible(false);
  }

  updateDialog(dt) {
    const d = this.dialog;
    if (d.shown < d.full.length) {
      d.tick += dt;
      const step = 22;
      while (d.tick > step && d.shown < d.full.length) {
        d.tick -= step;
        d.shown += 1;
        if (d.shown % 3 === 0) tone(this, "text");
      }
      d.text.setText(d.full.slice(0, d.shown));
      if (this.controls.pressed("confirm") || this.controls.pressed("interact")) {
        d.shown = d.full.length;
        d.text.setText(d.full);
      }
      if (d.shown >= d.full.length) d.arrow.setVisible(true);
      return;
    }
    if (this.controls.pressed("confirm") || this.controls.pressed("interact") || this.controls.pressed("cancel")) {
      tone(this, "select");
      this.nextPage();
    }
  }

  // ------------------------------------------------------------------ elección

  /** options: [{label, disabled?, note?}] → índice elegido, o -1 si cancela. */
  choose(title, options, { note, start } = {}) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "choice";
      const keysHint = `${keyName("confirm")} elegir · ${keyName("cancel")} volver`;
      const w = even(Math.max(textWidth(title), textWidth(keysHint), ...options.map((o) => Math.max(textWidth(o.label) + 14, textWidth(o.note ?? ""))), 150) + 20);
      const h = 30 + options.length * 14 + 28;
      const x = VIEW_W / 2 - w / 2;
      const y = VIEW_H / 2 - h / 2 - 10;
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h).setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-gold", title));
      const rows = options.map((o, i) => {
        const t = this.add.bitmapText(x + 22, y + 24 + i * 14, o.disabled ? "font-dim" : "font", o.label);
        box.add(t);
        return t;
      });
      const cursor = this.add.bitmapText(x + 10, y + 24, "font-gold", "▶");
      const noteText = this.add.bitmapText(x + 10, y + h - 27, "font-dim", "");
      // Pie con las teclas (en celular, los botones).
      box.add(this.add.rectangle(x + 8, y + h - 16, w - 16, 1, 0x8c5e13, 0.6).setOrigin(0, 0));
      const keysText = this.add.bitmapText(x + w - 10, y + h - 13, "font-dim", keysHint).setOrigin(1, 0);
      box.add([cursor, noteText, keysText]);
      if (note) box.add(this.add.bitmapText(x + 10, y + h + 4, "font-o", note));
      this.openBox(box, VIEW_W / 2, y + h / 2);
      let index = start != null && options[start] && !options[start].disabled ? start : options.findIndex((o) => !o.disabled);
      if (index < 0) index = options.length - 1;
      this.choice = { box, rows, cursor, noteText, options, index, resolve, x, y };
      this.moveChoice(0);
    });
  }

  moveChoice(delta) {
    const c = this.choice;
    c.index = (c.index + delta + c.options.length) % c.options.length;
    c.cursor.setY(c.y + 24 + c.index * 14);
    c.noteText.setText(c.options[c.index].note ?? "");
  }

  updateChoice() {
    const c = this.choice;
    if (this.controls.pressed("down")) { this.moveChoice(1); tone(this, "select"); }
    if (this.controls.pressed("up")) { this.moveChoice(-1); tone(this, "select"); }
    // Quien machaca E para pasar el diálogo no debe elegir la primera opción sin verla.
    if (this.time.now - this.openedAt < 320) return;
    if (this.controls.pressed("confirm") || this.controls.pressed("interact")) {
      const opt = c.options[c.index];
      if (opt.disabled) {
        tone(this, "deny");
        this.tweens.add({ targets: c.rows[c.index], x: c.rows[c.index].x + 2, duration: 40, yoyo: true, repeat: 2 });
        return;
      }
      tone(this, "confirm");
      this.finishChoice(c.index);
    } else if (this.controls.pressed("cancel")) {
      tone(this, "select");
      this.finishChoice(-1);
    }
  }

  finishChoice(i) {
    const c = this.choice;
    this.closeBox(c.box);
    this.choice = null;
    this.mode = null;
    c.resolve(i);
  }

  // ------------------------------------------------------------------ mercado

  /**
   * Mercado: las 5 piedras. Por cada una, lo que te cobra el pueblo, lo que te paga, lo que cobra
   * la Corona y cuántas hay. ←→ cambia entre comprar y vender; ↑↓ la piedra.
   */
  shop(townId, merchant, greeting) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "shop";
      sfx(this, "shop", { volume: 0.45 });
      // Contratos que se entregan aquí: un renglón cada uno, debajo de las piedras.
      const due = contracts(this.registry).filter((c) => c.to === townId);
      const w = 420;
      const h = 196 + due.length * 16;
      const x = VIEW_W / 2 - w / 2;
      const y = VIEW_H / 2 - h / 2 - 4;
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h).setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-gold", `MERCADO DE ${TOWNS[townId].name.toUpperCase()}`));
      box.add(this.add.bitmapText(x + w - 10, y + 7, "font-dim", `${merchant} · día ${day(this.registry)}`).setOrigin(1, 0));
      box.add(this.add.bitmapText(x + 10, y + 20, "font-dim", `"${greeting?.[0] ?? "¿Qué llevas?"}"`).setMaxWidth(w - 20));
      const col = { name: x + 34, carry: x + 140, buy: x + 200, sell: x + 262, chart: x + 298, tag: x + 382 };
      const hy = y + 38;
      box.add(this.add.bitmapText(col.carry, hy, "font-dim", "Llevas").setOrigin(0.5, 0));
      box.add(this.add.bitmapText(col.buy, hy, "font-dim", "Te cobran").setOrigin(0.5, 0));
      box.add(this.add.bitmapText(col.sell, hy, "font-dim", "Te pagan").setOrigin(0.5, 0));
      box.add(this.add.bitmapText(col.chart + 18, hy, "font-dim", "Días").setOrigin(0.5, 0));
      box.add(this.add.bitmapText(col.tag, hy, "font-dim", "Aquí").setOrigin(0.5, 0));
      const pick = this.add.rectangle(0, 0, 50, 13, 0x8c5e13, 0.55).setOrigin(0.5, 0);
      box.add(pick);
      const rows = GOOD_IDS.map((g, i) => {
        const ry = y + 52 + i * 18;
        const r = {
          good: g,
          y: ry,
          icon: this.add.image(x + 20, ry + 4, `gem-${g}`).setOrigin(0, 0.5),
          name: this.add.bitmapText(col.name, ry, "font", GOODS[g].short),
          carry: this.add.bitmapText(col.carry, ry, "font", "").setOrigin(0.5, 0),
          buy: this.add.bitmapText(col.buy, ry, "font", "").setOrigin(0.5, 0),
          sell: this.add.bitmapText(col.sell, ry, "font", "").setOrigin(0.5, 0),
          tag: this.add.bitmapText(col.tag, ry, "font", "").setOrigin(0.5, 0),
        };
        box.add([r.icon, r.name, r.carry, r.buy, r.sell, r.tag]);
        return r;
      });
      // Renglones para entregar contratos.
      const crows = due.map((c, i) => {
        const ry = y + 52 + GOOD_IDS.length * 18 + 2 + i * 16;
        const r = {
          contract: c,
          y: ry,
          icon: this.add.image(x + 21, ry + 4, "ui-scroll").setOrigin(0, 0.5),
          name: this.add.bitmapText(col.name, ry, "font", ""),
        };
        box.add([r.icon, r.name]);
        return r;
      });
      // Gráfica del precio (U6): últimos 7 precios vistos de la piedra elegida, con flecha de tendencia.
      const chart = this.add.graphics();
      const trend = this.add.bitmapText(col.chart + 33, y + 52, "font-dim", "");
      box.add([chart, trend]);
      const cursor = this.add.bitmapText(x + 10, y + 52, "font-gold", "▶");
      const info = this.add.bitmapText(x + 10, y + h - 40, "font-o", "").setMaxWidth(w - 20);
      const footer = this.add.bitmapText(x + 10, y + h - 27, "font-dim", "");
      const hint = this.add.bitmapText(x + 10, y + h - 14, "font-dim", `←→ comprar o vender · ↑↓ piedra · ${keyName("confirm")} confirmar (mantén: varias) · ${keyName("cancel")} salir`);
      box.add([cursor, info, footer, hint]);
      this.openBox(box, VIEW_W / 2, y + h / 2);
      this.hideNeeds();
      this.shopState = { townId, box, rows, crows, chart, trend, cursor, pick, info, footer, col, index: 0, side: 0, resolve, x, y, w, sold: {} };
      this.tutorialEvent("shop");
      // Arranca donde haya algo que hacer: vender lo que llevas, o comprar lo que aquí sobra.
      // Y si traes un contrato completo para aquí, empieza en él.
      const carried = rows.findIndex((r) => cargoOf(this.registry, r.good) > 0);
      const ready = crows.findIndex((r) => cargoOf(this.registry, r.contract.good) >= r.contract.qty);
      if (ready >= 0) this.shopState.index = rows.length + ready;
      else if (carried >= 0) { this.shopState.index = carried; this.shopState.side = 1; }
      else this.shopState.index = Math.max(0, GOOD_IDS.indexOf(TOWNS[townId].produce));
      this.drawShop();
    });
  }

  drawShop() {
    const s = this.shopState;
    const reg = this.registry;
    const tips = townTips(reg, s.townId);
    for (const r of s.rows) {
      const q = priceOf(reg, s.townId, r.good);
      const have = cargoOf(reg, r.good);
      r.carry.setText(have ? String(have) : "-").setFont(have ? "font" : "font-dim");
      r.buy.setText(q.stock >= 1 ? String(q.buy) : "no hay").setFont(canBuy(reg, s.townId, r.good) ? "font" : "font-dim");
      const wanted = tips.wanted.some((w) => w.good === r.good);
      r.sell.setText(wanted ? `${q.sell} ▲` : String(q.sell)).setFont(have ? "font-gold" : wanted ? "font-green" : "font-dim");
      const cheap = tips.cheap.some((c) => c.good === r.good);
      r.tag.setText(wanted ? "OCUPAN" : cheap ? "SOBRA" : "·").setFont(wanted ? "font-green" : cheap ? "font-gold" : "font-dim");
    }
    for (const r of s.crows) {
      const c = r.contract;
      const have = cargoOf(reg, c.good);
      if (r.done) { r.name.setText(`Contrato entregado: ${stonesText(c.good, c.qty)}`).setFont("font-dim"); continue; }
      const ok = have >= c.qty;
      r.name.setText(`Entregar contrato: ${stonesText(c.good, c.qty)} · paga ${c.pay} + ${c.fame} fama${ok ? "" : ` · llevas ${have}/${c.qty}`}`)
        .setFont(ok ? "font-green" : "font-dim");
    }
    const crow = s.index >= s.rows.length ? s.crows[s.index - s.rows.length] : null;
    if (crow) {
      // Renglón de contrato: sin columnas de comprar y vender.
      s.cursor.setY(crow.y);
      s.pick.setPosition(s.col.name + 157, crow.y - 2).setSize(330, 13);
      s.chart.clear();
      s.trend.setText("");
      const c = crow.contract;
      const have = cargoOf(reg, c.good);
      s.info.setText(crow.done ? "Ya lo entregaste." : have >= c.qty
        ? `Entrega ${stonesText(c.good, c.qty)} y te pagan ${c.pay} de oro y ${c.fame} de fama.`
        : `Te faltan ${c.qty - have}. Tienes hasta el día ${c.due}; si no, pierdes ${c.penalty} de fama.`);
      const d = debt(reg);
      s.footer.setText(`Oro ${gold(reg)} · Carga ${load(reg)}/${capacity(reg)} · Fama ${reputation(reg)}${d.owed > 0 ? ` · Deuda ${d.owed}` : ""}`);
      return;
    }
    const row = s.rows[s.index];
    s.cursor.setY(row.y);
    s.pick.setPosition(s.side === 0 ? s.col.buy : s.col.sell, row.y - 2).setSize(50, 13);
    const q = priceOf(reg, s.townId, row.good);
    this.drawPriceChart(s, row, q.sell);
    const mood = tips.wanted.some((w) => w.good === row.good) ? `Aquí la ocupan: te la pagan bien${tips.fameToday ? " y da fama" : ""}.` : tips.cheap.some((c) => c.good === row.good) ? "Aquí sobra: cómprala barata y llévala." : "";
    const frost = row.good === "frost" && cargoOf(reg, "frost") ? ` Tu escarcha: ${Math.round(chill(reg))} % de frío.` : "";
    s.info.setText(`${STONE[row.good].trait} ${mood}${frost}`);
    const d = debt(reg);
    s.footer.setText(`Oro ${gold(reg)} · Carga ${load(reg)}/${capacity(reg)} · Fama ${reputation(reg)}${d.owed > 0 ? ` · Deuda ${d.owed}` : ""}`);
  }

  /**
   * Mini gráfica 30×12 en el renglón elegido: un palito por cada precio visto (hasta 7 días, el de hoy
   * en oro) y flecha de tendencia contra el precio anterior (▲ verde sube, ▼ roja baja).
   */
  drawPriceChart(s, row, now) {
    const g = s.chart;
    g.clear();
    const list = priceHistory(this.registry, s.townId, row.good, now).map((e) => e.p);
    const x0 = s.col.chart;
    const base = row.y + 10;
    g.fillStyle(0x3a3746, 1).fillRect(x0, base, 30, 1);
    const lo = Math.min(...list);
    const hi = Math.max(...list);
    const n = list.length;
    list.forEach((p, i) => {
      const hgt = hi === lo ? 6 : 2 + Math.round(((p - lo) / (hi - lo)) * 9);
      const bx = x0 + 30 - (n - i) * 4 + 1;
      g.fillStyle(i === n - 1 ? 0xe6b736 : 0x9b896f, 1).fillRect(bx, base - hgt, 3, hgt);
    });
    if (n < 2) { s.trend.setText("").setY(row.y); return; }
    const prev = list[n - 2];
    const d = (now - prev) / Math.max(1, prev);
    s.trend.setText(d >= 0.05 ? "▲" : d <= -0.05 ? "▼" : "-").setFont(d >= 0.05 ? "font-green" : d <= -0.05 ? "font-red" : "font-dim").setY(row.y);
  }

  updateShop() {
    const s = this.shopState;
    const reg = this.registry;
    const n = s.rows.length + s.crows.length;
    if (this.controls.pressed("down")) { s.index = (s.index + 1) % n; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("up")) { s.index = (s.index + n - 1) % n; tone(this, "select"); this.drawShop(); }
    if ((this.controls.pressed("left") || this.controls.pressed("right")) && s.index < s.rows.length) { s.side = 1 - s.side; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("cancel")) return this.closeShop();
    if (this.time.now - this.openedAt < 250) return;
    // Con el título nuevo en pantalla no se compra ni se vende; J o K lo cierran (tras un momento).
    if (this.ceremony) {
      if (this.time.now - this.ceremony.at > 700 && (this.controls.pressed("confirm") || this.controls.pressed("interact"))) this.endCeremony();
      s.repeatAt = Infinity;
      return;
    }
    // Mantener J repite: la primera vez a los 350 ms, luego cada 120 ms. Sólo tras apretarla aquí.
    const tap = this.controls.pressed("confirm") || this.controls.pressed("interact");
    const hold = this.controls.held("confirm") || this.controls.held("interact");
    if (tap) s.repeatAt = this.time.now + 350;
    else if (hold && this.time.now >= (s.repeatAt ?? Infinity)) s.repeatAt = this.time.now + 120;
    else {
      if (!hold) s.repeatAt = Infinity;
      return;
    }
    this.shopTrade(s, reg);
  }

  /** Una compra o venta del renglón elegido, con su monedita, su número flotante y su sonido. */
  shopTrade(s, reg) {
    if (s.index >= s.rows.length) { this.shopDeliver(s, reg); return; }
    const row = s.rows[s.index];
    const buying = s.side === 0;
    const titleBefore = fameTitle(reputation(reg));
    // Al vender, el contador del HUD espera a que lleguen las monedas.
    if (!buying) this.goldDelay = 330;
    const res = buying ? buy(reg, s.townId, row.good) : sell(reg, s.townId, row.good);
    const cell = buying ? row.buy : row.sell;
    if (!res) {
      this.goldDelay = 0;
      s.repeatAt = Infinity; // no insistir a lo loco con lo que no se puede
      tone(this, "deny");
      this.tweens.killTweensOf(cell);
      cell.setX(buying ? s.col.buy : s.col.sell);
      this.tweens.add({ targets: cell, x: cell.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    if (!buying) s.sold[row.good] = (s.sold[row.good] ?? 0) + 1;
    this.tutorialEvent(buying ? "buy" : "sell");
    sfx(this, buying ? "gem" : "coins-sell", { volume: 0.5 });
    tone(this, "pickup");
    const t = this.add.bitmapText(cell.x, row.y - 2, buying ? "font-red" : "font-gold", buying ? `-${res.price}` : `+${res.price}`)
      .setOrigin(0.5, 1).setDepth(D + 20);
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    if (res.fame) {
      // Vendiste lo que aquí ocupan: la gente habla de ti. (El título nuevo trae su propia ceremonia.)
      const f = this.add.bitmapText(s.col.tag, row.y - 2, "font-green", `+${res.fame} fama`).setOrigin(0.5, 1).setDepth(D + 20);
      this.tweens.add({ targets: f, y: f.y - 16, alpha: 0, delay: 250, duration: 1100, onComplete: () => f.destroy() });
      if (fameTitle(reputation(reg)) === titleBefore) sfx(this, "jingle-mission", { volume: 0.4 });
    }
    if (buying) {
      const gem = this.add.image(row.icon.x + 4, row.icon.y, `gem-${row.good}`).setDepth(D + 20);
      this.tweens.add({ targets: gem, x: 60, y: 20, duration: 380, ease: "Quad.In", onComplete: () => gem.destroy() });
    } else {
      this.coinsIn(cell.x, row.y + 4, Phaser.Math.Clamp(3 + Math.floor(res.price / 25), 3, 5));
    }
    this.drawShop();
    saveGame(reg);
  }

  /** Entregar un contrato desde el mercado del destino: sello, monedas, fama y cartel chico. */
  shopDeliver(s, reg) {
    s.repeatAt = Infinity; // un contrato no se entrega "de a varios"
    const r = s.crows[s.index - s.rows.length];
    const c = r.done ? null : deliverContract(reg, r.contract.id);
    if (!c) {
      tone(this, "deny");
      this.tweens.killTweensOf(r.name);
      r.name.setX(s.col.name);
      this.tweens.add({ targets: r.name, x: r.name.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    r.done = true;
    this.goldDelay = 330;
    this.coinsIn(s.col.name + 60, r.y + 4, 5);
    const f = this.add.bitmapText(s.col.tag, r.y - 2, "font-green", `+${c.fame} fama`).setOrigin(0.5, 1).setDepth(D + 20);
    this.tweens.add({ targets: f, y: f.y - 16, alpha: 0, delay: 250, duration: 1100, onComplete: () => f.destroy() });
    this.contractDone(c);
    this.drawShop();
    saveGame(reg);
  }

  closeShop() {
    const s = this.shopState;
    // En línea, vender de a varias es noticia para los demás (y para los rumores).
    if (online.on && Object.values(s.sold).reduce((a, n) => a + n, 0) >= 2) send({ t: "sold", town: s.townId, sold: s.sold });
    tone(this, "select");
    this.closeBox(s.box);
    this.shopState = null;
    this.mode = null;
    s.resolve();
  }

  // ------------------------------------------------------------------ tablón de contratos (M4)

  /**
   * El tablón de la posada: 2-3 contratos del día, cada uno con piedra, cantidad, destino, plazo,
   * pago y lo que cuesta fallar. ↑↓ elige, J toma (máx. 2 a la vez), K sale. Resuelve al cerrar.
   */
  contractBoard(townId) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "board";
      sfx(this, "scroll", { volume: 0.5 });
      const offers = contractBoard(this.registry, townId);
      const w = 420;
      const rowH = 34;
      const h = 44 + Math.max(1, offers.length) * rowH + 30;
      const x = Math.round(VIEW_W / 2 - w / 2);
      const y = Math.round(VIEW_H / 2 - h / 2 - 6);
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h));
      box.add(this.add.image(x + 10, y + 6, "ui-scroll").setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 23, y + 7, "font-gold", `TABLÓN DE CONTRATOS · ${TOWNS[townId].name.toUpperCase()}`));
      const count = this.add.bitmapText(x + w - 10, y + 7, "font-dim", "").setOrigin(1, 0);
      box.add(count);
      box.add(this.add.bitmapText(x + 10, y + 21, "font-dim", "Se entregan en el mercado del destino. Si se te pasa el día, pierdes fama."));
      box.add(this.add.rectangle(x + 8, y + 33, w - 16, 1, 0x8c5e13, 0.7).setOrigin(0, 0));
      const pick = this.add.rectangle(x + 6, 0, w - 12, rowH - 4, 0x8c5e13, 0.3).setOrigin(0, 0);
      box.add(pick);
      const rows = offers.map((o, i) => {
        const ry = y + 40 + i * rowH;
        const r = {
          o, y: ry,
          gem: this.add.image(x + 18, ry + 5, `gem-${o.good}`).setOrigin(0, 0.5),
          line1: this.add.bitmapText(x + 32, ry, "font", ""),
          pay: this.add.bitmapText(x + 32, ry + 12, "font-gold", ""),
          fail: this.add.bitmapText(x + 32, ry + 12, "font-red", ""),
          tag: this.add.bitmapText(x + w - 12, ry, "font-dim", "").setOrigin(1, 0),
        };
        box.add([r.gem, r.line1, r.pay, r.fail, r.tag]);
        return r;
      });
      if (!offers.length) box.add(this.add.bitmapText(x + 32, y + 46, "font-dim", "Hoy no hay contratos aquí. Vuelve mañana."));
      const cursor = this.add.bitmapText(x + 10, y + 40, "font-gold", "▶");
      const msg = this.add.bitmapText(x + 10, y + h - 27, "font-dim", "");
      const hint = this.add.bitmapText(x + w - 10, y + h - 14, "font-dim", `↑↓ elegir · ${keyName("confirm")} tomar · ${keyName("cancel")} salir`).setOrigin(1, 0);
      box.add([cursor, msg, hint]);
      this.openBox(box, VIEW_W / 2, y + h / 2);
      const first = rows.findIndex((r) => !r.o.taken);
      this.boardState = { townId, box, rows, cursor, pick, count, msg, index: Math.max(0, first), resolve, x, y, w, rowH };
      this.drawBoard();
    });
  }

  drawBoard() {
    const b = this.boardState;
    const reg = this.registry;
    const today = day(reg);
    const mine = contracts(reg);
    b.count.setText(`día ${today} · tus contratos ${mine.length}/${CONTRACT.maxActive}`);
    const offers = contractBoard(reg, b.townId);
    for (const r of b.rows) {
      r.o = offers.find((o) => o.id === r.o.id) ?? r.o;
      const o = r.o;
      const left = o.due - today;
      const dim = o.taken;
      r.line1.setText(`Lleva ${stonesText(o.good, o.qty)} a ${TOWNS[o.to].name} · hasta el día ${o.due} (${left <= 0 ? "vence hoy" : `quedan ${left} d`})`).setFont(dim ? "font-dim" : "font");
      const payText = `Paga ${o.pay} oro (${String(CONTRACT.payRate).replace(".", ",")}× precio) + ${o.fame} fama`;
      r.pay.setText(payText).setFont(dim ? "font-dim" : "font-gold");
      r.fail.setText(`· si fallas: -${o.penalty} fama`).setX(b.x + 32 + textWidth(payText) + 6).setFont(dim ? "font-dim" : "font-red");
      const have = cargoOf(reg, o.good);
      r.tag.setText(o.taken ? "TOMADO" : have ? `llevas ${Math.min(have, o.qty)}/${o.qty}` : "").setFont(o.taken ? "font-dim" : "font-green");
    }
    const row = b.rows[b.index];
    b.cursor.setVisible(Boolean(row)).setY(row ? row.y : 0);
    b.pick.setVisible(Boolean(row)).setY(row ? row.y - 4 : 0);
    if (!b.msgLocked) {
      b.msg.setText(mine.length >= CONTRACT.maxActive ? `Ya llevas ${CONTRACT.maxActive} contratos: entrega uno antes de tomar otro.` : "Toma los que te convengan: pide lo que el destino ocupa hoy.")
        .setFont(mine.length >= CONTRACT.maxActive ? "font-red" : "font-dim");
    }
  }

  updateBoard() {
    const b = this.boardState;
    const n = b.rows.length;
    if (n && this.controls.pressed("down")) { b.index = (b.index + 1) % n; tone(this, "select"); this.drawBoard(); }
    if (n && this.controls.pressed("up")) { b.index = (b.index + n - 1) % n; tone(this, "select"); this.drawBoard(); }
    if (this.controls.pressed("cancel") || this.controls.pressed("pause")) {
      tone(this, "select");
      this.closeBox(b.box);
      this.boardState = null;
      this.mode = null;
      b.resolve();
      return;
    }
    if (this.time.now - this.openedAt < 300 || !n) return;
    if (!(this.controls.pressed("confirm") || this.controls.pressed("interact"))) return;
    const row = b.rows[b.index];
    const res = row.o.taken ? { ok: false, reason: "Ese ya lo tomaste." } : acceptContract(this.registry, b.townId, row.o.id);
    if (!res.ok) {
      tone(this, "deny");
      b.msgLocked = true;
      b.msg.setText(res.reason).setFont("font-red");
      this.time.delayedCall(1600, () => { if (this.boardState === b) { b.msgLocked = false; this.drawBoard(); } });
      this.tweens.add({ targets: row.line1, x: row.line1.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    tone(this, "confirm");
    sfx(this, "scroll", { volume: 0.35 });
    // Sello de "TOMADO" que cae sobre el pliego.
    const stamp = this.add.bitmapText(b.x + b.w - 70, row.y + 4, "font-red", "ACEPTADO").setOrigin(0.5, 0.5).setScale(2.4).setAlpha(0);
    b.box.add(stamp);
    this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 160, ease: "Quad.In", onComplete: () => this.time.delayedCall(500, () => stamp.active && this.tweens.add({ targets: stamp, alpha: 0, duration: 250, onComplete: () => stamp.destroy() })) });
    saveGame(this.registry);
    this.drawBoard();
    this.refreshGoal();
  }

  /** Contrato cumplido: cartel chico arriba al centro con el pliego, el oro y la fama. */
  contractDone(c) {
    const title = "CONTRATO CUMPLIDO";
    const line = `${stonesText(c.good, c.qty)} a ${TOWNS[c.to].name}`;
    const gain = `+${c.pay} oro · +${c.fame} fama`;
    const w = even(Math.max(textWidth(title), textWidth(line), textWidth(gain)) + 44);
    const h = 44;
    const x = Math.round(VIEW_W / 2 - w / 2);
    const y = 6;
    const box = this.add.container(0, 0).setDepth(D + 35);
    box.add(this.add.rectangle(x + 2, y + 2, w - 4, h - 4, 0x120e17, 0.92).setOrigin(0, 0));
    box.add(this.panel(x, y, "ui-dark", w, h));
    const icon = this.add.image(x + 16, y + h / 2, "ui-scroll").setScale(0);
    box.add(icon);
    box.add(this.add.bitmapText(x + 30, y + 6, "font-gold", title));
    box.add(this.add.bitmapText(x + 30, y + 18, "font-o", line));
    box.add(this.add.bitmapText(x + 30, y + 30, "font-green", gain));
    this.openBox(box, VIEW_W / 2, y + h / 2);
    this.tweens.add({ targets: icon, scale: 2, duration: 260, ease: "Back.Out", easeParams: [3] });
    sfx(this, "seal", { volume: 0.6 });
    this.time.delayedCall(2200, () => this.closeBox(box));
  }

  // ------------------------------------------------------------------ alijo

  /** Ventana del alijo: ↑↓ elige piedra, → guarda, ← saca. */
  stash(id, def, heat, cap = STASH_CAPACITY, title = "ALIJO") {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "stash";
      const w = 310;
      const rowsN = Object.keys(GOODS).length;
      const h = 58 + rowsN * 16 + 30;
      const x = VIEW_W / 2 - w / 2;
      const y = VIEW_H / 2 - h / 2 - 6;
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h).setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-gold", title));
      const count = this.add.bitmapText(x + w - 10, y + 7, "font-dim", "").setOrigin(1, 0);
      box.add(count);
      box.add(this.add.bitmapText(x + 118, y + 24, "font-dim", "Carga"));
      box.add(this.add.bitmapText(x + 196, y + 24, "font-dim", "Guardado"));
      const rows = Object.values(GOODS).map((g, i) => {
        const ry = y + 40 + i * 16;
        const r = {
          good: g.id,
          icon: this.add.image(x + 22, ry + 4, `gem-${g.id}`).setOrigin(0, 0.5),
          label: this.add.bitmapText(x + 36, ry, "font", g.short),
          carry: this.add.bitmapText(x + 130, ry, "font", "").setOrigin(0.5, 0),
          arrows: this.add.bitmapText(x + 168, ry, "font-dim", "").setOrigin(0.5, 0),
          stored: this.add.bitmapText(x + 208, ry, "font", "").setOrigin(0.5, 0),
        };
        box.add([r.icon, r.label, r.carry, r.arrows, r.stored]);
        return r;
      });
      const cursor = this.add.bitmapText(x + 10, y + 40, "font-gold", "▶");
      const warn = this.add.bitmapText(x + 10, y + h - 28, heat >= STASH_RAID_HEAT ? "font-red" : "font-dim",
        heat >= STASH_RAID_HEAT ? "Ruta caliente: la Corona puede dar con él." : "Lo guardado aquí no lo pierdes al caer.");
      const hint = this.add.bitmapText(x + 10, y + h - 15, "font-dim", `→ guardar · ← sacar · ↑↓ elegir · ${keyName("cancel")} salir`);
      box.add([cursor, warn, hint]);
      this.openBox(box, VIEW_W / 2, y + h / 2);
      this.stashState = { id, box, rows, cursor, count, cap, index: 0, resolve, y };
      this.drawStash();
    });
  }

  drawStash() {
    const s = this.stashState;
    const reg = this.registry;
    const c = cargo(reg);
    const st = stashOf(reg, s.id);
    for (const r of s.rows) {
      const a = c[r.good] ?? 0;
      const b = st[r.good] ?? 0;
      r.carry.setText(String(a)).setFont(a ? "font" : "font-dim");
      r.stored.setText(String(b)).setFont(b ? "font-gold" : "font-dim");
      r.arrows.setText(`${b ? "←" : " "} ${a ? "→" : " "}`);
      r.label.setFont(a || b ? "font" : "font-dim");
    }
    s.cursor.setY(s.y + 40 + s.index * 16);
    s.count.setText(`${stashCount(reg, s.id)}/${s.cap} · carga ${load(reg)}/${capacity(reg)}`);
  }

  updateStash() {
    const s = this.stashState;
    const n = s.rows.length;
    if (this.controls.pressed("down")) { s.index = (s.index + 1) % n; tone(this, "select"); this.drawStash(); }
    if (this.controls.pressed("up")) { s.index = (s.index + n - 1) % n; tone(this, "select"); this.drawStash(); }
    if (this.controls.pressed("cancel") || this.controls.pressed("pause")) {
      tone(this, "select");
      this.closeBox(s.box);
      this.stashState = null;
      this.mode = null;
      s.resolve();
      return;
    }
    const dir = this.controls.pressed("right") ? 1 : this.controls.pressed("left") ? -1 : 0;
    if (!dir) return;
    const r = s.rows[s.index];
    if (moveStash(this.registry, s.id, r.good, dir)) {
      sfx(this, "sack", { volume: 0.35 });
      tone(this, "pickup");
    } else {
      tone(this, "deny");
      this.tweens.add({ targets: r.label, x: r.label.x + 2, duration: 40, yoyo: true, repeat: 2 });
    }
    this.drawStash();
  }

  // ------------------------------------------------------------------ pausa

  pause(def) {
    return new Promise((resolve) => {
      this.closeAll();
      this.controls.lock(3);
      this.mode = "pause";
      tone(this, "confirm");
      // Velo que oscurece (sube en 140 ms) y, encima, el panel que abre con openBox.
      const outer = this.add.container(0, 0).setDepth(D + 30);
      const veil = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x120e17, 1).setOrigin(0, 0).setAlpha(0);
      const box = this.add.container(0, 0);
      outer.add([veil, box]);
      this.tweens.add({ targets: veil, alpha: 0.82, duration: 140 });
      box.add(this.panel(8, 8, "ui-dark", VIEW_W - 16, VIEW_H - 16).setOrigin(0, 0));
      // En línea, una pestaña más: quién está conectado y dónde anda.
      const tabs = ["MAPA", "CARGA", "FAMA", "MERCADOS", "CONTRATOS", "CONTROLES", "OPCIONES", ...(online.on ? ["JUGADORES"] : [])];
      // Pestañas repartidas a lo ancho según lo que mide cada nombre.
      const room = VIEW_W - 44 - tabs.reduce((a, t) => a + textWidth(t), 0);
      const gap = Math.floor(room / (tabs.length - 1));
      let tx = 22;
      const tabTexts = tabs.map((t) => {
        const txt = this.add.bitmapText(tx, 17, "font-dim", t);
        tx += textWidth(t) + gap;
        box.add(txt);
        return txt;
      });
      box.add(this.add.rectangle(16, 31, VIEW_W - 32, 1, 0x8c5e13).setOrigin(0, 0));
      box.add(this.add.bitmapText(VIEW_W - 22, VIEW_H - 24, "font-dim", `←→ pestañas · ${keyName("cancel")} volver`).setOrigin(1, 0));
      // Con el tutorial andando: se puede saltar (dos veces J, para no saltarlo sin querer).
      const skip = tutorialStep(this.registry) >= 0 ? this.add.bitmapText(22, VIEW_H - 24, "font-gold", `${keyName("confirm")} saltar tutorial`) : null;
      if (skip) box.add(skip);
      const page = this.add.container(0, 0);
      box.add(page);
      this.pauseState = { box: outer, panel: box, veil, tabs, tabTexts, page, index: 0, resolve, def, skip, skipArmed: false, opt: -1, quitArmed: false };
      this.drawPause();
      this.openBox(box);
    });
  }

  drawPause() {
    const p = this.pauseState;
    const reg = this.registry;
    p.tabTexts.forEach((t, i) => t.setFont(i === p.index ? "font-gold" : "font-dim"));
    this.killTree(p.page); // los ▼ que rebotan no deben quedar vivos al cambiar de pestaña
    p.page.removeAll(true);
    const add = (o) => { p.page.add(o); return o; };
    const txt = (x, y, s, f = "font") => add(this.add.bitmapText(x, y, f, s));
    if (p.index === 0) {
      const mx = 26;
      const my = 40;
      add(this.add.image(mx, my, "worldmap").setOrigin(0, 0));
      const g = add(this.add.graphics());
      for (const [a, b] of WORLD_ROADS) {
        const [ax, ay] = WORLD_PINS[a];
        const [bx, by] = WORLD_PINS[b];
        const known = flag(reg, `visited-${a}`) && flag(reg, `visited-${b}`);
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
        g.fillStyle(known ? 0x8d3225 : 0x9b896f, 1);
        for (let i = 0; i <= steps; i += 1) {
          if (i % 2) continue;
          g.fillRect(Math.round(mx + ax + ((bx - ax) * i) / steps), Math.round(my + ay + ((by - ay) * i) / steps), 2, 2);
        }
      }
      if (flag(reg, "met-ferry")) {
        const [ax, ay] = WORLD_PINS.frostholm;
        const [bx, by] = WORLD_PINS.ashfen;
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
        g.fillStyle(0x1d3f66, 1);
        for (let i = 0; i <= steps; i += 2) {
          const t = i / steps;
          g.fillRect(Math.round(mx + ax + (bx - ax) * t), Math.round(my + ay + (by - ay) * t + Math.sin(t * Math.PI) * 18), 2, 2);
        }
      }
      const here = p.def.kind === "town" ? p.def.town : null;
      // En línea: dónde anda cada jugador (en un pueblo, o a medio camino si va por una ruta).
      if (online.on) {
        const spots = [];
        for (const pl of online.players.values()) {
          if (!pl.name || pl.id === online.id || !pl.map) continue;
          const def = MAPS[pl.map];
          const town = def?.kind === "town" ? def.town : null;
          const [a, b] = def?.between ?? (def?.route ? MAPS[def.route]?.between ?? [] : []);
          let pin = town ? WORLD_PINS[town] : a && b ? [(WORLD_PINS[a][0] + WORLD_PINS[b][0]) / 2, (WORLD_PINS[a][1] + WORLD_PINS[b][1]) / 2] : null;
          if (!pin) continue;
          const n = spots.filter((s) => s[0] === pin[0] && s[1] === pin[1]).length;
          spots.push(pin);
          g.fillStyle(0x1b1422, 1).fillRect(mx + pin[0] + 4, my + pin[1] - 10 - n * 9, 6, 6);
          g.fillStyle(0x7891da, 1).fillRect(mx + pin[0] + 5, my + pin[1] - 9 - n * 9, 4, 4);
          txt(mx + pin[0] + 12, my + pin[1] - 13 - n * 9, pl.name, "font-o");
        }
      }
      for (const [id, [x, y]] of Object.entries(WORLD_PINS)) {
        const known = flag(reg, `visited-${id}`);
        g.fillStyle(0x1b1422, 1).fillRect(mx + x - 3, my + y - 3, 7, 7);
        g.fillStyle(known ? 0xe6b736 : 0x737188, 1).fillRect(mx + x - 2, my + y - 2, 5, 5);
        txt(mx + x - textWidth(known ? TOWNS[id].name : "???") / 2, my + y + 5, known ? TOWNS[id].name : "???", "font-o");
        if (id === here) {
          const pin = add(this.add.bitmapText(mx + x - 2, my + y - 16, "font-red", "▼"));
          this.tweens.add({ targets: pin, y: pin.y - 3, duration: 280, yoyo: true, repeat: -1 });
        }
      }
      if (p.def.kind === "route") {
        const [a, b] = p.def.between;
        const [ax, ay] = WORLD_PINS[a];
        const [bx, by] = WORLD_PINS[b];
        const pin = add(this.add.bitmapText(mx + (ax + bx) / 2 - 2, my + (ay + by) / 2 - 12, "font-red", "▼"));
        this.tweens.add({ targets: pin, y: pin.y - 3, duration: 280, yoyo: true, repeat: -1 });
      }
      this.drawMapNews(p, mx, my, add, txt);
      const side = 258;
      txt(side, 42, p.def.name, "font-gold");
      txt(side, 54, p.def.subtitle, "font-dim");
      txt(side, 74, "Recorrido", "font-gold");
      // El camino por tierra y la barca; lo que conviene cambia cada día en todos lados.
      // (Abajo del mapa van los sucesos y los rumores: ver drawMapNews.)
      const lines = [
        "Ashfen → Valkeep →",
        "Verdelume → Duneshade →",
        "Mossgrove → Frostholm.",
        flag(reg, "met-ferry") ? "La barca cruza el golfo:" : "Dicen que en Frostholm",
        flag(reg, "met-ferry") ? "Frostholm y Ashfen." : "hay un barquero.",
        "! suceso · ? rumor",
      ];
      lines.forEach((l, i) => txt(side, 86 + i * 12, l, "font-dim"));
    } else if (p.index === 1) {
      // --- Tú: vida, oro, fama, tónicos, deuda ---
      txt(24, 42, "VIDA", "font-gold");
      const hearts = Math.ceil(maxHp(reg) / 2);
      for (let i = 0; i < hearts; i += 1) {
        const v = hp(reg) - i * 2;
        add(this.add.image(24 + i * 10, 54, v >= 2 ? "heart-full" : v === 1 ? "heart-half" : "heart-empty").setOrigin(0, 0));
      }
      txt(24, 70, "ORO", "font-gold");
      add(this.add.sprite(24, 82, "coin", 0).setOrigin(0, 0));
      txt(36, 81, String(gold(reg)));
      const fame = reputation(reg);
      const next = nextFameTitle(fame);
      txt(24, 98, "FAMA", "font-gold");
      txt(24, 110, `${fame} · ${fameTitle(fame)}`);
      txt(24, 121, next ? `${next.min - fame} más: ${next.name}` : "Lo más alto.", "font-dim");
      txt(24, 137, "TÓNICOS", "font-gold");
      add(this.add.image(24, 149, "tonic").setOrigin(0, 0));
      txt(36, 150, `${tonics(reg)}/${TONIC.max}  (${keyName("tonic")})`);
      const d = debt(reg);
      txt(24, 166, "DEUDA CON EL GREMIO", "font-gold");
      if (d.owed > 0) {
        txt(24, 178, `${d.owed} oro`, "font-red");
        txt(24, 189, `Cobro: día ${d.due} (hoy ${day(reg)})`, "font-dim");
      } else {
        txt(24, 178, "Pagada. Eres libre.", "font-green");
      }
      // --- Carga ---
      txt(170, 42, `CARGA ${load(reg)}/${capacity(reg)} lugares`, "font-gold");
      const c = cargo(reg);
      let row = 0;
      for (const id of GOOD_IDS) {
        const n = c[id] ?? 0;
        if (!n) continue;
        add(this.add.image(170, 56 + row * 13, `gem-${id}`).setOrigin(0, 0));
        const extra = id === "frost" ? ` · ${Math.round(chill(reg))} % frío` : id === "rain" ? " · 2 lugares c/u" : "";
        txt(184, 56 + row * 13, `${GOODS[id].short} × ${n}${extra}`);
        row += 1;
      }
      if (!row) txt(170, 56, "Vacía.", "font-dim");
      if (hiddenCapacity(reg)) txt(170, 56 + Math.max(1, row) * 13 + 2, `Fondo falso: ${hiddenCapacity(reg)} ocultas`, "font-green");
      // --- Alijos ---
      txt(170, 134, "ALIJOS", "font-gold");
      const stashes = Object.entries(reg.get("stashes") ?? {}).filter(([id]) => stashCount(reg, id) > 0);
      if (!stashes.length) txt(170, 146, hasUpgrade(reg, "stashKit") ? "Vacíos." : "Sin herrajes.", "font-dim");
      stashes.slice(0, 5).forEach(([id, st], i) => {
        const label = id.replace(/^r(\d)-/, "Ruta $1 · ");
        txt(170, 146 + i * 11, label, "font-dim");
        let gx = 170 + textWidth(label) + 4;
        for (const g of GOOD_IDS) {
          if (!st[g]) continue;
          add(this.add.image(gx, 146 + i * 11, `gem-${g}`).setOrigin(0, 0));
          txt(gx + 11, 146 + i * 11, String(st[g]));
          gx += 22;
        }
      });
      // --- Mejoras ---
      txt(338, 42, "MEJORAS", "font-gold");
      Object.values(UPGRADES).forEach((u, i) => {
        const owned = hasUpgrade(reg, u.id);
        txt(338, 56 + i * 22, u.name, owned ? "font-green" : "font-dim");
        txt(344, 66 + i * 22, owned ? "tuyo" : u.reputation ? `fama ${u.reputation} · ${u.cost} oro` : `${u.cost} oro`, "font-dim");
      });
    } else if (p.index === 2) {
      // --- Fama y rumores ---
      const fame = reputation(reg);
      const next = nextFameTitle(fame);
      txt(24, 42, "FAMA", "font-gold");
      txt(24, 58, `Eres ${fameTitle(fame)} · ${fame} de fama`);
      if (next) txt(24, 72, `Siguiente: ${next.name} con ${next.min} de fama`, "font-dim");
      txt(24, 92, "Cómo sube: vende lo que un pueblo OCUPA (etiqueta verde en el mercado).", "font-dim");
      txt(24, 104, "Da +1 de fama una vez por pueblo y por día.", "font-dim");
      txt(24, 124, "Cada título abre mejoras: herrajes, caballo, arquera, fondo falso.", "font-dim");
      const heard = rumors(reg).slice(0, 4);
      if (heard.length) {
        txt(24, 150, "LO QUE SE DICE", "font-gold");
        heard.forEach((r, i) => txt(24, 162 + i * 12, `Día ${r.day}: ${r.text}`.slice(0, 74), "font-dim"));
      }
    } else if (p.index === 3) {
      // --- Mercados: lo que pagaban la última vez que los viste ---
      txt(24, 42, `Lo que te pagaban (hoy es el día ${day(reg)})`, "font-gold");
      txt(24, 58, "Pueblo", "font-dim");
      GOOD_IDS.forEach((g, i) => add(this.add.image(128 + i * 52, 57, `gem-${g}`).setOrigin(0, 0)));
      txt(396, 58, "Visto", "font-dim");
      Object.values(TOWNS).forEach((t, i) => {
        const y = 72 + i * 18;
        const seen = seenOf(reg, t.id);
        txt(24, y, seen ? t.name : "???", seen ? "font" : "font-dim");
        if (!seen) return;
        const best = Math.max(...GOOD_IDS.map((g) => seen.prices[g]));
        GOOD_IDS.forEach((g, j) => txt(128 + j * 52, y, String(seen.prices[g]), seen.prices[g] === best ? "font-gold" : "font"));
        const ago = day(reg) - seen.day;
        txt(396, y, ago === 0 ? "hoy" : `hace ${ago} d`, ago > 6 ? "font-red" : "font-dim");
        const lvl = heatLevel(localHeat(reg, { kind: "town", town: t.id }));
        add(this.add.image(440, y - 1, `ui-eye-${lvl}`).setOrigin(0, 0));
      });
      // Sucesos: "!" junto al pueblo con los días que le quedan.
      Object.values(TOWNS).forEach((t, i) => {
        const ev = eventList(reg).find((e) => e.town === t.id);
        if (!ev) return;
        txt(24 + textWidth(seenOf(reg, t.id) ? t.name : "???") + 4, 72 + i * 18, `!${ev.days}d`, "font-red");
      });
      // El cartel "HOY EN …" del pueblo donde estás, para volver a verlo.
      if (p.def.kind === "town") {
        txt(24, 174, `HOY EN ${TOWNS[p.def.town].name.toUpperCase()}`, "font-gold");
        let hx = 24;
        for (const r of this.needsRows(p.def.town)) {
          if (hx + textWidth(r.text) + 12 > VIEW_W - 24) break;
          if (r.good) { add(this.add.image(hx, 185, `gem-${r.good}`).setOrigin(0, 0)); hx += 12; }
          txt(hx, 186, r.text, r.font);
          hx += textWidth(r.text) + 12;
        }
      }
      txt(24, 204, "Los precios cambian cada día: lo que sobra baja, lo que falta sube.", "font-dim");
      txt(24, 216, "Nadie te paga más que la Corona. Vender sube el calor del pueblo.", "font-dim");
      // Mercaderes de a pie: lo último que se supo de ellos (mueven el mercado de verdad).
      const car = (reg.get("caravans") ?? [])[0];
      if (car && day(reg) - car.day <= 2) txt(24, 228, caravanNews(car, day(reg)), "font-o");
      else txt(24, 228, "Los rumores de la gente traen noticias frescas.", "font-dim");
    } else if (p.tabs[p.index] === "JUGADORES") {
      this.drawPausePlayers(txt, add);
    } else if (p.index === 4) {
      this.drawPauseContracts(txt, add);
    } else if (p.index === 6) {
      this.drawPauseOptions(p, txt, add);
    } else {
      // Dos grupos iguales: WASD + J K L, o flechas + Z X C. En celular, los botones.
      const rows = touch.on ? [
        ["Mover", "palanca (mitad izquierda)"],
        ["Acción: hablar · usar · golpear · elegir", "A"],
        ["Rodar (tocar) · correr (mantener) · salir", "B"],
        ["Agacharse · esconderse en pasto alto", "C"],
        ["Beber tónico (2 corazones)", "T"],
        ["Golpe cargado (empuja más)", "mantén A y suelta"],
        ["Pausa y mapa", "II"],
        ["Bajar un escalón", "caminar hacia abajo"],
      ] : [
        ["Mover", "WASD  o  flechas"],
        ["Acción: hablar · usar · golpear · elegir", "J  o  Z"],
        ["Rodar (tocar) · correr (mantener) · salir", "K  o  X"],
        ["Agacharse · esconderse en pasto alto", "L  o  C"],
        ["Beber tónico (2 corazones)", "I  o  V"],
        ["Golpe cargado (empuja más)", "mantén J y suelta"],
        ["Pausa y mapa", "ESC  o  P"],
        ["Bajar un escalón", "caminar hacia abajo"],
      ];
      txt(24, 42, "CONTROLES", "font-gold");
      rows.forEach(([a, b], i) => {
        txt(24, 58 + i * 14, a);
        txt(VIEW_W - 26 - textWidth(b), 58 + i * 14, b, "font-gold");
      });
      txt(24, 180, "Control: A acción · B rodar · X agacharse · Y tónico · Start pausa", "font-dim");
      txt(24, 196, "Guardias: revisan si llevas piedras a la vista; su escudo para los golpes de frente.", "font-dim");
      txt(24, 208, "Bandidos: te arrancan piedras; recógelas antes que ellos.", "font-dim");
    }
  }

  /** Pestaña JUGADORES (en línea): quién está conectado, en qué mapa y quién habla. */
  drawPausePlayers(txt, add) {
    const where = (map) => {
      const def = MAPS[map];
      if (!def) return "llegando…";
      return def.kind === "route" ? `${def.name} (camino)` : def.name;
    };
    const me = this.scene.get("world")?.mapId;
    const others = [...online.players.values()].filter((pl) => pl.name && pl.id !== online.id);
    const h = hourOf(this.registry);
    txt(24, 42, `EN LÍNEA · ${others.length + 1} ${others.length ? "jugadores" : "jugador"}`, "font-gold");
    txt(VIEW_W - 26 - textWidth(`Día ${day(this.registry)} · ${String(Math.floor(h)).padStart(2, "0")}:00`), 42,
      `Día ${day(this.registry)} · ${String(Math.floor(h)).padStart(2, "0")}:00`, "font-dim");
    const g = add(this.add.graphics());
    const row = (y, name, place, color, extra) => {
      g.fillStyle(0x1b1422, 1).fillRect(24, y + 1, 7, 7);
      g.fillStyle(color, 1).fillRect(25, y + 2, 5, 5);
      txt(36, y, name, "font");
      txt(150, y, place, "font-dim");
      if (extra) txt(VIEW_W - 26 - textWidth(extra), y, extra, "font-gold");
    };
    row(60, `${online.name ?? "Tú"} (tú)`, where(me), 0xe6b736, online.connected ? null : "sin conexión");
    others.slice(0, 9).forEach((pl, i) => {
      const same = pl.map && pl.map === me;
      row(76 + i * 14, pl.name, where(pl.map), 0x7891da, pl.talking ? "habla" : same ? "aquí" : null);
    });
    if (others.length > 9) txt(36, 76 + 9 * 14, `y ${others.length - 9} más`, "font-dim");
    if (!others.length) txt(36, 80, "Nadie más por ahora. Pásale el enlace a alguien.", "font-dim");
    txt(24, 204, "En el MAPA, un cuadrito azul por jugador. Voz: tecla T · chat: Enter.", "font-dim");
    txt(24, 216, "Tu avance se guarda en el servidor con tu nombre: sigue desde cualquier aparato.", "font-dim");
  }

  /** Pestaña CONTRATOS: los que llevas (con plazo, pago y castigo) y lo que pasó con los últimos. */
  drawPauseContracts(txt, add) {
    const reg = this.registry;
    const mine = [...contracts(reg)].sort((a, b) => a.due - b.due);
    add(this.add.image(24, 41, "ui-scroll").setOrigin(0, 0));
    txt(37, 42, `CONTRATOS ${mine.length}/${CONTRACT.maxActive}`, "font-gold");
    txt(24, 56, "Se toman en el tablón de la posada y se entregan en el mercado del destino.", "font-dim");
    if (!mine.length) txt(24, 76, "No llevas contratos. Mira el tablón junto al posadero de cualquier pueblo.", "font-dim");
    mine.forEach((c, i) => {
      const y = 76 + i * 34;
      const left = contractDaysLeft(reg, c);
      const have = contractCarried(reg, c);
      add(this.add.image(24, y + 4, `gem-${c.good}`).setOrigin(0, 0.5));
      txt(38, y, `${stonesText(c.good, c.qty)} a ${TOWNS[c.to].name} · hasta el día ${c.due}`, "font");
      txt(VIEW_W - 26, y, left <= 0 ? "vence hoy" : `quedan ${left} d`, left <= 0 ? "font-red" : "font-o").setOrigin(1, 0);
      const pay = `Llevas ${have}/${c.qty} · paga ${c.pay} oro + ${c.fame} fama`;
      txt(38, y + 12, pay, have >= c.qty ? "font-green" : "font-dim");
      txt(38 + textWidth(pay) + 6, y + 12, `· si fallas: -${c.penalty} fama`, "font-red");
    });
    const log = contractLog(reg).slice(0, 4);
    if (!log.length) return;
    txt(24, 154, "LOS ÚLTIMOS", "font-gold");
    log.forEach((c, i) => {
      const ok = c.result === "ok";
      txt(24, 166 + i * 12, `Día ${c.day} · ${ok ? "Cumplido" : "Vencido"}: ${stonesText(c.good, c.qty)} a ${TOWNS[c.to].name} ${ok ? `(+${c.pay} oro, +${c.fame} fama)` : `(-${c.penalty} fama)`}`, ok ? "font-green" : "font-red");
    });
  }

  /**
   * Pestaña OPCIONES: volumen de música, ambiente y efectos (←→ de 10 en 10 %) y salir al título.
   * Con el cursor arriba (en las pestañas), ←→ cambian de pestaña; ↓ baja a las opciones.
   */
  drawPauseOptions(p, txt, add) {
    txt(24, 42, "OPCIONES", "font-gold");
    const rows = [["music", "Música"], ["amb", "Ambiente"], ["sfx", "Efectos"]];
    const g = add(this.add.graphics());
    rows.forEach(([bus, label], i) => {
      const y = 62 + i * 18;
      const on = p.opt === i;
      txt(36, y, label, on ? "font-gold" : "font");
      const v = Math.round(getVolume(bus) * 10);
      for (let k = 0; k < 10; k += 1) {
        g.fillStyle(0x1b1422, 1).fillRect(130 + k * 9, y, 7, 9);
        g.fillStyle(k < v ? (on ? 0xe6b736 : 0xc1891e) : 0x3a3746, 1).fillRect(131 + k * 9, y + 1, 5, 7);
      }
      txt(230, y, `${v * 10} %`, on ? "font-gold" : "font-dim");
      if (on) txt(262, y, "←→", "font-dim");
    });
    const qy = 62 + rows.length * 18 + 8;
    txt(36, qy, p.quitArmed ? `¿Salir al título? ${keyName("confirm")} otra vez` : "Salir al título", p.opt === rows.length ? (p.quitArmed ? "font-red" : "font-gold") : "font");
    txt(36, qy + 12, "La partida se guarda al salir.", "font-dim");
    if (p.opt >= 0) txt(24, 62 + Math.min(p.opt, rows.length) * 18 + (p.opt >= rows.length ? 8 : 0), "▶", "font-gold");
    txt(24, 150, p.opt < 0 ? "↓ para elegir una opción" : `↑↓ elegir · ←→ ajustar · ${keyName("confirm")} aceptar`, "font-dim");
    txt(24, 170, "El volumen se guarda en este aparato.", "font-dim");
  }

  /**
   * Pestaña MAPA: sucesos con cuenta atrás ("!" rojo junto al pueblo) y rumores escuchados ("?" dorado;
   * tachado en rojo si al llegar resultó falso), con la lista abajo del mapa.
   */
  drawMapNews(p, mx, my, add, txt) {
    const reg = this.registry;
    const g = add(this.add.graphics());
    const events = eventList(reg);
    const marks = rumorMarks(reg);
    const tag = (x, y, char, font, crossed) => {
      g.fillStyle(0x1b1422, 1).fillRect(x - 1, y - 1, 7, 10);
      add(this.add.bitmapText(x + 1, y, font, char));
      if (crossed) g.fillStyle(0xe0493d, 1).fillRect(x - 2, y + 3, 9, 2);
    };
    for (const ev of events) {
      const [x, y] = WORLD_PINS[ev.town] ?? [];
      if (x == null) continue;
      tag(mx + x + 6, my + y - 10, "!", "font-red");
    }
    const seenTowns = new Set();
    for (const r of marks) {
      const key = r.town ?? r.route;
      if (seenTowns.has(key)) continue;
      seenTowns.add(key);
      // Rumor de un pueblo: junto al pueblo. De un refugio escondido: a medio camino de su ruta.
      const [a, b] = r.route ? MAPS[r.route]?.between ?? [] : [];
      const [x, y] = r.town ? WORLD_PINS[r.town] ?? [] : a && b ? [(WORLD_PINS[a][0] + WORLD_PINS[b][0]) / 2 + 8, (WORLD_PINS[a][1] + WORLD_PINS[b][1]) / 2 + 2] : [];
      if (x == null) continue;
      tag(mx + x - 11, my + y - 10, "?", r.checked === "false" ? "font-dim" : r.checked === "true" ? "font-green" : "font-gold", r.checked === "false");
    }
    // Listas abajo del mapa.
    const today = day(reg);
    txt(24, 172, "SUCESOS", "font-gold");
    if (!events.length) txt(24, 184, "Nada fuera de lo normal.", "font-dim");
    events.slice(0, 4).forEach((ev, i) => {
      txt(24, 184 + i * 11, `! ${ev.label}`, "font-red");
      txt(24 + textWidth(`! ${ev.label}`) + 6, 184 + i * 11, `quedan ${ev.days} ${ev.days === 1 ? "día" : "días"}`, "font-dim");
    });
    const rx = 250;
    txt(rx, 172, "RUMORES", "font-gold");
    if (!marks.length) txt(rx, 184, "Habla con la gente.", "font-dim");
    marks.slice(0, 4).forEach((r, i) => {
      const name = r.town ? TOWNS[r.town]?.name ?? "?" : r.route ? `${MAPS[r.route]?.name ?? "?"} (escondite)` : "?";
      const left = Math.max(0, (r.until ?? today) - today);
      const status = r.checked === "false" ? "falso" : r.checked === "true" ? "cierto" : left ? `${left} ${left === 1 ? "día" : "días"}` : "hoy";
      const font = r.checked === "false" ? "font-dim" : r.checked === "true" ? "font-green" : "font-o";
      txt(rx, 184 + i * 11, `? ${name}`, font);
      if (r.checked === "false") g.fillStyle(0xe0493d, 1).fillRect(rx, 188 + i * 11, textWidth(`? ${name}`), 1);
      txt(rx + textWidth(`? ${name}`) + 6, 184 + i * 11, status, "font-dim");
    });
  }

  /**
   * Mercader libre: pagaste toda la deuda. Panel al centro con la estrella, oro y la fama que ganas.
   * Resuelve al cerrarse (~2.8 s).
   */
  freeCeremony(fame) {
    return new Promise((resolve) => {
      const title = "Mercader libre";
      const line = "La deuda de tu padre está saldada. El cobrador no vuelve.";
      const bonus = `+${fame} de fama`;
      if (this.ceremony) this.endCeremony();
      const w = even(Math.max(textWidth(line), 140) + 28);
      const h = 96;
      const x = Math.round(VIEW_W / 2 - w / 2);
      const y = Math.round(VIEW_H / 2 - h / 2 - 8);
      const sy = y + 18;
      const box = this.add.container(0, 0).setDepth(D + 40);
      box.add(this.add.rectangle(x + 2, y + 2, w - 4, h - 4, 0x120e17, 0.92).setOrigin(0, 0));
      box.add(this.panel(x, y, "ui-dark", w, h));
      box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 38, "font-dim", "Sin deudas")));
      box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 51, "font-gold", title)));
      box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 66, "font-o", line)));
      box.add(centerX(this.add.bitmapText(VIEW_W / 2, y + 78, "font-green", bonus)));
      const star = this.add.image(VIEW_W / 2, sy, "ui-star").setScale(0);
      box.add(star);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const c = this.add.sprite(VIEW_W / 2, sy, "coin", 0).setAlpha(0);
        box.add(c);
        this.tweens.add({ targets: c, x: VIEW_W / 2 + Math.cos(a) * 40, y: sy + Math.sin(a) * 20, alpha: { from: 1, to: 0 }, delay: 160 + i * 30, duration: 620, ease: "Quad.Out" });
      }
      this.openBox(box, VIEW_W / 2, y + h / 2);
      this.tweens.add({ targets: star, scale: 3, duration: 420, ease: "Back.Out", easeParams: [3] });
      sfx(this, "jingle-fame", { volume: 0.4 });
      this.time.delayedCall(2800, () => this.closeBox(box, () => resolve()));
    });
  }

  updatePause() {
    const p = this.pauseState;
    // OPCIONES: con el cursor en una opción, ←→ ajustan en vez de cambiar de pestaña.
    if (p.index === 6 && this.updatePauseOptions(p)) return;
    if (p.skip && tutorialStep(this.registry) >= 0 && (this.controls.pressed("confirm") || this.controls.pressed("interact"))) {
      if (!p.skipArmed) {
        p.skipArmed = true;
        p.skip.setText(`¿Saltar el tutorial? ${keyName("confirm")} otra vez`).setFont("font-red");
        tone(this, "select");
      } else {
        const w = this.scene.get("world");
        if (w?.sys.isActive() && w.endTutorial) w.endTutorial(true);
        else { setTutorialStep(this.registry, -1); this.hideTutorial(); }
        p.skip.setText("Tutorial saltado").setFont("font-dim");
        tone(this, "confirm");
      }
    }
    if (this.controls.pressed("right")) { p.index = (p.index + 1) % p.tabs.length; tone(this, "select"); this.drawPause(); }
    if (this.controls.pressed("left")) { p.index = (p.index + p.tabs.length - 1) % p.tabs.length; tone(this, "select"); this.drawPause(); }
    if (this.controls.pressed("pause") || this.controls.pressed("cancel")) {
      tone(this, "select");
      this.tweens.killTweensOf(p.veil);
      this.tweens.add({ targets: p.veil, alpha: 0, duration: 90 });
      this.closeBox(p.panel, () => p.box.destroy());
      this.pauseState = null;
      this.mode = null;
      p.resolve();
    }
  }

  /** Teclas de la pestaña OPCIONES. Devuelve true si ya usó la tecla de este cuadro. */
  updatePauseOptions(p) {
    const buses = ["music", "amb", "sfx"];
    const last = buses.length; // "Salir al título"
    if (this.controls.pressed("down") && p.opt < last) { p.opt += 1; p.quitArmed = false; tone(this, "select"); this.drawPause(); return true; }
    if (this.controls.pressed("up") && p.opt >= 0) { p.opt -= 1; p.quitArmed = false; tone(this, "select"); this.drawPause(); return true; }
    if (p.opt < 0) return false;
    const dir = this.controls.pressed("right") ? 1 : this.controls.pressed("left") ? -1 : 0;
    if (dir && p.opt < last) {
      const bus = buses[p.opt];
      setVolume(bus, Math.round(getVolume(bus) * 10 + dir) / 10);
      // Se oye cómo queda: los efectos con un tono, el ambiente y la música ya suenan.
      tone(this, "select");
      this.drawPause();
      return true;
    }
    if (dir) return true;
    if (p.opt === last && (this.controls.pressed("confirm") || this.controls.pressed("interact"))) {
      if (!p.quitArmed) { p.quitArmed = true; tone(this, "select"); this.drawPause(); return true; }
      tone(this, "confirm");
      this.exitToTitle();
      return true;
    }
    // K sube a las pestañas (la pausa se cierra desde ahí, o con pausa).
    if (this.controls.pressed("cancel")) { p.opt = -1; p.quitArmed = false; tone(this, "select"); this.drawPause(); return true; }
    return !this.controls.pressed("pause");
  }

  /** Salir al título desde la pausa: guarda, cierra el mundo y vuelve a la pantalla de inicio. */
  exitToTitle() {
    const reg = this.registry;
    saveGame(reg);
    const p = this.pauseState;
    this.pauseState = null;
    this.mode = "leaving";
    this.clearNotices();
    this.cameras.main.fadeOut(300, 18, 14, 23);
    this.time.delayedCall(330, () => {
      p?.box.destroy();
      this.scene.stop("world");
      this.scene.start("title");
    });
  }

  // ------------------------------------------------------------------

  closeAll() {
    this.prompt(null);
    this.openedAt = this.time.now;
    // La tecla que abrió la ventana no debe contar como "confirmar" en el mismo cuadro.
    this.controls.lock(2);
  }

  /** Marco pixel a medida (cacheado por tamaño). Funciona igual en WebGL y en Canvas. */
  panelKey(style, w, h) {
    const W = Math.round(w);
    const H = Math.round(h);
    const key = `${style}@${W}x${H}`;
    if (!this.textures.exists(key)) {
      const [make, corner] = PANEL_SRC[style];
      this.textures.addCanvas(key, ninePatch(make(), W, H, corner).toCanvas());
    }
    return key;
  }

  panel(x, y, style, w, h) {
    return this.add.image(x, y, this.panelKey(style, w, h)).setOrigin(0, 0);
  }

  update(time, delta) {
    this.controls.update();
    // La línea de objetivo no se asoma por detrás de las ventanas grandes.
    const big = this.mode === "shop" || this.mode === "stash" || this.mode === "pause" || this.mode === "boat" || this.mode === "report" || this.mode === "board";
    this.goalText.setVisible(!big);
    this.leadText.setVisible(!big);
    this.eventText.setVisible(!big);
    for (const t of this.contractTexts) t.setVisible(!big);
    if (this.mode === "dialog" && this.dialog) this.updateDialog(delta);
    else if (this.mode === "choice" && this.choice) this.updateChoice();
    else if (this.mode === "shop" && this.shopState) this.updateShop();
    else if (this.mode === "pause" && this.pauseState) this.updatePause();
    else if (this.mode === "stash" && this.stashState) this.updateStash();
    else if (this.mode === "boat" && this.boatState) this.updateBoat();
    else if (this.mode === "report" && this.report) this.updateReport();
    else if (this.mode === "board" && this.boardState) this.updateBoard();
  }
}
