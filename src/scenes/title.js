/** Pantalla de título: Ashfen de fondo, cámara que pasea, logo y menú. */

import Phaser from "phaser";
import { MAPS } from "../maps/index.js";
import { buildMap } from "../engine/mapbuild.js";
import { Controls } from "../engine/input.js";
import { VIEW_H, VIEW_W } from "../config.js";
import { startMusic } from "../music.js";
import { tone } from "../sfx.js";
import { hasSave, loadGame, resetRun } from "../state.js";
import { centerX } from "../art/font.js";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create() {
    const world = buildMap(this, MAPS.ashfen);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.W, world.H);
    cam.scrollX = 120;
    cam.scrollY = 20;
    this.tweens.add({ targets: cam, scrollX: 40, scrollY: 150, duration: 26000, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    cam.fadeIn(600, 18, 14, 23);

    const ui = this.cameras.add(0, 0, VIEW_W, VIEW_H);
    const top = this.add.container(0, 0).setDepth(30000);
    // Velo para que se lea el logo
    const veil = this.add.graphics();
    for (let i = 0; i < 20; i += 1) {
      veil.fillStyle(0x120e17, 0.5 - i * 0.022);
      veil.fillRect(0, i * 6, VIEW_W, 6);
    }
    veil.fillStyle(0x120e17, 0.55);
    veil.fillRect(0, VIEW_H - 90, VIEW_W, 90);
    top.add(veil);
    const logo = this.add.image(VIEW_W / 2, 58, "logo").setOrigin(0.5, 0.5);
    top.add(logo);
    this.tweens.add({ targets: logo, y: 61, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    top.add(centerX(this.add.bitmapText(VIEW_W / 2, 90, "font-gold", "contrabando de piedras de hechizo")));

    this.options = [];
    if (hasSave()) this.options.push({ label: "Continuar", act: () => this.go(true) });
    this.options.push({ label: "Nueva partida", act: () => this.go(false) });
    this.rows = this.options.map((o, i) => {
      const t = centerX(this.add.bitmapText(VIEW_W / 2, 190 + i * 16, "font", o.label));
      top.add(t);
      return t;
    });
    this.cursor = this.add.bitmapText(0, 190, "font-gold", "▶");
    top.add(this.cursor);
    top.add(centerX(this.add.bitmapText(VIEW_W / 2, VIEW_H - 16, "font-dim", "E / ENTER elegir · ↑↓ mover")));
    this.index = 0;
    this.moveCursor(0);

    // La cámara del mundo no dibuja la interfaz y viceversa.
    cam.ignore(top);
    ui.ignore(this.children.list.filter((c) => c !== top));

    this.controls = new Controls(this);
    this.controls.lock(10);
    startMusic(this, "ashfen");
    this.busy = false;
  }

  moveCursor(d) {
    this.index = (this.index + d + this.options.length) % this.options.length;
    const row = this.rows[this.index];
    this.cursor.setPosition(row.x - 14, row.y);
    this.rows.forEach((r, i) => r.setFont(i === this.index ? "font-gold" : "font"));
  }

  update() {
    if (this.busy) return;
    this.controls.update();
    if (this.controls.pressed("down")) { this.moveCursor(1); tone(this, "select"); }
    if (this.controls.pressed("up")) { this.moveCursor(-1); tone(this, "select"); }
    if (this.controls.pressed("confirm") || this.controls.pressed("interact")) {
      tone(this, "confirm");
      this.options[this.index].act();
    }
  }

  go(resume) {
    this.busy = true;
    if (!resume || !loadGame(this.registry)) resetRun(this.registry);
    const map = resume ? this.registry.get("mapId") ?? "ashfen" : "ashfen";
    this.cameras.main.fadeOut(400, 18, 14, 23);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!this.scene.isActive("ui")) this.scene.launch("ui");
      this.scene.start("world", { map, entry: "start", intro: !resume });
    });
  }
}
