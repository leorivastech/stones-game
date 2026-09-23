import Phaser from "phaser";
import { buildArt } from "../art/index.js";
import { registerFonts } from "../art/font.js";
import { CASTS, SHEET_INDEX } from "../art/actors.js";
import { preloadSfx } from "../sfx.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.audio("music-ashfen", "assets/proto/music/ashfen-small-fire.ogg");
    this.load.audio("music-road", "assets/proto/music/road-iremos-forest.ogg");
    this.load.audio("music-valkeep", "assets/proto/music/valkeep-mystical-town.ogg");
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
        a.create({ key: `${cast}-walk-${dir}`, frames: [0, 1, 2, 3].map((f) => ({ key: `cast-${cast}`, frame: base + f })), frameRate: 8, repeat: -1 });
        a.create({ key: `${cast}-run-${dir}`, frames: [0, 1, 2, 3].map((f) => ({ key: `cast-${cast}`, frame: base + f })), frameRate: 13, repeat: -1 });
      }
    }
    a.create({ key: "roll", frames: [0, 1, 2, 3].map((f) => ({ key: "roll", frame: f })), frameRate: 18, repeat: -1 });
    for (const dir of ["right", "down", "left", "up"]) {
      a.create({ key: `slash-${dir}`, frames: [0, 1, 2].map((f) => ({ key: `slash-${dir}`, frame: f })), frameRate: 20, repeat: 0 });
      a.create({ key: `claw-${dir}`, frames: [0, 1, 2].map((f) => ({ key: `claw-${dir}`, frame: f })), frameRate: 18, repeat: 0 });
    }
    a.create({ key: "boar-walk", frames: [0, 1].map((f) => ({ key: "boar", frame: f })), frameRate: 6, repeat: -1 });
    a.create({ key: "boar-run", frames: [0, 1].map((f) => ({ key: "boar", frame: f })), frameRate: 14, repeat: -1 });
    a.create({ key: "wolf-walk", frames: [0, 1].map((f) => ({ key: "wolf", frame: f })), frameRate: 7, repeat: -1 });
    a.create({ key: "wolf-run", frames: [0, 1].map((f) => ({ key: "wolf", frame: f })), frameRate: 16, repeat: -1 });
    a.create({ key: "scorpion-walk", frames: [0, 1].map((f) => ({ key: "scorpion", frame: f })), frameRate: 8, repeat: -1 });
    a.create({ key: "horse-walk", frames: [0, 1, 2, 3].map((f) => ({ key: "horse", frame: f })), frameRate: 9, repeat: -1 });
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
