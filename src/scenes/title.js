/**
 * Pantalla de título: Ashfen de fondo, cámara que pasea, logo y menú.
 *
 * Un solo enlace para todo: "Solo" (la partida de siempre, guardada en este aparato) o "En línea"
 * (pide el nombre, revisa que el servidor conteste y recarga la página con ?online=1&nombre=…).
 * Con esos parámetros en el enlace se entra directo al modo en línea; desde ahí "Jugar solo" regresa.
 */

import Phaser from "phaser";
import { MAPS } from "../maps/index.js";
import { buildMap } from "../engine/mapbuild.js";
import { Controls, keyName } from "../engine/input.js";
import { VIEW_H, VIEW_W } from "../config.js";
import { startMusic } from "../music.js";
import { tone } from "../sfx.js";
import { hasSave, loadGame, resetRun, eraseSave } from "../state.js";
import { online, probeServer, modeUrl } from "../net/online.js";
import { askName } from "../net/hud.js";
import { centerX } from "../art/font.js";
import { canFullscreen, isFullscreen, toggleFullscreen } from "../engine/touch.js";

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
    this.rows = [];
    this.top = top;
    this.headText = null;
    top.add(centerX(this.add.bitmapText(VIEW_W / 2, VIEW_H - 16, "font-dim", `${keyName("confirm")} elegir · ↑↓ mover`)));
    // En línea hay que esperar al servidor: de ahí salen el nombre, el mercado, tu avance y dónde empiezas.
    if (online.on) this.waitServer();
    else this.modeMenu();

    // La cámara del mundo no dibuja la interfaz y viceversa.
    cam.ignore(top);
    ui.ignore(this.children.list.filter((c) => c !== top));

    // Al entrar o salir de pantalla completa, el menú cambia el letrero de esa opción.
    const onFull = () => this.refreshMenu?.();
    const onInstallable = () => this.refreshMenu?.();
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("webkitfullscreenchange", onFull);
    window.addEventListener("pwa-installable", onInstallable);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("webkitfullscreenchange", onFull);
      window.removeEventListener("pwa-installable", onInstallable);
    });

    this.controls = new Controls(this);
    this.controls.lock(10);
    startMusic(this, "title");
    this.busy = false;
  }

  /** Cambia el menú: un letrero arriba (opcional) y las opciones [{ label, act }]. */
  setMenu(head, options, { font = "font-gold", refresh = null, index = 0 } = {}) {
    const top = this.top;
    this.refreshMenu = refresh;
    for (const r of this.rows) r.destroy();
    this.cursor?.destroy();
    this.cursor = null;
    this.headText?.destroy();
    this.headText = head ? centerX(this.add.bitmapText(VIEW_W / 2, 172, font, head)) : null;
    if (this.headText) top.add(this.headText);
    this.options = options;
    const y0 = 190 + Math.max(0, 3 - options.length) * 4;
    this.rows = options.map((o, i) => {
      const t = centerX(this.add.bitmapText(VIEW_W / 2, y0 + i * 14, "font", o.label));
      t.setInteractive({ useHandCursor: true });
      t.on("pointerdown", () => {
        if (this.busy) return;
        this.index = i;
        this.moveCursor(0);
        tone(this, "confirm");
        o.act();
      });
      top.add(t);
      return t;
    });
    if (options.length) {
      this.cursor = this.add.bitmapText(0, y0, "font-gold", "▶");
      top.add(this.cursor);
    }
    this.cameras.cameras[0].ignore(top);
    this.index = Math.min(index, Math.max(0, options.length - 1));
    this.moveCursor(0);
  }

  /**
   * "Pantalla completa" (compu, Android y iPad; en iPhone Safari no existe y la opción no sale).
   * Los menús que la llevan se vuelven a pintar al cambiar, sin mover el cursor.
   */
  fullOption() {
    if (!canFullscreen()) return [];
    return [{ label: isFullscreen() ? "Salir de pantalla completa" : "Pantalla completa", act: () => toggleFullscreen() }];
  }

  installOption() {
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator?.standalone;
    if (isStandalone) return [];
    return [{
      label: "Instalar aplicación",
      act: () => this.handleInstall(),
    }];
  }

  async handleInstall() {
    if (window.__deferredPrompt) {
      window.__deferredPrompt.prompt();
      try {
        const choice = await window.__deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          window.__deferredPrompt = null;
          this.setMenu("¡Aplicación instalada!", [
            { label: "Continuar", act: () => this.modeMenu() },
          ]);
          return;
        }
      } catch {
        /* nada */
      }
      this.modeMenu();
      return;
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      this.setMenu("Instalar en iPhone / iPad", [
        { label: "1. Toca Compartir (icono cuadrado con flecha)", act: () => {} },
        { label: "2. Selecciona 'Agregar a inicio'", act: () => {} },
        { label: "‹ Volver", act: () => this.modeMenu() },
      ]);
    } else {
      this.setMenu("Instalar en tu dispositivo", [
        { label: "Abre el menú del navegador (: o ⋮)", act: () => {} },
        { label: "y elige 'Instalar app' o 'Agregar a inicio'", act: () => {} },
        { label: "‹ Volver", act: () => this.modeMenu() },
      ]);
    }
  }

  /** Sin ?online=1: elegir cómo jugar. */
  modeMenu() {
    this.setMenu(null, [
      { label: "Solo", act: () => this.soloMenu() },
      { label: "En línea", act: () => this.goOnline() },
      ...this.installOption(),
      ...this.fullOption(),
    ], { refresh: () => this.modeMenu(), index: this.refreshMenu ? this.index : 0 });
  }

  soloMenu() {
    const opts = [];
    if (hasSave()) opts.push({ label: "Continuar", act: () => this.go(true) });
    opts.push({ label: "Nueva partida", act: () => this.go(false) });
    opts.push({ label: "‹ Volver", act: () => this.modeMenu() });
    this.setMenu("Solo", opts);
  }

  /** "En línea": nombre, ¿contesta el servidor?, y a recargar en modo en línea. */
  async goOnline() {
    this.busy = true;
    const name = await askName({ force: true, cancel: true });
    this.controls.lock(8);
    if (!name) { this.busy = false; this.modeMenu(); return; }
    this.setMenu("Buscando el mundo…", [], { font: "font-dim" });
    const ok = await probeServer(4000);
    if (ok) {
      this.setMenu(`Entrando como ${name}…`, [], { font: "font-dim" });
      location.href = modeUrl(true, name);
      return;
    }
    this.busy = false;
    this.setMenu("El servidor no responde", [
      { label: "Reintentar", act: () => this.goOnline() },
      { label: "Jugar solo", act: () => this.soloMenu() },
    ], { font: "font-red" });
  }

  /** Con ?online=1: esperar la bienvenida del servidor; si en 4 s no llega, avisar y ofrecer jugar solo. */
  waitServer() {
    this.setMenu(online.name ? "Conectando al mundo…" : "Escribe tu nombre", [], { font: "font-dim" });
    let since = null;
    let warned = false;
    const tick = this.time.addEvent({ delay: 150, loop: true, callback: () => {
      if (online.connected) {
        tick.remove();
        this.onlineMenu();
        return;
      }
      if (!online.name) return;
      since ??= this.time.now;
      if (!warned && this.time.now - since > 4000) {
        warned = true;
        this.setMenu("El servidor no responde", [
          { label: "Seguir intentando", act: () => { tick.remove(); this.waitServer(); } },
          { label: "Jugar solo", act: () => { location.href = modeUrl(false); } },
        ], { font: "font-red" });
      }
    } });
  }

  onlineMenu() {
    const opts = [];
    if (hasSave()) {
      opts.push({ label: "Continuar", act: () => this.go(true) });
      opts.push({ label: "Empezar de cero", act: () => this.confirmReset() });
    } else opts.push({ label: "Entrar al mundo", act: () => this.go(false) });
    opts.push({ label: "Cambiar nombre", act: () => this.rename() });
    opts.push({ label: "Jugar solo", act: () => { location.href = modeUrl(false); } });
    opts.push(...this.installOption());
    opts.push(...this.fullOption());
    this.setMenu(`En línea como ${online.name}`, opts, { refresh: () => this.onlineMenu(), index: this.refreshMenu ? this.index : 0 });
  }

  confirmReset() {
    this.setMenu("¿Borrar tu avance en línea?", [
      { label: "No, volver", act: () => this.onlineMenu() },
      { label: "Sí, empezar de cero", act: () => { eraseSave(); this.go(false); } },
    ], { font: "font-red" });
  }

  async rename() {
    this.busy = true;
    const name = await askName({ force: true, cancel: true });
    this.controls.lock(8);
    this.busy = false;
    if (name && name !== online.name) location.href = modeUrl(true, name);
    else if (name) this.onlineMenu();
  }

  moveCursor(d) {
    if (!this.rows.length) return;
    this.index = (this.index + d + this.options.length) % this.options.length;
    const row = this.rows[this.index];
    this.cursor.setPosition(row.x - 14, row.y);
    this.rows.forEach((r, i) => r.setFont(i === this.index ? "font-gold" : "font"));
  }

  update() {
    if (this.busy || !this.rows.length) return;
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
    const home = online.on && online.start ? online.start : "ashfen";
    const map = resume ? this.registry.get("mapId") ?? home : home;
    this.cameras.main.fadeOut(400, 18, 14, 23);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!this.scene.isActive("ui")) this.scene.launch("ui");
      this.scene.start("world", { map, entry: "start", intro: !resume });
    });
  }
}
