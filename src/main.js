import Phaser from "phaser";
import { BootScene } from "./scenes/boot.js";
import { TownScene } from "./scenes/town.js";
import { RoadScene } from "./scenes/road.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 450,
  backgroundColor: "#2a241c",
  render: { antialias: true, roundPixels: false },
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 450,
  },
  scene: [BootScene, TownScene, RoadScene],
});

// Mano para revisar escenas desde el navegador mientras trabajamos.
if (import.meta.env.DEV) globalThis.__stones = game;
