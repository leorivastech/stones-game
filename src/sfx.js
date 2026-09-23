/**
 * Efectos. Muestras CC0 (public/assets/sfx/ y proto/sfx/, créditos en public/assets/CREDITS.md)
 * + tonitos sintetizados (WebAudio) para lo que no tiene muestra: texto, salto, alertas.
 * Si un tono tiene muestra (SAMPLE_TONES), suena la muestra.
 */

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

// Muestras nuevas (Kenney, OpenGameArt; CC0). Nombre = archivo en assets/sfx/.
const NEW = [
  "bow", "arrow-hit", "swing", "swing2", "hit", "hit2", "armor", "bump", "die", "wolf", "growl", "boar", "scorpion",
  "step-grass", "step-grass2", "step-snow", "step-snow2", "step-stone", "step-stone2", "step-wood", "step-wood2",
  "step-sand", "step-sand2", "door-open", "door-close", "chest", "lever", "splash", "coin", "coins-sell", "gem",
  "ui-move", "ui-ok", "ui-back", "ui-error", "jingle-mission", "jingle-fame", "jingle-free", "jingle-buy",
];
for (const n of NEW) SFX[n] = `assets/sfx/${n}.ogg`;

/** Tonos que suenan con muestra: [nombres posibles, volumen]. Se elige una al azar. */
const SAMPLE_TONES = {
  swing: [["swing", "swing2"], 0.35],
  hit: [["hit", "hit2"], 0.5],
  bump: [["bump"], 0.5],
  select: [["ui-move"], 0.3],
  confirm: [["ui-ok"], 0.4],
  deny: [["ui-error"], 0.4],
  pickup: [["coin"], 0.35],
};

export function preloadSfx(scene) {
  for (const [name, url] of Object.entries(SFX)) scene.load.audio(`sfx-${name}`, url);
}

export function sfx(scene, name, extra = {}) {
  // Grabación de trailer (?capture=1, sin audio): se anota el sonido para ponerlo en su cuadro.
  if (globalThis.__captureSfx) globalThis.__captureSfx.push({ name, volume: extra.volume ?? 0.55 });
  const key = `sfx-${name}`;
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: 0.55, ...extra });
}

/** Una de varias muestras, con un poco de variación de tono para que no suene repetida. */
export function sfxVary(scene, names, volume = 0.5, spread = 120) {
  const name = names[Math.floor(Math.random() * names.length)];
  sfx(scene, name, { volume, detune: (Math.random() - 0.5) * 2 * spread });
}

/** Paso según el suelo: pasto, nieve, piedra, madera, arena. */
export function footstep(scene, ground, volume = 0.16) {
  sfxVary(scene, [`step-${ground}`, `step-${ground}2`], volume, 150);
}

const TONES = {
  swing: [{ type: "square", f0: 520, f1: 180, dur: 0.07, vol: 0.05 }, { type: "noise", dur: 0.06, vol: 0.05 }],
  hit: [{ type: "square", f0: 220, f1: 60, dur: 0.1, vol: 0.09 }, { type: "noise", dur: 0.08, vol: 0.08 }],
  hurt: [{ type: "sawtooth", f0: 300, f1: 90, dur: 0.22, vol: 0.08 }],
  roll: [{ type: "noise", dur: 0.12, vol: 0.05, lowpass: 900 }],
  cut: [{ type: "noise", dur: 0.09, vol: 0.07, lowpass: 3000 }],
  pickup: [{ type: "square", f0: 880, f1: 880, dur: 0.05, vol: 0.05 }, { type: "square", f0: 1320, f1: 1320, dur: 0.08, vol: 0.05, at: 0.05 }],
  heart: [{ type: "triangle", f0: 660, f1: 990, dur: 0.18, vol: 0.09 }],
  select: [{ type: "square", f0: 740, f1: 740, dur: 0.03, vol: 0.035 }],
  confirm: [{ type: "square", f0: 660, f1: 660, dur: 0.04, vol: 0.04 }, { type: "square", f0: 990, f1: 990, dur: 0.06, vol: 0.04, at: 0.04 }],
  deny: [{ type: "square", f0: 180, f1: 150, dur: 0.12, vol: 0.05 }],
  alert: [{ type: "square", f0: 988, f1: 988, dur: 0.06, vol: 0.06 }, { type: "square", f0: 1318, f1: 1318, dur: 0.1, vol: 0.06, at: 0.07 }],
  suspect: [{ type: "triangle", f0: 500, f1: 700, dur: 0.14, vol: 0.06 }],
  jump: [{ type: "square", f0: 300, f1: 600, dur: 0.12, vol: 0.045 }],
  land: [{ type: "noise", dur: 0.05, vol: 0.05, lowpass: 600 }],
  text: [{ type: "square", f0: 520, f1: 520, dur: 0.018, vol: 0.02 }],
  charge: [{ type: "sawtooth", f0: 120, f1: 220, dur: 0.3, vol: 0.05 }],
  bump: [{ type: "square", f0: 90, f1: 50, dur: 0.12, vol: 0.08 }],
  chest: [{ type: "square", f0: 523, f1: 523, dur: 0.08, vol: 0.05 }, { type: "square", f0: 659, f1: 659, dur: 0.08, vol: 0.05, at: 0.09 }, { type: "square", f0: 784, f1: 784, dur: 0.08, vol: 0.05, at: 0.18 }, { type: "square", f0: 1046, f1: 1046, dur: 0.2, vol: 0.05, at: 0.27 }],
};

let noiseBuffer = null;

export function tone(scene, name) {
  const sample = SAMPLE_TONES[name];
  if (sample && (globalThis.__captureSfx || sample[0].every((n) => scene.cache.audio.exists(`sfx-${n}`)))) {
    sfxVary(scene, sample[0], sample[1], 80);
    return;
  }
  const ctx = scene.sound.context;
  if (!ctx || scene.sound.locked || !TONES[name]) return;
  const now = ctx.currentTime;
  for (const t of TONES[name]) {
    const start = now + (t.at ?? 0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(t.vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    let src;
    if (t.type === "noise") {
      if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
      }
      src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      if (t.lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = t.lowpass;
        src.connect(f);
        f.connect(gain);
      } else src.connect(gain);
    } else {
      src = ctx.createOscillator();
      src.type = t.type;
      src.frequency.setValueAtTime(t.f0, start);
      src.frequency.exponentialRampToValueAtTime(Math.max(20, t.f1), start + t.dur);
      src.connect(gain);
    }
    gain.connect(scene.sound.masterVolumeNode ?? ctx.destination);
    src.start(start);
    src.stop(start + t.dur + 0.02);
  }
}

export function duckTheme(scene, volume = 0.1) {
  const theme = getCurrentMusic();
  if (theme) theme.setVolume(volume);
}

export function restoreTheme() {
  const theme = getCurrentMusic();
  if (theme) theme.setVolume(musicVolume(theme.key));
}
