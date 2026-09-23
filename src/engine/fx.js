/** Efectos en el mundo: polvo, chispas, pasto cortado, texto que flota. */

import { DEPTH } from "../config.js";
import { centerX } from "../art/font.js";

export class Fx {
  constructor(scene) {
    this.scene = scene;
  }

  dust(x, y, scale = 1) {
    const s = this.scene.add.sprite(x + (Math.random() - 0.5) * 4, y - 2, "dust", 0).setDepth(y - 1).setScale(scale).setAlpha(0.85);
    s.play("dust");
    s.once("animationcomplete", () => s.destroy());
  }

  spark(x, y, red = false) {
    const s = this.scene.add.sprite(x, y, red ? "spark-red" : "spark", 0).setDepth(DEPTH.fx);
    s.play(red ? "spark-red" : "spark");
    s.once("animationcomplete", () => s.destroy());
  }

  poof(x, y) {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const s = this.scene.add.sprite(x, y, "dust", 0).setDepth(DEPTH.fx);
      this.scene.tweens.add({ targets: s, x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 8, duration: 260 });
      s.play("dust");
      s.once("animationcomplete", () => s.destroy());
    }
  }

  /** Pedacitos de pasto que saltan al cortar. */
  grassBurst(x, y, leaves = false) {
    for (let i = 0; i < 7; i += 1) {
      const s = this.scene.add.image(x + (Math.random() - 0.5) * 10, y - 6, leaves ? "leaf-bit" : "grass-bits", leaves ? undefined : i % 2).setDepth(DEPTH.fx);
      const dx = (Math.random() - 0.5) * 30;
      this.scene.tweens.add({ targets: s, x: s.x + dx, y: s.y - 10 - Math.random() * 10, duration: 180, ease: "Quad.Out" });
      this.scene.tweens.add({ targets: s, y: s.y + 6, alpha: 0, delay: 180, duration: 320, ease: "Quad.In", onComplete: () => s.destroy() });
    }
  }

  float(x, y, text, font = "font-o") {
    const t = centerX(this.scene.add.bitmapText(Math.round(x), Math.round(y), font, text)).setOrigin(0, 1).setDepth(DEPTH.fx + 5);
    this.scene.tweens.add({ targets: t, y: y - 16, duration: 700, ease: "Quad.Out" });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 300, onComplete: () => t.destroy() });
  }
}
