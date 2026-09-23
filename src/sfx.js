/** Efectos de los encuentros. CC0 en public/assets/proto/sfx/. */

import { getCurrentMusic, musicVolume } from "./music.js";

export const SFX = {
  horse: "assets/proto/sfx/horse.mp3",
  horn: "assets/proto/sfx/horn.mp3",
  cart: "assets/proto/sfx/cart.mp3",
  coins: "assets/proto/sfx/coins.mp3",
  knife: "assets/proto/sfx/knife.mp3",
  draw: "assets/proto/sfx/draw.mp3",
  latch: "assets/proto/sfx/latch.mp3",
  sack: "assets/proto/sfx/sack.mp3",
  chop: "assets/proto/sfx/chop.mp3",
  click: "assets/proto/sfx/click.mp3",
};

export function preloadSfx(scene) {
  for (const [name, url] of Object.entries(SFX)) {
    scene.load.audio(`sfx-${name}`, url);
  }
}

export function sfx(scene, name, extra = {}) {
  const key = `sfx-${name}`;
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, extra);
}

export function duckTheme(scene, volume = 0.1) {
  const theme = getCurrentMusic();
  if (theme) theme.setVolume(volume);
}

export function restoreTheme(scene) {
  const theme = getCurrentMusic();
  if (theme) theme.setVolume(musicVolume(theme.key));
}
