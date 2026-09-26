/**
 * Música y ambiente por lugar, todo generado con IA local (qué archivo suena: src/audio-ia.js).
 * El SoundManager persiste entre escenas; aquí vive un mezclador chico que corre en cada paso del juego.
 *
 * - Música por capas: cada zona suena con DOS pistas en loop, arrancadas juntas (misma tonalidad y bpm):
 *   calma y tensión. `setTension(0..1)` cruza entre las dos (800 ms). La persecución (`startMusic(scene,
 *   "chase")`, como antes) sube la tensión a 1; el calor de la ruta pone una base (0.25 con calor ≥45,
 *   0.4 con ≥70). Cambiar de zona es un fundido cruzado.
 * - Ambiente: loops de 3-5 s por bioma (dos copias desfasadas para que no se note la costura);
 *   la selva cambia aves por grillos de noche.
 * - Buses: música / ambiente / efectos, con volumen del jugador guardado en localStorage (`stones-vol`).
 * - Ducking con fundido (`duckMusic`/`restoreMusic`, que usan duckTheme/restoreTheme de sfx.js).
 * - Stingers (`stinger(name)`): baja la música 1.5 s y toca el clip. Amanecer y anochecer suenan solos.
 *
 * Los mapas siguen declarando `music: "road"`, `"refuge"`… (CLAVE_ZONA / MAP_ZONA en audio-ia.js).
 */

import {
  ELEGIDAS, MUSIC_VOLUME, CLAVE_ZONA, MAP_ZONA, STINGERS, STINGER_VOLUME, AMBIENTES,
  musicUrl, stingerUrl, sfxUrl,
} from "./audio-ia.js";
import { localHeat, heatLevel } from "./state.js";
import { isNight, daylightPhase } from "./engine/daylight.js";

// ------------------------------------------------------------------ buses (volumen del jugador)

const BUS_KEY = "stones-vol";
const bus = { music: 1, amb: 1, sfx: 1 };
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
try {
  const saved = JSON.parse(localStorage.getItem(BUS_KEY) ?? "null");
  if (saved) for (const k of Object.keys(bus)) if (k in saved) bus[k] = clamp01(saved[k]);
} catch { /* sin almacenamiento */ }

/** Volumen de un bus ("music" | "amb" | "sfx"), 0..1. Se guarda para la próxima partida. */
export function setVolume(name, value) {
  if (!(name in bus)) return;
  bus[name] = clamp01(value);
  try { localStorage.setItem(BUS_KEY, JSON.stringify(bus)); } catch { /* sin almacenamiento */ }
  apply();
}

export function getVolume(name) {
  return bus[name] ?? 1;
}

// ------------------------------------------------------------------ fundidos (independientes de la escena)
// Los tweens de Phaser mueren con su escena y el mundo se reinicia en cada mapa: un fundido a medias
// dejaría una pista sonando. Estos corren con el paso del juego.

const fades = [];
const now = () => performance.now();

function cancelFade(obj, prop) {
  for (let i = fades.length - 1; i >= 0; i -= 1) {
    if (fades[i].obj === obj && (!prop || fades[i].prop === prop)) fades.splice(i, 1);
  }
}

function fadeTo(obj, prop, to, ms, done) {
  cancelFade(obj, prop);
  if (ms <= 0 || obj[prop] === to) {
    obj[prop] = to;
    done?.();
    return;
  }
  fades.push({ obj, prop, from: obj[prop], to, t0: now(), ms, done });
}

function tickFades() {
  const t = now();
  for (let i = fades.length - 1; i >= 0; i -= 1) {
    const f = fades[i];
    const k = Math.min(1, (t - f.t0) / f.ms);
    f.obj[f.prop] = f.from + (f.to - f.from) * (0.5 - 0.5 * Math.cos(Math.PI * k));
    if (k >= 1) {
      fades.splice(i, 1);
      f.done?.();
    }
  }
}

// ------------------------------------------------------------------ estado

let game = null;
let worldScene = null; // el mundo que suena (para calor y hora); null en el título
const mix = { tension: 0, duck: 1, sting: 1 };
let tensionTarget = 0;
let chase = false;
let manualTension = 0;
let heatBase = 0;

let currentZone = null;
let loadingScene = null;
let deck = null; // { zona, calm, tense, fade, L }
const dying = new Set();

let ambName = null; // clave del mapa ("jungle"…)
let ambWant = null; // clave de audio que debería sonar
let amb = null; // { key, sounds, vol, fade }
const ambDying = new Set();

let lastPhase = null;
let nightNow = null;
let pollAt = 0;
let stingTimer = null;

function hook(scene) {
  if (game || !scene?.game) return;
  game = scene.game;
  game.events.on("step", onStep);
}

function onStep() {
  tickFades();
  const t = now();
  if (t >= pollAt) {
    pollAt = t + 1000;
    poll();
  }
  apply();
}

function liveScene() {
  if (worldScene?.sys?.isActive()) return worldScene;
  return game?.scene.getScenes(true)[0] ?? null;
}

// ------------------------------------------------------------------ mezcla

function setVol(sound, v) {
  const vol = Math.max(0, v);
  if (sound._iaVol !== undefined && Math.abs(sound._iaVol - vol) < 0.0005) return;
  sound._iaVol = vol;
  sound.volume = vol;
}

/** Fundido corto en la costura del loop (las pistas no fueron hechas para repetirse sin pausa). */
function seam(d) {
  if (!d.calm.isPlaying) return 1;
  const p = d.calm.seek;
  return Math.max(0, Math.min(1, p / 0.15, (d.L - p) / 0.3));
}

function apply() {
  const t = mix.tension;
  const gCalm = Math.cos((t * Math.PI) / 2);
  const gTense = Math.sin((t * Math.PI) / 2);
  const m = MUSIC_VOLUME * bus.music * mix.duck * mix.sting;
  for (const d of [deck, ...dying]) {
    if (!d) continue;
    const v = m * d.fade * seam(d);
    setVol(d.calm, v * (d.tense ? gCalm : 1));
    if (d.tense) setVol(d.tense, v * gTense);
  }
  const a = bus.amb * Math.sqrt(mix.duck * mix.sting); // el ambiente baja, pero menos que la música
  for (const d of [amb, ...ambDying]) {
    if (!d) continue;
    for (const s of d.sounds) setVol(s, d.vol * d.fade * a);
  }
}

function retarget() {
  const target = Math.max(chase ? 1 : 0, manualTension, heatBase);
  if (target === tensionTarget) return;
  tensionTarget = target;
  fadeTo(mix, "tension", target, 800);
}

/**
 * Tensión de la música, 0 (calma) a 1 (tensión), con cruce de 800 ms. Es un piso: la persecución y el
 * calor la pueden subir más. `setTension(0)` lo quita.
 */
export function setTension(value) {
  manualTension = clamp01(value);
  retarget();
}

export function getTension() {
  return mix.tension;
}

/** Calor, hora del día y stingers de amanecer/anochecer (una vez por segundo). */
function poll() {
  const w = worldScene;
  if (!w?.sys?.isActive() || !w.def || !w.registry) return;
  const level = heatLevel(localHeat(w.registry, w.def));
  const base = level >= 3 ? 0.4 : level >= 2 ? 0.25 : 0;
  if (base !== heatBase) {
    heatBase = base;
    retarget();
  }
  const night = isNight(w.registry);
  if (night !== nightNow) {
    nightNow = night;
    refreshAmbience(w);
  }
  const phase = daylightPhase(w.registry);
  if (lastPhase && phase !== lastPhase) {
    if (phase === "amanecer" || (lastPhase === "noche" && phase === "dia")) stinger("amanecer", w);
    else if (phase === "noche") stinger("anochecer", w);
  }
  lastPhase = phase;
}

// ------------------------------------------------------------------ carga

/** Carga (si hace falta) varias pistas y llama `then` cuando todas están listas. */
function ensureAll(scene, list, then) {
  const missing = list.filter(([key]) => !scene.cache.audio.exists(key));
  if (!missing.length) {
    then();
    return;
  }
  let left = missing.length;
  for (const [key, url] of missing) {
    scene.load.audio(key, url);
    scene.load.once(`filecomplete-audio-${key}`, () => {
      left -= 1;
      if (!left) then();
    });
  }
  scene.load.once("loaderror", (file) => {
    if (missing.some(([key]) => key === file.key)) console.warn(`No cargó ${file.url ?? file.key}`);
  });
  scene.load.start();
}

const zoneKey = (zona, capa) => `mia-${zona}-${capa}`;

/** Lo que baja el arranque: la música del título y los stingers (chicos). Lo demás, cuando suena. */
export function preloadMusic(scene) {
  scene.load.audio(zoneKey("title", "calma"), musicUrl("title", "calma", ELEGIDAS.title.calma));
  for (const name of Object.keys(STINGERS)) scene.load.audio(`mia-stinger-${name}`, stingerUrl(name));
}

// ------------------------------------------------------------------ música

function zoneFor(scene, area) {
  const mapId = scene.def ? scene.mapId : null;
  if (area !== "title" && mapId && MAP_ZONA[mapId]) return MAP_ZONA[mapId];
  return CLAVE_ZONA[area] ?? (ELEGIDAS[area] ? area : "ashfen");
}

function soundFor(scene, key) {
  return scene.sound.get(key) ?? scene.sound.add(key, { loop: true, volume: 0 });
}

function switchTo(scene, zona) {
  // Si la zona venía bajando (ida y vuelta rápida), se rescata.
  for (const d of dying) {
    if (d.zona !== zona) continue;
    cancelFade(d);
    dying.delete(d);
  }
  const cfg = ELEGIDAS[zona];
  const calm = soundFor(scene, zoneKey(zona, "calma"));
  const tense = cfg.tension ? soundFor(scene, zoneKey(zona, "tension")) : null;
  // Las dos capas repiten con el mismo largo para no desfasarse.
  const L = tense ? Math.min(calm.totalDuration, tense.totalDuration) : calm.totalDuration;
  for (const s of [calm, tense]) {
    if (!s) continue;
    s.stop();
    if (s.markers.loop) s.removeMarker("loop");
    s.addMarker({ name: "loop", start: 0, duration: L, config: { loop: true } });
    s._iaVol = undefined;
  }
  calm.play("loop", { volume: 0 });
  tense?.play("loop", { volume: 0 });
  const next = { zona, calm, tense, fade: 0, L };
  if (deck) {
    const old = deck;
    dying.add(old);
    fadeTo(old, "fade", 0, 650, () => {
      old.calm.stop();
      old.tense?.stop();
      dying.delete(old);
    });
  }
  deck = next;
  fadeTo(next, "fade", 1, 900);
  apply();
}

/**
 * Música del lugar. `area` es la clave del mapa (`def.music`) o "title"; "chase" sube la tensión de la
 * zona que ya suena en vez de cambiar de pista (y volver a pedir la del lugar la baja).
 */
export function startMusic(scene, area) {
  hook(scene);
  const inWorld = Boolean(scene.def && scene.registry);
  if (inWorld) worldScene = scene;
  if (area === "chase") {
    chase = true;
    retarget();
    return;
  }
  chase = false;
  if (!inWorld) {
    worldScene = null;
    heatBase = 0;
    lastPhase = null;
  }
  retarget();
  const zona = zoneFor(scene, area);
  if (currentZone === zona && (deck?.zona === zona || loadingScene?.sys?.isActive())) return;
  currentZone = zona;
  const cfg = ELEGIDAS[zona];
  const list = [[zoneKey(zona, "calma"), musicUrl(zona, "calma", cfg.calma)]];
  if (cfg.tension) list.push([zoneKey(zona, "tension"), musicUrl(zona, "tension", cfg.tension)]);
  const play = () => {
    if (currentZone !== zona) return;
    loadingScene = scene;
    ensureAll(scene, list, () => {
      if (loadingScene === scene) loadingScene = null;
      if (currentZone !== zona || deck?.zona === zona) return;
      switchTo(scene, zona);
    });
  };
  if (scene.sound.locked) scene.sound.once("unlocked", play);
  else play();
}

/** La zona IA que suena (o se está cargando). */
export function currentMusicArea() {
  return currentZone;
}

/** La capa de calma que suena (compatibilidad con código de antes). */
export function getCurrentMusic() {
  return deck?.calm?.isPlaying ? deck.calm : null;
}

export function musicVolume() {
  return MUSIC_VOLUME;
}

/** Baja la música (y un poco el ambiente) con fundido de 250 ms. `volume`: como antes, absoluto (0.05-0.12). */
export function duckMusic(volume = 0.1) {
  fadeTo(mix, "duck", clamp01(volume / MUSIC_VOLUME), 250);
}

export function restoreMusic() {
  fadeTo(mix, "duck", 1, 250);
}

// ------------------------------------------------------------------ stingers

/**
 * Clip corto de música (llegada, fama, cobrador, redada, ko, amanecer, anochecer): baja la música
 * 1.5 s y lo toca encima.
 */
export function stinger(name, scene) {
  const n = STINGERS[name];
  if (!n) return;
  if (globalThis.__captureSfx) globalThis.__captureSfx.push({ name: `stinger-${name}-${n}`, volume: STINGER_VOLUME });
  const sc = scene ?? liveScene();
  if (!sc) return;
  hook(sc);
  const key = `mia-stinger-${name}`;
  ensureAll(sc, [[key, stingerUrl(name)]], () => {
    if (sc.sound.locked) return;
    sc.sound.play(key, { volume: STINGER_VOLUME * bus.music });
    fadeTo(mix, "sting", 0.3, 250);
    clearTimeout(stingTimer);
    stingTimer = setTimeout(() => fadeTo(mix, "sting", 1, 700), 1500);
  });
}

// ------------------------------------------------------------------ ambiente

function ambVariant(name, scene) {
  const cfg = AMBIENTES[name];
  if (!cfg) return null;
  const night = scene?.registry ? isNight(scene.registry) : false;
  const v = cfg.noche && night ? cfg.noche : cfg;
  return { key: `amb-ia-${v.file ?? name}`, url: v.url ?? sfxUrl(v.file), vol: v.vol, single: Boolean(v.url) };
}

function playAmb(scene, v, ms) {
  ambWant = v.key;
  const go = () => ensureAll(scene, [[v.key, v.url]], () => {
    if (ambWant !== v.key || amb?.key === v.key) return;
    const first = scene.sound.add(v.key, { loop: true, volume: 0 });
    first.play({ loop: true, volume: 0 });
    const sounds = [first];
    if (!v.single) {
      // Segunda copia a medio loop: tapa el fundido de la costura de la primera.
      const second = scene.sound.add(v.key, { loop: true, volume: 0 });
      second.play({ loop: true, volume: 0, delay: first.totalDuration / 2 });
      sounds.push(second);
    }
    const next = { key: v.key, sounds, vol: v.vol, fade: 0 };
    fadeOutAmb();
    amb = next;
    fadeTo(next, "fade", 1, ms);
    apply();
  });
  if (scene.sound.locked) scene.sound.once("unlocked", go);
  else go();
}

function fadeOutAmb(ms = 600) {
  if (!amb) return;
  const old = amb;
  amb = null;
  ambDying.add(old);
  fadeTo(old, "fade", 0, ms, () => {
    for (const s of old.sounds) s.destroy();
    ambDying.delete(old);
  });
}

/** Aves ↔ grillos al cambiar día/noche. */
function refreshAmbience(scene) {
  if (!ambName || !AMBIENTES[ambName]?.noche) return;
  const v = ambVariant(ambName, scene);
  if (v && v.key !== ambWant) playAmb(scene, v, 2000);
}

/** Capa de ambiente. `name` null o desconocido = silencio. */
export function startAmbience(scene, name) {
  hook(scene);
  const logical = AMBIENTES[name] ? name : null;
  if (ambName === logical) {
    refreshAmbience(scene);
    return;
  }
  ambName = logical;
  if (!logical) {
    ambWant = null;
    fadeOutAmb();
    return;
  }
  if (scene.registry) nightNow = isNight(scene.registry);
  playAmb(scene, ambVariant(logical, scene), 1200);
}
