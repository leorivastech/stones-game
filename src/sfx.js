/**
 * Efectos. Todo es propio, generado con IA local (MOSS-SoundEffect v2; qué archivo es cada clave:
 * SFX_IA, TONOS y PASOS en src/audio-ia.js, archivos en public/assets/sfx-ia/). Los jingles son
 * stingers de ACE-Step (SFX_STINGER). Sólo el tecleo del diálogo (`tone(scene, "text")`) sigue
 * sintetizado con WebAudio; los demás tonos de 8 bits quedan de respaldo por si una muestra no cargó.
 * Todo pasa por el bus de efectos (setVolume("sfx", v) de music.js).
 */

import { SFX_IA, SFX_STINGER, TONOS, PASOS, sfxUrl } from "./audio-ia.js";
import { duckMusic, restoreMusic, getVolume, stinger, preloadMusic } from "./music.js";

export { setVolume, getVolume, setTension, stinger } from "./music.js";

/** Claves sin muestra propia que suenan con otra: el cuchillo del bandido silba como una flecha. */
const SFX_ALIAS = { knife: "bow" };

const iaKey = (file) => `sfx-ia-${file}`;
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

export function preloadSfx(scene) {
  const files = new Set();
  for (const { files: f } of [...Object.values(SFX_IA), ...Object.values(PASOS)]) f.forEach((x) => files.add(x));
  for (const f of files) scene.load.audio(iaKey(f), sfxUrl(f));
  preloadMusic(scene);
}

function hasSample(scene, name) {
  const ia = SFX_IA[name];
  return Boolean(ia) && ia.files.some((f) => scene.cache.audio.exists(iaKey(f)));
}

export function sfx(scene, name, extra = {}) {
  // Grabación de trailer (?capture=1, sin audio): se anota el sonido para ponerlo en su cuadro.
  if (globalThis.__captureSfx) globalThis.__captureSfx.push({ name, volume: extra.volume ?? 0.55 });
  if (SFX_STINGER[name]) {
    if (!globalThis.__captureSfx) stinger(SFX_STINGER[name], scene);
    return;
  }
  name = SFX_ALIAS[name] ?? name;
  const ia = SFX_IA[name];
  if (!ia) return;
  const key = iaKey(pickOne(ia.files));
  if (!scene.cache.audio.exists(key)) return;
  const volume = (extra.volume ?? 0.55) * (ia?.gain ?? 1) * getVolume("sfx");
  scene.sound.play(key, { ...extra, volume });
}

/** Una de varias muestras, con un poco de variación de tono para que no suene repetida. */
export function sfxVary(scene, names, volume = 0.5, spread = 120) {
  const name = pickOne(names);
  sfx(scene, name, { volume, detune: (Math.random() - 0.5) * 2 * spread });
}

let lastStep = null;

/** Paso según el suelo: pasto, nieve, piedra, madera, arena (cortes IA, nunca el mismo dos veces seguidas). */
export function footstep(scene, ground, volume = 0.16) {
  const set = PASOS[ground] ?? PASOS.grass;
  if (globalThis.__captureSfx) globalThis.__captureSfx.push({ name: `step-${ground}`, volume });
  let file = pickOne(set.files);
  if (file === lastStep && set.files.length > 1) file = pickOne(set.files.filter((f) => f !== lastStep));
  lastStep = file;
  const key = iaKey(file);
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: volume * set.gain * getVolume("sfx"), detune: (Math.random() - 0.5) * 300 });
}

/** Tonos de 8 bits: `text` siempre; los demás sólo si su muestra IA no cargó. */
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
  const sample = TONOS[name];
  if (sample && (globalThis.__captureSfx || sample[0].every((n) => hasSample(scene, n)))) {
    sfxVary(scene, sample[0], sample[1], 80);
    return;
  }
  const ctx = scene.sound.context;
  if (!ctx || scene.sound.locked || !TONES[name]) return;
  const now = ctx.currentTime;
  const bus = getVolume("sfx");
  if (bus <= 0) return;
  for (const t of TONES[name]) {
    const start = now + (t.at ?? 0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(t.vol * bus, start);
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

/** Baja la música (y un poco el ambiente) con fundido de 250 ms. `volume` como antes: 0.05-0.12. */
export function duckTheme(scene, volume = 0.1) {
  duckMusic(volume);
}

export function restoreTheme() {
  restoreMusic();
}
