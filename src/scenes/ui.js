/**
 * Interfaz encima del mundo: HUD, cartel de lugar, indicador de acción, avisos,
 * diálogos, elecciones, mercado y pausa. Todo en píxeles, con la fuente propia.
 */

import Phaser from "phaser";
import { Controls } from "../engine/input.js";
import { VIEW_H, VIEW_W } from "../config.js";
import { centerX, textWidth } from "../art/font.js";
import { WORLD_PINS, WORLD_ROADS, panelDark, panelPaper, panelTag } from "../art/ui.js";
import { ninePatch } from "../art/pixel.js";
import { tone, sfx } from "../sfx.js";
import {
  GOODS, MAX_DEMAND, MAX_STOCK, TOWNS, UPGRADES, buy, canBuy, canSell, capacity, cargo, flag, gold, hasUpgrade,
  heatLevel, hiddenCapacity, hp, localHeat, marketQuote, maxHp, reputation, saveGame, sell, setFlag, stones,
  moveStash, stashOf, stashCount, STASH_CAPACITY, STASH_RAID_HEAT, tonics, TONIC,
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
    this.tonicIcon = this.add.image(7, 28, "tonic").setOrigin(0, 0);
    this.tonicText = this.add.bitmapText(18, 29, "font-o", "");
    this.hud.add([this.coinIcon, this.goldText, this.eye, ...this.pips, this.star, this.fameText, this.tonicIcon, this.tonicText]);
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
    const list = [];
    const c = cargo(reg);
    for (const id of Object.keys(GOODS)) for (let i = 0; i < (c[id] ?? 0); i += 1) list.push(id);
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
    this.tonicText.setVisible(tn > 0).setText(`${tn} · Q`);

    // Alerta
    const heat = localHeat(reg, this.def);
    const lvl = heatLevel(heat);
    this.eye.setTexture(`ui-eye-${lvl}`);
    const on = Math.min(5, Math.ceil(heat / 20));
    this.pips.forEach((p, i) => p.setTexture(i < on ? "ui-pip-on" : "ui-pip-off"));
    this.fameText.setText(String(reputation(reg)));
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
    this.def = def;
    if (def.kind === "town") setFlag(this.registry, `visited-${def.town}`);
    this.refresh();
    this.banner(def.name, def.subtitle);
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
      this.dialog = { box, text, arrow, lines: [...lines], page: -1, shown: 0, full: "", resolve, tick: 0 };
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
  choose(title, options, { note } = {}) {
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
      let index = options.findIndex((o) => !o.disabled);
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

  shop(townId, merchant, greeting) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "shop";
      const w = 300;
      const h = 176;
      const x = VIEW_W / 2 - w / 2;
      const y = VIEW_H / 2 - h / 2 - 4;
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h).setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-gold", `MERCADO DE ${TOWNS[townId].name.toUpperCase()}`));
      box.add(this.add.bitmapText(x + w - 10, y + 7, "font-dim", merchant).setOrigin(1, 0));
      const greet = this.add.bitmapText(x + 10, y + 22, "font-dim", `"${greeting?.[0] ?? "¿Qué llevas?"}"`).setMaxWidth(w - 20);
      box.add(greet);
      const rows = [0, 1, 2].map((i) => {
        const r = {
          icon: this.add.image(x + 22, y + 58 + i * 26, "gem-amber").setOrigin(0, 0.5),
          label: this.add.bitmapText(x + 36, y + 52 + i * 26, "font", ""),
          sub: this.add.bitmapText(x + 36, y + 63 + i * 26, "font-dim", ""),
          price: this.add.bitmapText(x + w - 14, y + 52 + i * 26, "font-gold", "").setOrigin(1, 0),
        };
        box.add([r.icon, r.label, r.sub, r.price]);
        return r;
      });
      const cursor = this.add.bitmapText(x + 10, y + 52, "font-gold", "▶");
      const footer = this.add.bitmapText(x + 10, y + h - 26, "font-dim", "");
      const hint = this.add.bitmapText(x + 10, y + h - 14, "font-dim", "E confirmar · ↑↓ elegir · ESC salir");
      box.add([cursor, footer, hint]);
      box.setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, duration: 120 });
      this.shopState = { townId, box, rows, cursor, footer, index: 0, resolve, x, y, w };
      this.drawShop();
    });
  }

  drawShop() {
    const s = this.shopState;
    const reg = this.registry;
    const q = marketQuote(reg, s.townId);
    const payer = Object.values(TOWNS).find((t) => t.need === q.produce.id);
    const carried = cargo(reg)[q.need.id] ?? 0;
    const [rb, rs, rx] = s.rows;
    rb.icon.setTexture(`gem-${q.produce.id}`).setVisible(true);
    rb.label.setText(`Comprar ${q.produce.name}`).setFont(canBuy(reg, s.townId) ? "font" : "font-dim");
    rb.sub.setText(q.stock <= 0 ? "Sin existencias" : stones(reg) >= capacity(reg) ? "Carga llena" : `Quedan ${q.stock}/${MAX_STOCK} · se paga en ${payer?.name ?? "?"}`);
    rb.price.setText(`${q.buyPrice} oro`);
    rs.icon.setTexture(`gem-${q.need.id}`).setVisible(true);
    rs.label.setText(`Vender ${q.need.name}`).setFont(canSell(reg, s.townId) ? "font" : "font-dim");
    rs.sub.setText(q.demand <= 0 ? "Pedido agotado · vuelve después" : carried ? `Llevas ${carried} · piden ${q.demand}/${MAX_DEMAND}` : `No llevas · piden ${q.demand}/${MAX_DEMAND}`);
    rs.price.setText(`${q.sellPrice} oro`);
    rx.icon.setVisible(false);
    rx.label.setText("Salir").setFont("font");
    rx.sub.setText("");
    rx.price.setText("");
    s.cursor.setY(s.y + 52 + s.index * 26);
    s.footer.setText(`Oro ${gold(reg)} · Carga ${stones(reg)}/${capacity(reg)} · Fama ${reputation(reg)}`);
  }

  updateShop() {
    const s = this.shopState;
    const reg = this.registry;
    if (this.controls.pressed("down")) { s.index = (s.index + 1) % 3; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("up")) { s.index = (s.index + 2) % 3; tone(this, "select"); this.drawShop(); }
    if (this.controls.pressed("cancel")) return this.closeShop();
    if (this.time.now - this.openedAt < 250) return;
    if (!(this.controls.pressed("confirm") || this.controls.pressed("interact"))) return;
    if (s.index === 2) return this.closeShop();
    const res = s.index === 0 ? buy(reg, s.townId) : sell(reg, s.townId);
    const row = s.rows[s.index];
    if (!res) {
      tone(this, "deny");
      this.tweens.add({ targets: row.label, x: row.label.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    sfx(this, s.index === 0 ? "sack" : "coins", { volume: 0.5 });
    tone(this, "pickup");
    const t = this.add.bitmapText(s.x + s.w - 14, row.price.y - 2, s.index === 0 ? "font-red" : "font-gold", s.index === 0 ? `-${res.price}` : `+${res.price}`)
      .setOrigin(1, 1).setDepth(D + 20);
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    const gem = this.add.image(row.icon.x + 4, row.icon.y, `gem-${res.good.id}`).setDepth(D + 20);
    this.tweens.add({ targets: gem, x: 60, y: 20, duration: 380, ease: "Quad.In", onComplete: () => gem.destroy() });
    this.drawShop();
    saveGame(reg);
  }

  closeShop() {
    const s = this.shopState;
    tone(this, "select");
    s.box.destroy();
    this.shopState = null;
    this.mode = null;
    s.resolve();
  }

  // ------------------------------------------------------------------ alijo

  /** Ventana del alijo: ↑↓ elige piedra, → guarda, ← saca. */
  stash(id, def, heat) {
    return new Promise((resolve) => {
      this.closeAll();
      this.mode = "stash";
      const w = 260;
      const rowsN = Object.keys(GOODS).length;
      const h = 58 + rowsN * 16 + 30;
      const x = VIEW_W / 2 - w / 2;
      const y = VIEW_H / 2 - h / 2 - 6;
      const box = this.add.container(0, 0).setDepth(D + 12);
      box.add(this.panel(x, y, "ui-dark", w, h).setOrigin(0, 0));
      box.add(this.add.bitmapText(x + 10, y + 7, "font-gold", "ALIJO"));
      const count = this.add.bitmapText(x + w - 10, y + 7, "font-dim", "").setOrigin(1, 0);
      box.add(count);
      box.add(this.add.bitmapText(x + 118, y + 24, "font-dim", "Carga"));
      box.add(this.add.bitmapText(x + 196, y + 24, "font-dim", "Alijo"));
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
      const hint = this.add.bitmapText(x + 10, y + h - 15, "font-dim", "→ guardar · ← sacar · ↑↓ elegir · ESC salir");
      box.add([cursor, warn, hint]);
      box.setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, duration: 120 });
      this.stashState = { id, box, rows, cursor, count, index: 0, resolve, y };
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
    s.count.setText(`${stashCount(reg, s.id)}/${STASH_CAPACITY} · carga ${stones(reg)}/${capacity(reg)}`);
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
      const tabs = ["MAPA", "CARGA", "MERCADOS", "CONTROLES"];
      const tabTexts = tabs.map((t, i) => {
        const txt = this.add.bitmapText(22 + i * 76, 17, "font-dim", t);
        box.add(txt);
        return txt;
      });
      box.add(this.add.rectangle(16, 31, VIEW_W - 32, 1, 0x8c5e13).setOrigin(0, 0));
      box.add(this.add.bitmapText(VIEW_W - 22, VIEW_H - 24, "font-dim", "←→ pestañas · ESC volver").setOrigin(1, 0));
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
      // Cada pueblo compra lo que produce el anterior: el círculo paga completo.
      const lines = [
        "Cada pueblo compra lo",
        "que hace el anterior:",
        "Ashfen → Valkeep →",
        "Verdelume → Duneshade →",
        "Frostholm → Ashfen.",
        "",
        flag(reg, "met-ferry") ? "La barca cruza el golfo." : "Dicen que en Frostholm",
        flag(reg, "met-ferry") ? "Frostholm y Ashfen." : "hay un barquero.",
      ];
      lines.forEach((l, i) => txt(side, 86 + i * 12, l, "font-dim"));
    } else if (p.index === 1) {
      txt(24, 42, "VIDA", "font-gold");
      const hearts = Math.ceil(maxHp(reg) / 2);
      for (let i = 0; i < hearts; i += 1) {
        const v = hp(reg) - i * 2;
        add(this.add.image(24 + i * 10, 56, v >= 2 ? "heart-full" : v === 1 ? "heart-half" : "heart-empty").setOrigin(0, 0));
      }
      txt(24, 74, "ORO", "font-gold");
      add(this.add.sprite(24, 88, "coin", 0).setOrigin(0, 0));
      txt(36, 86, String(gold(reg)));
      txt(24, 106, "FAMA", "font-gold");
      txt(24, 118, `${reputation(reg)}`);
      txt(24, 138, "TÓNICOS", "font-gold");
      add(this.add.image(24, 151, "tonic").setOrigin(0, 0));
      txt(36, 152, `${tonics(reg)}/${TONIC.max}  (Q)`);
      txt(24, 172, "ALIJOS", "font-gold");
      const stashes = Object.entries(reg.get("stashes") ?? {}).filter(([id]) => stashCount(reg, id) > 0);
      if (!stashes.length) txt(24, 184, hasUpgrade(reg, "stashKit") ? "Vacíos." : "Sin herrajes.", "font-dim");
      stashes.slice(0, 5).forEach(([id, st], i) => {
        const label = id.replace(/^r(\d)-/, "Ruta $1 · ");
        txt(24, 184 + i * 11, label, "font-dim");
        let gx = 24 + textWidth(label) + 4;
        for (const [g, n] of Object.entries(st)) {
          if (!n) continue;
          add(this.add.image(gx, 184 + i * 11, `gem-${g}`).setOrigin(0, 0));
          txt(gx + 11, 184 + i * 11, String(n));
          gx += 22;
        }
      });
      txt(150, 42, `CARGA ${stones(reg)}/${capacity(reg)}`, "font-gold");
      const c = cargo(reg);
      let row = 0;
      for (const [id, good] of Object.entries(GOODS)) {
        const n = c[id] ?? 0;
        if (!n) continue;
        add(this.add.image(150, 56 + row * 14, `gem-${id}`).setOrigin(0, 0));
        txt(164, 56 + row * 14, `${good.name} × ${n}`);
        row += 1;
      }
      if (!row) txt(150, 56, "Vacía.", "font-dim");
      if (hiddenCapacity(reg)) txt(150, 56 + Math.max(1, row) * 14 + 4, `Fondo falso: ${hiddenCapacity(reg)} ocultas`, "font-green");
      txt(150, 134, "MEJORAS", "font-gold");
      Object.values(UPGRADES).forEach((u, i) => {
        const owned = hasUpgrade(reg, u.id);
        txt(150, 146 + i * 20, owned ? u.name : `${u.name} (fama ${u.reputation})`, owned ? "font-green" : "font-dim");
        txt(158, 156 + i * 20, u.effect, "font-dim");
      });
    } else if (p.index === 2) {
      txt(24, 42, "Lo que sabes de cada mercado", "font-gold");
      txt(24, 58, "Pueblo", "font-dim");
      txt(120, 58, "Vende", "font-dim");
      txt(250, 58, "Compra", "font-dim");
      txt(380, 58, "Calor", "font-dim");
      Object.values(TOWNS).forEach((t, i) => {
        const y = 74 + i * 22;
        const known = flag(reg, `visited-${t.id}`);
        txt(24, y, known ? t.name : "???", known ? "font" : "font-dim");
        if (!known) return;
        const q = marketQuote(reg, t.id);
        add(this.add.image(120, y, `gem-${q.produce.id}`).setOrigin(0, 0));
        txt(134, y, `${q.buyPrice} oro · ${q.stock}/${MAX_STOCK}`);
        add(this.add.image(250, y, `gem-${q.need.id}`).setOrigin(0, 0));
        txt(264, y, `${q.sellPrice} oro · ${q.demand}/${MAX_DEMAND}`);
        const lvl = heatLevel(q.heat);
        add(this.add.image(380, y - 1, `ui-eye-${lvl}`).setOrigin(0, 0));
        txt(396, y, String(q.heat), lvl >= 2 ? "font-red" : "font");
      });
      txt(24, 196, "Vender sube el calor del pueblo. Viajar lo enfría.", "font-dim");
      txt(24, 208, "Con calor alto hay más guardias y ven más lejos.", "font-dim");
    } else {
      const rows = [
        ["Mover", "WASD / flechas"],
        ["Atacar · cortar", "J / ESPACIO"],
        ["Rodar (tocar) · correr (mantener)", "K / SHIFT"],
        ["Agacharse · esconderse en pasto alto", "L / C"],
        ["Hablar · usar · comerciar", "E"],
        ["Beber tónico (2 corazones)", "Q"],
        ["Pausa", "ESC / ENTER"],
        ["Bajar un escalón", "caminar hacia abajo"],
      ];
      txt(24, 42, "CONTROLES", "font-gold");
      rows.forEach(([a, b], i) => {
        txt(24, 58 + i * 14, a);
        txt(VIEW_W - 26 - textWidth(b), 58 + i * 14, b, "font-gold");
      });
      txt(24, 180, "Control: A atacar · B rodar · X agacharse · Y usar · LB tónico", "font-dim");
      txt(24, 196, "Guardias: revisan si llevas piedras a la vista.", "font-dim");
      txt(24, 208, "Bandidos: te arrancan piedras; recógelas antes que ellos.", "font-dim");
    }
  }

  updatePause() {
    const p = this.pauseState;
    if (this.controls.pressed("right")) { p.index = (p.index + 1) % 4; tone(this, "select"); this.drawPause(); }
    if (this.controls.pressed("left")) { p.index = (p.index + 3) % 4; tone(this, "select"); this.drawPause(); }
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
  }
}
