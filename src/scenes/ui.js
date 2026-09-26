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
import { isNight } from "../engine/daylight.js"; // luz del día: sol / luna junto al día
import { MAPS } from "../maps/index.js";
import { tone, sfx } from "../sfx.js";
import {
  GOODS, GOOD_IDS, STONE, TOWNS, UPGRADES, buy, canBuy, capacity, cargo, cargoOf, chill, day, debt, flag, gold,
  hasUpgrade, heatLevel, hiddenCapacity, hp, load, localHeat, maxHp, priceOf, reputation, saveGame, sell, setFlag,
  seenOf, stones, rumors, fameTitle, nextFameTitle, moveStash, stashOf, stashCount, STASH_CAPACITY, STASH_RAID_HEAT,
  tonics, TONIC, townTips,
} from "../state.js";

const D = 20000;
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
    this.hearts.forEach((h, i) => {
      const v = life - i * 2;
      h.setTexture(v >= 2 ? "heart-full" : v === 1 ? "heart-half" : "heart-empty");
      h.setVisible(i < total);
    });
    if (this.lastHp != null && life < this.lastHp) {
      this.tweens.add({ targets: this.hearts, y: 7, duration: 60, yoyo: true });
    }
    this.lastHp = life;

    // Oro
    const g = gold(reg);
    if (this.lastGold != null && g !== this.lastGold) {
      this.tweens.add({ targets: this.goldText, y: 15, duration: 70, yoyo: true });
    }
    this.lastGold = g;
    this.goldText.setText(String(g));

    // Carga: una casilla por lugar; las primeras N son del fondo falso.
    const cap = capacity(reg);
    const hid = hiddenCapacity(reg);
    const x0 = 22 + textWidth(String(g)) + 8;
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
  }

  /** Cierra cualquier ventana abierta (por si el mapa cambió con una abierta). */
  resetModals() {
    for (const [key, obj] of [["dialog", this.dialog], ["choice", this.choice], ["shopState", this.shopState], ["pauseState", this.pauseState], ["stashState", this.stashState]]) {
      if (!obj) continue;
      obj.box.destroy();
      this[key] = null;
      obj.resolve(key === "choice" ? -1 : undefined);
    }
    this.mode = null;
  }

  enterMap(def) {
    this.resetModals();
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
    this.tweens.add({ targets: c, y: 34, duration: 320, ease: "Back.Out" });
    this.tweens.add({ targets: c, y: -40, delay: 2400, duration: 280, ease: "Quad.In", onComplete: () => c.destroy() });
  }

  /**
   * Lo que conviene en este pueblo hoy, con sus gemas: lo tuyo que aquí pagan bien, lo que ocupan
   * (venderlo da fama) y lo que sobra. Sale solo al llegar y se va.
   */
  townNeeds(townId, delay = 0) {
    this.needsObj?.destroy();
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
    const list = rows.slice(0, 3);
    const title = `HOY EN ${TOWNS[townId].name.toUpperCase()}`;
    const w = even(Math.max(textWidth(title), ...list.map((r) => textWidth(r.text) + 14)) + 16);
    const h = 18 + list.length * 13;
    const x = VIEW_W - w - 6;
    const c = this.add.container(VIEW_W + 4, 44).setDepth(D + 4);
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
  say(lines, { name } = {}) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "dialog";
      this.prompt(null);
      const box = this.add.container(0, 0).setDepth(D + 10);
      const bg = this.panel(8, VIEW_H - 70, "ui-paper", VIEW_W - 16, 62).setOrigin(0, 0);
      box.add(bg);
      if (name) {
        const tw = textWidth(name) + 14;
        const tag = this.panel(16, VIEW_H - 82, "ui-dark", tw, 17).setOrigin(0, 0);
        const tt = this.add.bitmapText(23, VIEW_H - 79, "font-gold", name);
        box.add([tag, tt]);
      }
      const text = this.add.bitmapText(20, VIEW_H - 62, "font-dark", "").setMaxWidth(VIEW_W - 44).setLineSpacing(2);
      const arrow = this.add.bitmapText(VIEW_W - 26, VIEW_H - 22, "font-dark", "▼").setVisible(false);
      box.add([text, arrow]);
      this.tweens.add({ targets: arrow, y: VIEW_H - 20, duration: 300, yoyo: true, repeat: -1 });
      box.setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, duration: 100 });
      const keys = (l) => l.replace(/\{(\w+)\}/g, (_, a) => keyName(a) || a);
      this.dialog = { box, text, arrow, lines: lines.map(keys), page: -1, shown: 0, full: "", resolve, tick: 0 };
      this.nextPage();
    });
  }

  nextPage() {
    const d = this.dialog;
    d.page += 1;
    if (d.page >= d.lines.length) {
      d.box.destroy();
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
      const w = even(Math.max(textWidth(title), ...options.map((o) => Math.max(textWidth(o.label) + 14, textWidth(o.note ?? ""))), 150) + 20);
      const h = 30 + options.length * 14 + 16;
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
      const noteText = this.add.bitmapText(x + 10, y + h - 15, "font-dim", "");
      box.add([cursor, noteText]);
      if (note) box.add(this.add.bitmapText(x + 10, y + h + 4, "font-o", note));
      box.setScale(0.96).setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 120 });
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
    c.box.destroy();
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
      const w = 420;
      const h = 196;
      const x = VIEW_W / 2 - w / 2;
      const y = VIEW_H / 2 - h / 2 - 4;
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h).setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-gold", `MERCADO DE ${TOWNS[townId].name.toUpperCase()}`));
      box.add(this.add.bitmapText(x + w - 10, y + 7, "font-dim", `${merchant} · día ${day(this.registry)}`).setOrigin(1, 0));
      box.add(this.add.bitmapText(x + 10, y + 20, "font-dim", `"${greeting?.[0] ?? "¿Qué llevas?"}"`).setMaxWidth(w - 20));
      const col = { name: x + 34, carry: x + 150, buy: x + 214, sell: x + 280, tag: x + 360 };
      const hy = y + 38;
      box.add(this.add.bitmapText(col.carry, hy, "font-dim", "Llevas").setOrigin(0.5, 0));
      box.add(this.add.bitmapText(col.buy, hy, "font-dim", "Te cobran").setOrigin(0.5, 0));
      box.add(this.add.bitmapText(col.sell, hy, "font-dim", "Te pagan").setOrigin(0.5, 0));
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
      const cursor = this.add.bitmapText(x + 10, y + 52, "font-gold", "▶");
      const info = this.add.bitmapText(x + 10, y + h - 40, "font-o", "").setMaxWidth(w - 20);
      const footer = this.add.bitmapText(x + 10, y + h - 27, "font-dim", "");
      const hint = this.add.bitmapText(x + 10, y + h - 14, "font-dim", `←→ comprar o vender · ↑↓ piedra · ${keyName("confirm")} confirmar · ${keyName("cancel")} salir`);
      box.add([cursor, info, footer, hint]);
      box.setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, duration: 120 });
      this.shopState = { townId, box, rows, cursor, pick, info, footer, col, index: 0, side: 0, resolve, x, y, w, sold: {} };
      // Arranca donde haya algo que hacer: vender lo que llevas, o comprar lo que aquí sobra.
      const carried = rows.findIndex((r) => cargoOf(this.registry, r.good) > 0);
      if (carried >= 0) { this.shopState.index = carried; this.shopState.side = 1; }
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
    const row = s.rows[s.index];
    s.cursor.setY(row.y);
    s.pick.setPosition(s.side === 0 ? s.col.buy : s.col.sell, row.y - 2);
    const q = priceOf(reg, s.townId, row.good);
    const mood = tips.wanted.some((w) => w.good === row.good) ? `Aquí la ocupan: te la pagan bien${tips.fameToday ? " y da fama" : ""}.` : tips.cheap.some((c) => c.good === row.good) ? "Aquí sobra: cómprala barata y llévala." : "";
    const frost = row.good === "frost" && cargoOf(reg, "frost") ? ` Tu escarcha: ${chill(reg)} % de frío.` : "";
    s.info.setText(`${STONE[row.good].trait} ${mood}${frost}`);
    const d = debt(reg);
    s.footer.setText(`Oro ${gold(reg)} · Carga ${load(reg)}/${capacity(reg)} · Fama ${reputation(reg)}${d.owed > 0 ? ` · Deuda ${d.owed}` : ""}`);
  }

  updateShop() {
    const s = this.shopState;
    const reg = this.registry;
    const n = s.rows.length;
    if (this.controls.pressed("down")) { s.index = (s.index + 1) % n; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("up")) { s.index = (s.index + n - 1) % n; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("left") || this.controls.pressed("right")) { s.side = 1 - s.side; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("cancel")) return this.closeShop();
    if (this.time.now - this.openedAt < 250) return;
    if (!(this.controls.pressed("confirm") || this.controls.pressed("interact"))) return;
    const row = s.rows[s.index];
    const buying = s.side === 0;
    const res = buying ? buy(reg, s.townId, row.good) : sell(reg, s.townId, row.good);
    const cell = buying ? row.buy : row.sell;
    if (!res) {
      tone(this, "deny");
      this.tweens.add({ targets: cell, x: cell.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    if (!buying) s.sold[row.good] = (s.sold[row.good] ?? 0) + 1;
    sfx(this, buying ? "gem" : "coins-sell", { volume: 0.5 });
    tone(this, "pickup");
    const t = this.add.bitmapText(cell.x, row.y - 2, buying ? "font-red" : "font-gold", buying ? `-${res.price}` : `+${res.price}`)
      .setOrigin(0.5, 1).setDepth(D + 20);
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    if (res.fame) {
      // Vendiste lo que aquí ocupan: la gente habla de ti.
      const f = this.add.bitmapText(s.col.tag, row.y - 2, "font-green", `+${res.fame} fama`).setOrigin(0.5, 1).setDepth(D + 20);
      this.tweens.add({ targets: f, y: f.y - 16, alpha: 0, delay: 250, duration: 1100, onComplete: () => f.destroy() });
      const title = fameTitle(reputation(reg));
      sfx(this, title !== this.lastTitle ? "jingle-fame" : "jingle-mission", { volume: 0.4 });
      if (this.lastTitle && title !== this.lastTitle) this.toast(`Ahora eres ${title}`, "font-gold");
    }
    this.lastTitle = fameTitle(reputation(reg));
    if (buying) {
      const gem = this.add.image(row.icon.x + 4, row.icon.y, `gem-${row.good}`).setDepth(D + 20);
      this.tweens.add({ targets: gem, x: 60, y: 20, duration: 380, ease: "Quad.In", onComplete: () => gem.destroy() });
    }
    this.drawShop();
    saveGame(reg);
  }

  closeShop() {
    const s = this.shopState;
    // En línea, vender de a varias es noticia para los demás (y para los rumores).
    if (online.on && Object.values(s.sold).reduce((a, n) => a + n, 0) >= 2) send({ t: "sold", town: s.townId, sold: s.sold });
    tone(this, "select");
    s.box.destroy();
    this.shopState = null;
    this.mode = null;
    s.resolve();
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
      box.setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, duration: 120 });
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
      s.box.destroy();
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
      const box = this.add.container(0, 0).setDepth(D + 30);
      box.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x120e17, 0.82).setOrigin(0, 0));
      box.add(this.panel(8, 8, "ui-dark", VIEW_W - 16, VIEW_H - 16).setOrigin(0, 0));
      const tabs = ["MAPA", "CARGA", "FAMA", "MERCADOS", "CONTROLES"];
      const tabTexts = tabs.map((t, i) => {
        const txt = this.add.bitmapText(22 + i * 88, 17, "font-dim", t);
        box.add(txt);
        return txt;
      });
      box.add(this.add.rectangle(16, 31, VIEW_W - 32, 1, 0x8c5e13).setOrigin(0, 0));
      box.add(this.add.bitmapText(VIEW_W - 22, VIEW_H - 24, "font-dim", `←→ pestañas · ${keyName("cancel")} volver`).setOrigin(1, 0));
      const page = this.add.container(0, 0);
      box.add(page);
      this.pauseState = { box, tabs, tabTexts, page, index: 0, resolve, def };
      this.drawPause();
    });
  }

  drawPause() {
    const p = this.pauseState;
    const reg = this.registry;
    p.tabTexts.forEach((t, i) => t.setFont(i === p.index ? "font-gold" : "font-dim"));
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
      const side = 258;
      txt(side, 42, p.def.name, "font-gold");
      txt(side, 54, p.def.subtitle, "font-dim");
      txt(side, 74, "Recorrido", "font-gold");
      // El camino por tierra y la barca; lo que conviene cambia cada día en todos lados.
      const lines = [
        "Ashfen → Valkeep →",
        "Verdelume → Duneshade →",
        "Mossgrove → Frostholm.",
        "Todos compran de todo, y",
        "lo que buscan cambia cada",
        "día: mira los precios y",
        "oye los rumores.",
        flag(reg, "met-ferry") ? "La barca cruza el golfo:" : "Dicen que en Frostholm",
        flag(reg, "met-ferry") ? "Frostholm y Ashfen." : "hay un barquero.",
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
        const extra = id === "frost" ? ` · ${chill(reg)} % frío` : id === "rain" ? " · 2 lugares c/u" : "";
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
      txt(24, 184, "Los precios cambian cada día: lo que sobra baja, lo que falta sube.", "font-dim");
      txt(24, 196, "Nadie te paga más que la Corona. Vender sube el calor del pueblo.", "font-dim");
      txt(24, 208, "Los rumores de la gente traen noticias frescas.", "font-dim");
    } else {
      // Dos grupos iguales: WASD + J K L, o flechas + Z X C. En celular, los botones.
      const rows = touch.on ? [
        ["Mover", "palanca (mitad izquierda)"],
        ["Acción: hablar · usar · golpear · elegir", "A"],
        ["Rodar (tocar) · correr (mantener) · salir", "B"],
        ["Agacharse · esconderse en pasto alto", "C"],
        ["Beber tónico (2 corazones)", "T"],
        ["Pausa y mapa", "II"],
        ["Bajar un escalón", "caminar hacia abajo"],
      ] : [
        ["Mover", "WASD  o  flechas"],
        ["Acción: hablar · usar · golpear · elegir", "J  o  Z"],
        ["Rodar (tocar) · correr (mantener) · salir", "K  o  X"],
        ["Agacharse · esconderse en pasto alto", "L  o  C"],
        ["Beber tónico (2 corazones)", "I  o  V"],
        ["Pausa y mapa", "ESC  o  P"],
        ["Bajar un escalón", "caminar hacia abajo"],
      ];
      txt(24, 42, "CONTROLES", "font-gold");
      rows.forEach(([a, b], i) => {
        txt(24, 58 + i * 14, a);
        txt(VIEW_W - 26 - textWidth(b), 58 + i * 14, b, "font-gold");
      });
      txt(24, 180, "Control: A acción · B rodar · X agacharse · Y tónico · Start pausa", "font-dim");
      txt(24, 196, "Guardias: revisan si llevas piedras a la vista.", "font-dim");
      txt(24, 208, "Bandidos: te arrancan piedras; recógelas antes que ellos.", "font-dim");
    }
  }

  updatePause() {
    const p = this.pauseState;
    if (this.controls.pressed("right")) { p.index = (p.index + 1) % p.tabs.length; tone(this, "select"); this.drawPause(); }
    if (this.controls.pressed("left")) { p.index = (p.index + p.tabs.length - 1) % p.tabs.length; tone(this, "select"); this.drawPause(); }
    if (this.controls.pressed("pause") || this.controls.pressed("cancel")) {
      tone(this, "select");
      p.box.destroy();
      this.pauseState = null;
      this.mode = null;
      p.resolve();
    }
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
    if (this.mode === "dialog" && this.dialog) this.updateDialog(delta);
    else if (this.mode === "choice" && this.choice) this.updateChoice();
    else if (this.mode === "shop" && this.shopState) this.updateShop();
    else if (this.mode === "pause" && this.pauseState) this.updatePause();
    else if (this.mode === "stash" && this.stashState) this.updateStash();
    else if (this.mode === "boat" && this.boatState) this.updateBoat();
  }
}
