import Phaser from "phaser";
import { bakeAll } from "../gfx/bake.js";
import { preloadSfx } from "../sfx.js";
import { resetRun } from "../state.js";

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
    bakeAll(this);
    resetRun(this.registry);
    this.scene.start("town", { id: "ashfen", spawn: "plaza" });
  }
}
