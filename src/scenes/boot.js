import Phaser from "phaser";
import { buildArt } from "../art/index.js";
import { registerFonts } from "../art/font.js";
import { CASTS, SHEET_INDEX, POSE } from "../art/actors.js";
import { preloadSfx } from "../sfx.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    // Efectos, la música del título y los stingers; las demás pistas se bajan cuando suenan (music.js).
    preloadSfx(this);
  }

  create() {
    // Todo el arte se hornea aquí, en píxeles, y se sube como texturas.
    for (const entry of buildArt()) {
      const tex = this.textures.addCanvas(entry.key, entry.buf.toCanvas());
      if (entry.frameWidth) {
        for (let i = 0; i < entry.frames; i += 1) tex.add(i, 0, i * entry.frameWidth, 0, entry.frameWidth, entry.frameHeight);
      }
      if (entry.meta) this.registry.set(`meta-${entry.key}`, entry.meta);
    }
    registerFonts(this);
    this.makeAnims();
    this.scene.start("title");
  }

  makeAnims() {
    const a = this.anims;
    const seq = (key, frames, frameRate, repeat = -1) => a.create({
      key, frames: frames.map((f) => ({ key: key.split(":")[0], frame: f })), frameRate, repeat,
    });
    for (const cast of Object.keys(CASTS)) {
      for (const [dir, base] of Object.entries(SHEET_INDEX)) {
        const walk = POSE.walk.map((f) => ({ key: `cast-${cast}`, frame: base + f }));
        // 6 cuadros de paso: 13/s caminando y 20/s corriendo (la misma zancada que 4 a 9 y 14).
        a.create({ key: `${cast}-walk-${dir}`, frames: walk, frameRate: 13, repeat: -1 });
        a.create({ key: `${cast}-run-${dir}`, frames: walk, frameRate: 20, repeat: -1 });
        // Ataque cargado listo: brilla y tiembla (dos cuadros, uno corrido 1 px).
        a.create({ key: `${cast}-charge-${dir}`, frames: POSE.charge.map((f) => ({ key: `cast-${cast}`, frame: base + f })), frameRate: 18, repeat: -1 });
        // Trabajo (el herrero martilla: 1.2 s por golpe) y acomodar (el comerciante estira las manos).
        const at = (f, duration) => ({ key: `cast-${cast}`, frame: base + f, duration });
        a.create({ key: `${cast}-work-${dir}`, frames: [at(POSE.idle, 420), at(POSE.windup, 480), at(POSE.strike, 300)], frameRate: 1000, repeat: -1 });
        a.create({ key: `${cast}-reach-${dir}`, frames: [at(POSE.windup, 260), at(POSE.strike, 340)], frameRate: 1000, repeat: 1 });
        // Respirar: quieto un rato, cabeza abajo un momento.
        a.create({
          key: `${cast}-idle-${dir}`,
          frames: [{ key: `cast-${cast}`, frame: base + POSE.idle, duration: 700 }, { key: `cast-${cast}`, frame: base + POSE.breathe, duration: 380 }],
          frameRate: 1000, repeat: -1,
        });
      }
    }
    a.create({ key: "roll", frames: [0, 1, 2, 3].map((f) => ({ key: "roll", frame: f })), frameRate: 18, repeat: -1 });
    for (const dir of ["right", "down", "left", "up"]) {
      a.create({ key: `slash-${dir}`, frames: [0, 1, 2].map((f) => ({ key: `slash-${dir}`, frame: f })), frameRate: 20, repeat: 0 });
      a.create({ key: `slash-wide-${dir}`, frames: [0, 1, 2, 3].map((f) => ({ key: `slash-wide-${dir}`, frame: f })), frameRate: 22, repeat: 0 });
      a.create({ key: `claw-${dir}`, frames: [0, 1, 2].map((f) => ({ key: `claw-${dir}`, frame: f })), frameRate: 18, repeat: 0 });
    }
    a.create({ key: "boar-walk", frames: [0, 1].map((f) => ({ key: "boar", frame: f })), frameRate: 6, repeat: -1 });
    a.create({ key: "boar-run", frames: [0, 1].map((f) => ({ key: "boar", frame: f })), frameRate: 14, repeat: -1 });
    a.create({ key: "wolf-walk", frames: [0, 1].map((f) => ({ key: "wolf", frame: f })), frameRate: 7, repeat: -1 });
    a.create({ key: "wolf-run", frames: [0, 1].map((f) => ({ key: "wolf", frame: f })), frameRate: 16, repeat: -1 });
    a.create({ key: "scorpion-walk", frames: [0, 1].map((f) => ({ key: "scorpion", frame: f })), frameRate: 8, repeat: -1 });
    // Vistas de frente (4-5) y de espalda (6-7): el sprite elige según hacia dónde va (enemies.js).
    for (const [kind, walk, run] of [["boar", 6, 14], ["wolf", 7, 16], ["scorpion", 8, 12]]) {
      for (const [view, base] of [["down", 4], ["up", 6]]) {
        const frames = [0, 1].map((f) => ({ key: kind, frame: base + f }));
        a.create({ key: `${kind}-walk-${view}`, frames, frameRate: walk, repeat: -1 });
        a.create({ key: `${kind}-run-${view}`, frames, frameRate: run, repeat: -1 });
      }
    }
    // Caballo: 0-3 de lado, 4-7 de frente, 8-11 de espalda.
    [["side", 0], ["down", 4], ["up", 8]].forEach(([view, base]) => {
      a.create({ key: `horse-${view}`, frames: [0, 1, 2, 3].map((f) => ({ key: "horse", frame: base + f })), frameRate: 8, repeat: -1 });
      a.create({ key: `cart-${view}`, frames: [0, 1, 2, 3].map((f) => ({ key: `cart-${view}`, frame: f })), frameRate: 8, repeat: -1 });
    });
    a.create({ key: "dust", frames: [0, 1, 2, 3].map((f) => ({ key: "dust", frame: f })), frameRate: 16, repeat: 0 });
    a.create({ key: "spark", frames: [0, 1, 2].map((f) => ({ key: "spark", frame: f })), frameRate: 22, repeat: 0 });
    a.create({ key: "spark-red", frames: [0, 1, 2].map((f) => ({ key: "spark-red", frame: f })), frameRate: 22, repeat: 0 });
    a.create({ key: "coin", frames: [0, 1, 2, 3].map((f) => ({ key: "coin", frame: f })), frameRate: 8, repeat: -1 });
    for (const v of [0, 1, 2]) a.create({ key: `tallgrass-${v}`, frames: [0, 1].map((f) => ({ key: `tallgrass-${v}`, frame: f })), frameRate: 10, repeat: 1 });
    a.create({ key: "campfire", frames: [0, 1, 2].map((f) => ({ key: "campfire", frame: f })), frameRate: 8, repeat: -1 });
    a.create({ key: "forge", frames: [0, 1].map((f) => ({ key: "forge", frame: f })), frameRate: 4, repeat: -1 });
    a.create({ key: "smoke", frames: [0, 1, 2, 3].map((f) => ({ key: "smoke", frame: f })), frameRate: 2, repeat: 0 });
    a.create({ key: "glint", frames: [0, 1, 2, 3, 3, 3, 3, 3].map((f) => ({ key: "glint", frame: f })), frameRate: 6, repeat: -1, repeatDelay: 1400 });
    a.create({ key: "stone-burst", frames: [0, 1, 2].map((f) => ({ key: "stone-burst", frame: f })), frameRate: 16, repeat: 0 });
    void seq;
  }
}
